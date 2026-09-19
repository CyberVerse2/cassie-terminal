import { and, desc, eq, lt, ne, sql, type SQL } from 'drizzle-orm';
import { db, schema } from './db/client';
import { toFeedCard, toDetail, type FeedRow } from './serialize';
import * as alpaca from './venues/alpaca';
import * as coingecko from './venues/coingecko';
import * as hl from './venues/hyperliquid';
import * as pm from './venues/polymarket';

const { tradeIdeas, routes, routePricing, rawPosts, sources } = schema;

const baseSelect = {
  idea: tradeIdeas,
  route: routes,
  pricing: routePricing,
  post: rawPosts,
  source: sources,
};

function baseQuery() {
  return db
    .select(baseSelect)
    .from(tradeIdeas)
    .innerJoin(routes, eq(routes.ideaId, tradeIdeas.id))
    .leftJoin(routePricing, eq(routePricing.routeId, routes.id))
    .leftJoin(rawPosts, eq(rawPosts.tweetId, tradeIdeas.tweetId))
    .leftJoin(sources, eq(sources.handle, tradeIdeas.authorHandle));
}

function tabFilter(tab: string): SQL | undefined {
  switch (tab) {
    case 'perps':
      return sql`false`;
    case 'stocks':
      return eq(routes.instrument, 'shares');
    case 'tokens':
      return eq(routes.instrument, 'spot');
    case 'markets':
      return sql`false`;
    default:
      return undefined;
  }
}

export async function listIdeas(tab: string, limit: number, cursor: string | null) {
  const filters: SQL[] = [eq(routes.status, 'routed'), sql`${routes.instrument} IN ('shares', 'spot')`];
  const routeTab = tabFilter(tab);
  if (routeTab) filters.push(routeTab);
  if (cursor) filters.push(lt(tradeIdeas.postedAt, new Date(cursor)));

  const candidateLimit = Math.min(Math.max(limit * 8, 80), 500);
  const rows = (await baseQuery()
    .where(and(...filters))
    .orderBy(desc(tradeIdeas.postedAt))
    .limit(candidateLimit)) as FeedRow[];

  const convictionRank = { high: 3, medium: 2, low: 1 } as const;
  const opportunities = new Map<string, FeedRow>();
  for (const row of rows) {
    const ticker = row.route.ticker?.replace(/^xyz:/, '').toUpperCase();
    const direction = row.route.direction;
    if (!ticker || !direction) continue;
    const key = `${ticker}:${direction}`;
    const current = opportunities.get(key);
    const rowRank = convictionRank[row.idea.conviction ?? 'low'];
    const currentRank = current ? convictionRank[current.idea.conviction ?? 'low'] : 0;
    if (!current || rowRank > currentRank) opportunities.set(key, row);
  }

  const distinctRows = [...opportunities.values()]
    .sort((a, b) => {
      const convictionDelta = convictionRank[b.idea.conviction ?? 'low']
        - convictionRank[a.idea.conviction ?? 'low'];
      return convictionDelta || b.idea.postedAt.getTime() - a.idea.postedAt.getTime();
    })
    .slice(0, limit);

  const cards = await Promise.all(distinctRows.map(toFeedCard));
  const nextCursor =
    rows.length === candidateLimit ? rows[rows.length - 1].idea.postedAt.toISOString() : null;
  return { cards, nextCursor };
}

export async function listTradeCandidates(limit: number, tab = 'all') {
  const filters: SQL[] = [eq(routes.status, 'routed'), sql`${routes.instrument} IN ('shares', 'spot')`];
  const routeTab = tabFilter(tab);
  if (routeTab) filters.push(routeTab);
  const rows = (await baseQuery()
    .where(and(...filters))
    .orderBy(desc(tradeIdeas.postedAt))
    .limit(Math.min(Math.max(limit, 1), 60))) as FeedRow[];
  return Promise.all(rows.map(toFeedCard));
}

export async function getIdea(id: string) {
  const [row] = (await baseQuery().where(eq(tradeIdeas.id, id)).limit(1)) as FeedRow[];
  if (!row) return null;
  const opposingDirection = ({ long: 'short', short: 'long', yes: 'no', no: 'yes' } as const)[
    row.route.direction as 'long' | 'short' | 'yes' | 'no'
  ];
  const [invalidatingRow] = row.route.ticker && row.route.venue && opposingDirection
    ? (await baseQuery()
      .where(and(
        eq(routes.status, 'routed'),
        eq(routes.ticker, row.route.ticker),
        eq(routes.venue, row.route.venue),
        eq(routes.direction, opposingDirection),
        ne(tradeIdeas.id, id),
      ))
      .orderBy(
        sql`case ${tradeIdeas.conviction} when 'high' then 3 when 'medium' then 2 else 1 end desc`,
        desc(tradeIdeas.postedAt),
      )
      .limit(1)) as FeedRow[]
    : [];
  return toDetail(row, invalidatingRow ?? null);
}

const DAY_MS = 86_400_000;

const CHART_INTERVALS = {
  '5m': { minDays: 5, maxAgeDays: 12, alpaca: '5Min', hyperliquid: '5m', polymarket: 5 },
  '30m': { minDays: 30, maxAgeDays: 88, alpaca: '30Min', hyperliquid: '30m', polymarket: 30 },
  '1h': { minDays: 60, maxAgeDays: 178, alpaca: '1Hour', hyperliquid: '1h', polymarket: 60 },
  '4h': { minDays: 180, maxAgeDays: 718, alpaca: '4Hour', hyperliquid: '4h', polymarket: 240 },
  '1d': { minDays: 365, maxAgeDays: Number.POSITIVE_INFINITY, alpaca: '1Day', hyperliquid: '1d', polymarket: 1440 },
} as const;

type ChartInterval = keyof typeof CHART_INTERVALS;

export function isChartInterval(value: string): value is ChartInterval {
  return value in CHART_INTERVALS;
}

function chartWindow(postedAt: Date, requestedInterval: ChartInterval | null) {
  const ageDays = Math.max(0, (Date.now() - postedAt.getTime()) / DAY_MS);
  const intervals = (Object.keys(CHART_INTERVALS) as ChartInterval[])
    .filter((interval) => ageDays <= CHART_INTERVALS[interval].maxAgeDays);
  const automatic = intervals.includes('30m') ? '30m' : intervals[0];
  const interval = requestedInterval ?? automatic;
  if (!intervals.includes(interval)) {
    throw new Error(`${interval} history is unavailable for this post`);
  }
  const config = CHART_INTERVALS[interval];
  return {
    days: Math.max(config.minDays, Math.ceil(ageDays + 2)),
    alpaca: config.alpaca,
    hyperliquid: config.hyperliquid,
    polymarket: config.polymarket,
    label: interval,
    intervals,
  };
}

function coingeckoDays(days: number) {
  if (days <= 30) return '30';
  if (days <= 90) return '90';
  if (days <= 180) return '180';
  if (days <= 365) return '365';
  return 'max';
}

/** Venue-native series used by the synchronized trade chart. */
export async function getIdeaChart(id: string, requestedInterval: ChartInterval | null = null) {
  const [row] = (await baseQuery().where(eq(tradeIdeas.id, id)).limit(1)) as FeedRow[];
  if (!row) return null;

  const { idea, route } = row;
  if (!route.ticker || !route.venue) throw new Error('idea has no chartable route');
  const window = chartWindow(idea.postedAt, requestedInterval);
  const end = new Date();
  const start = new Date(end.getTime() - window.days * DAY_MS);

  if (route.venue === 'equity') {
    return {
      seriesType: 'candlestick' as const,
      data: await alpaca.historicalBars(route.ticker, start, end, window.alpaca),
      interval: window.label,
      intervals: window.intervals,
    };
  }
  if (route.venue === 'hyperliquid') {
    return {
      seriesType: 'candlestick' as const,
      data: await hl.historicalBars(route.ticker, start, end, window.hyperliquid),
      interval: window.label,
      intervals: window.intervals,
    };
  }
  if (route.venue === 'coingecko') {
    const days = coingeckoDays(window.days);
    return {
      seriesType: 'candlestick' as const,
      data: await coingecko.historicalBars(route.ticker, days),
      interval: Number(days) <= 2 ? '30m' : Number(days) <= 30 ? '4h' : '4d',
      intervals: [Number(days) <= 2 ? '30m' : Number(days) <= 30 ? '4h' : '4d'],
    };
  }
  if (route.venue === 'polymarket') {
    const outcome = route.direction === 'no' ? 'no' : 'yes';
    const history = await pm.historicalPrices(
      route.ticker,
      outcome,
      window.polymarket,
    );
    return {
      seriesType: 'probability' as const,
      ...history,
      interval: window.label,
      intervals: window.intervals,
    };
  }
  throw new Error(`${route.venue} routes do not have a chart`);
}

export async function authorStats(handle: string) {
  const rows = (await baseQuery().where(eq(tradeIdeas.authorHandle, handle))) as FeedRow[];
  const routedRows = rows.filter((row) => row.route.status === 'routed');
  const cards = await Promise.all(routedRows.map(toFeedCard));
  const priced = cards
    .map((card) => card.sincePostedPct)
    .filter((pct): pct is number => pct !== null);
  const avgSincePosted =
    priced.length === 0
      ? null
      : Number((priced.reduce((sum, pct) => sum + pct, 0) / priced.length).toFixed(2));
  const winners = priced.filter((pct) => pct > 0).length;
  return {
    handle,
    ideas: rows.length,
    routed: routedRows.length,
    scored: priced.length,
    avgSincePosted,
    winners,
    winRate: priced.length === 0 ? null : Math.round((winners / priced.length) * 100),
  };
}

export async function feedStatus() {
  const [latest] = await db
    .select({ at: sql<string>`max(${rawPosts.fetchedAt})` })
    .from(rawPosts);
  const [counts] = await db
    .select({ ideas: sql<number>`count(*)::int` })
    .from(tradeIdeas)
    .innerJoin(routes, eq(routes.ideaId, tradeIdeas.id))
    .where(eq(routes.status, 'routed'));
  return { lastFetchAt: latest?.at ?? null, routedIdeas: counts?.ideas ?? 0 };
}
