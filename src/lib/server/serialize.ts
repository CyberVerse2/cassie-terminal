import { schema } from './db/client';
import * as hl from './venues/hyperliquid';
import * as pm from './venues/polymarket';
import * as alpaca from './venues/alpaca';
import * as coingecko from './venues/coingecko';

type IdeaRow = typeof schema.tradeIdeas.$inferSelect;
type RouteRow = typeof schema.routes.$inferSelect;
type PricingRow = typeof schema.routePricing.$inferSelect;
type PostRow = typeof schema.rawPosts.$inferSelect;
type SourceRow = typeof schema.sources.$inferSelect;

export interface FeedRow {
  idea: IdeaRow;
  route: RouteRow;
  pricing: PricingRow | null;
  post: PostRow | null;
  source: SourceRow | null;
}

const VENUE_LABEL: Record<string, string> = {
  hyperliquid: 'HYPERLIQUID',
  equity: 'STOCKS',
  coingecko: 'SPOT',
  polymarket: 'POLYMARKET',
};

function bareTicker(ticker: string | null): string {
  if (!ticker) return '';
  return (ticker.includes(':') ? ticker.split(':').pop()! : ticker).toUpperCase();
}

function category(route: RouteRow): string {
  if (route.ticker?.startsWith('xyz:')) return 'stocks';
  if (route.instrument === 'perp') return 'perps';
  if (route.instrument === 'shares') return 'stocks';
  if (route.instrument === 'spot') return 'tokens';
  return 'markets';
}

type PmMeta = { question?: string; slug?: string; eventSlug?: string; icon?: string };
type HlMeta = { dex?: string };
const LIVE_PRICE_TIMEOUT_MS = 3_000;

function displayTicker(route: RouteRow): string {
  if (route.venue === 'polymarket') {
    const q = (route.marketMeta as PmMeta | null)?.question;
    if (q) return q;
  }
  const base = bareTicker(route.ticker);
  if (route.instrument === 'perp') return `${base}-USD`;
  return base;
}

function logoUrl(idea: IdeaRow, route: RouteRow): string {
  if (route.venue === 'polymarket') {
    return (route.marketMeta as PmMeta | null)?.icon ?? '';
  }
  const base = bareTicker(route.ticker) || (idea.candidateTickers[0] ?? '');
  const kind = idea.assetClass === 'crypto' ? 'crypto' : 'symbol';
  return `https://api.elbstream.com/logos/${kind}/${base}`;
}

function num(v: string | null): number | null {
  return v === null ? null : Number(v);
}

// Direction-adjusted move since the author posted: the P&L of *their call*.
function sincePostedPct(
  entryPrice: number | null,
  currentPrice: number | null,
  direction: string | null,
): number | null {
  if (entryPrice === null || currentPrice === null || entryPrice === 0) return null;
  const raw = ((currentPrice - entryPrice) / entryPrice) * 100;
  const sign = direction === 'short' || direction === 'no' ? -1 : 1;
  return Number((raw * sign).toFixed(4));
}

async function liveCurrentPrice(route: RouteRow): Promise<number> {
  if (!route.venue || !route.ticker || !route.direction) {
    throw new Error('routed idea is missing venue, ticker, or direction');
  }

  switch (route.venue) {
    case 'hyperliquid': {
      const price = await hl.livePrice(route.ticker, (route.marketMeta as HlMeta | null)?.dex ?? '');
      if (price === null) throw new Error(`Hyperliquid returned no live price for ${route.ticker}`);
      return price;
    }
    case 'equity': {
      return alpaca.currentPrice(route.ticker);
    }
    case 'coingecko': {
      const price = await coingecko.currentPrice(route.ticker);
      if (price === null) throw new Error(`CoinGecko returned no live price for ${route.ticker}`);
      return price;
    }
    case 'polymarket': {
      const price = await pm.currentPrice(route.ticker, route.direction === 'no' ? 'no' : 'yes');
      if (price === null) throw new Error(`Polymarket returned no live price for ${route.ticker}`);
      return price;
    }
  }
  throw new Error(`unknown venue ${route.venue}`);
}

async function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), LIVE_PRICE_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

/** Compact feed card — everything the terminal feed renders, nothing more. */
export async function toFeedCard(row: FeedRow) {
  const { idea, route, pricing, post, source } = row;
  const entryPrice = num(pricing?.entryPrice ?? null);
  let currentPrice: number | null = null;
  let currentPriceError: string | null = null;
  try {
    currentPrice = await withTimeout(
      liveCurrentPrice(route),
      `live price timed out after ${LIVE_PRICE_TIMEOUT_MS}ms for ${route.ticker ?? 'unknown'}`,
    );
  } catch (err) {
    currentPriceError = err instanceof Error ? err.message : String(err);
  }

  return {
    id: idea.id,
    venue: route.venue,
    venueLabel: route.venue ? VENUE_LABEL[route.venue] ?? route.venue.toUpperCase() : '—',
    instrument: route.instrument,
    category: category(route),
    ticker: displayTicker(route),
    direction: route.direction,
    sincePostedPct: sincePostedPct(entryPrice, currentPrice, route.direction),
    currentPrice,
    currentPriceError,
    entryPrice,
    logoUrl: logoUrl(idea, route),
    postedAt: idea.postedAt,
    author: {
      handle: idea.authorHandle,
      name: source?.name ?? idea.authorHandle,
      avatarUrl: `https://unavatar.io/x/${idea.authorHandle}`,
      profileUrl: source?.profileUrl ?? `https://x.com/${idea.authorHandle}`,
    },
    text: post?.text ?? idea.headlineQuote,
    headlineQuote: idea.headlineQuote,
    thesis: idea.thesis,
    conviction: idea.conviction,
    horizon: idea.horizon,
    sourceUrl: post ? `https://x.com/${idea.authorHandle}/status/${post.tweetId}` : null,
  };
}

/** Full detail — adds the reasoning the card hides. */
export async function toDetail(row: FeedRow) {
  const { idea, route } = row;
  const strategy = idea.strategy;
  const authorComponent = (text: string | null) => text ? { text, basis: 'author' as const } : null;
  const plan = {
    target: authorComponent(idea.target) ?? strategy?.takeProfit ?? null,
    stop: authorComponent(idea.invalidation) ?? strategy?.stopLoss ?? null,
    horizon: authorComponent(idea.horizon) ?? strategy?.hold ?? null,
  };
  let resolution: {
    resolutionDate: string | null;
    resolutionCriteria: string | null;
  } | null = null;
  if (route.instrument === 'prediction' && route.ticker) {
    const meta = route.marketMeta as (PmMeta & { endDate?: string }) | null;
    let info: Awaited<ReturnType<typeof pm.marketInfo>> = null;
    try {
      info = await withTimeout(pm.marketInfo(route.ticker), `market info timed out for ${route.ticker}`);
    } catch {
      // resolution detail is supplementary — fall back to stored endDate
    }
    resolution = {
      resolutionDate: info?.endDate ?? meta?.endDate ?? null,
      resolutionCriteria: info?.criteria ?? null,
    };
  }

  const card = await toFeedCard(row);
  const missingSetupFields = [
    !route.direction ? 'side' : null,
    !plan.target?.text ? 'target' : null,
    !plan.stop?.text ? 'stop' : null,
    !plan.horizon?.text ? 'horizon' : null,
  ].filter((field): field is string => field !== null);

  return {
    ...card,
    thesis: idea.thesis,
    alphaDrivers: idea.reasoning?.slice(0, 3) ?? [],
    plan,
    recommendedSetup: {
      side: route.direction,
      entry: { type: 'market' as const },
      target: plan.target,
      stop: plan.stop,
      horizon: plan.horizon,
      complete: missingSetupFields.length === 0,
      missing: missingSetupFields,
    },
    resolution,
  };
}
