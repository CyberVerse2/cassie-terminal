import { listTradeCandidates } from './feed';

const CACHE_TTL_MS = 30_000;
type Candidate = Awaited<ReturnType<typeof listTradeCandidates>>[number];
type Result = { groups: ReturnType<typeof buildGroup>[] };
const cache = new Map<string, { expiresAt: number; value: Result }>();

function tradeKey(candidate: Candidate) {
  return [candidate.ticker, candidate.venue, candidate.instrument, candidate.direction].join('::');
}

function buildGroup(members: Candidate[]) {
  const ordered = [...members].sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  );
  const newest = ordered[0];
  const best = ordered.reduce((winner, member) =>
    (member.sincePostedPct ?? Number.NEGATIVE_INFINITY) > (winner.sincePostedPct ?? Number.NEGATIVE_INFINITY)
      ? member
      : winner
  );
  const authorCount = new Set(ordered.map((member) => member.author.handle)).size;
  const horizons = new Set(ordered.map((member) => member.horizon).filter(Boolean));
  const direction = newest.direction?.toUpperCase() ?? '';
  const displayMembers = [best, ...ordered.filter((member) => member.id !== best.id)];
  return {
    id: best.id,
    ticker: newest.ticker,
    venueLabel: newest.venueLabel,
    currentPrice: newest.currentPrice,
    currentPriceError: newest.currentPriceError,
    direction: newest.direction,
    sincePostedPct: best.sincePostedPct,
    postedAt: newest.postedAt,
    horizon: horizons.size === 1 ? [...horizons][0] : 'mixed horizons',
    horizons: [...horizons],
    conviction: newest.conviction,
    category: best.category,
    instrument: best.instrument,
    author: best.author,
    thesis: ordered.length === 1
      ? newest.headlineQuote || newest.thesis
      : `${authorCount} traders are ${direction} ${newest.ticker}`,
    summary: best.text,
    members: displayMembers
  };
}

export async function listTradeGroups(limit = 60, tab = 'all') {
  const cacheKey = `${tab}:${limit}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const candidates = await listTradeCandidates(limit, tab);
  const grouped = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const key = tradeKey(candidate);
    grouped.set(key, [...(grouped.get(key) ?? []), candidate]);
  }
  const value = {
    groups: [...grouped.values()]
      .map(buildGroup)
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
  };
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}
