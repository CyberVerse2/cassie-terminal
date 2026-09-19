import { config } from '../config';

const API = 'https://api.polygon.io';
const currentCache = new Map<string, { at: number; price: number | null }>();
const postedCache = new Map<string, { at: number; price: number | null }>();
const inflight = new Map<string, Promise<number | null>>();
let gate = Promise.resolve();
function locked<T>(work: () => Promise<T>): Promise<T> {
  const run = gate.then(work, work);
  gate = run.then(() => undefined, () => undefined);
  return run;
}
function shared(key: string, work: () => Promise<number | null>): Promise<number | null> {
  const active = inflight.get(key);
  if (active) return active;
  const pending = work().finally(() => inflight.delete(key));
  inflight.set(key, pending);
  return pending;
}

export function historyTicker(ticker: string, instrument: string): string {
  const symbol = ticker.replace(/^\$/, '').replace(/-USD$/i, '').toUpperCase();
  return instrument === 'spot' ? `X:${symbol}USD` : symbol;
}

async function pget<T>(
  path: string,
  params: Record<string, string> = {},
  opts: { retry429?: boolean; timeoutMs?: number } = {},
): Promise<T | null> {
  if (!config.polygonApiKey) return null;
  return locked(() => get(path, params, opts));
}

async function get<T>(
  path: string,
  params: Record<string, string>,
  opts: { retry429?: boolean; timeoutMs?: number },
): Promise<T | null> {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('apiKey', config.polygonApiKey);
  for (let attempt = 0; ; attempt++) {
    const signal = opts.timeoutMs ? AbortSignal.timeout(opts.timeoutMs) : undefined;
    let res: Response;
    try {
      res = await fetch(url, { signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') return null;
      throw error;
    }
    if (res.status === 404) return null;
    if ((opts.retry429 ?? true) && res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, (attempt + 1) * 1500));
      continue;
    }
    if (res.status === 429) return null;
    if (!res.ok) throw new Error(`Polygon ${res.status} ${path}`);
    return res.json() as Promise<T>;
  }
}

export async function currentPrice(ticker: string): Promise<number | null> {
  const symbol = ticker.toUpperCase();
  const cached = currentCache.get(symbol);
  if (cached && Date.now() - cached.at < 30_000) return cached.price;
  return shared('now:' + symbol, async () => {
    const now = Date.now();
    const latest = await pget<{ results?: { c: number }[] }>(
      `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/minute/${now - 36 * 3_600_000}/${now}`,
      { adjusted: 'true', sort: 'desc', limit: '1' },
      { retry429: false, timeoutMs: 1_200 },
    );
    const price = latest?.results?.[0]?.c ?? null;
    currentCache.set(symbol, { at: Date.now(), price });
    return price;
  });
}

export async function priceAt(ticker: string, at: Date): Promise<number | null> {
  const symbol = ticker.toUpperCase();
  const t = at.getTime();
  const key = `${symbol}:${Math.floor(t / 60_000)}`;
  const cached = postedCache.get(key);
  if (cached) return cached.price;
  return shared('at:' + key, async () => {
    const data = await pget<{ results?: { c: number }[] }>(
      `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/1/minute/${t - 7 * 86_400_000}/${t}`,
      { adjusted: 'true', sort: 'desc', limit: '1' },
      { retry429: false, timeoutMs: 2_000 },
    );
    const price = data?.results?.[0]?.c ?? null;
    postedCache.set(key, { at: Date.now(), price });
    return price;
  });
}

const BAR = {
  '5Min': { multiplier: 5, timespan: 'minute' },
  '30Min': { multiplier: 30, timespan: 'minute' },
  '1Hour': { multiplier: 1, timespan: 'hour' },
  '4Hour': { multiplier: 4, timespan: 'hour' },
  '1Day': { multiplier: 1, timespan: 'day' },
} as const;

export async function historicalBars(
  ticker: string,
  start: Date,
  end: Date,
  timeframe: keyof typeof BAR,
) {
  if (!config.polygonApiKey) throw new Error('POLYGON_API_KEY is required for chart history');
  const symbol = ticker.toUpperCase();
  const spec = BAR[timeframe];
  const data = await get<{ results?: { t: number; o: number; h: number; l: number; c: number; v: number }[] }>(
    `/v2/aggs/ticker/${encodeURIComponent(symbol)}/range/${spec.multiplier}/${spec.timespan}/${start.getTime()}/${end.getTime()}`,
    { adjusted: 'true', sort: 'asc', limit: '50000' },
    { timeoutMs: 8_000 },
  );
  const bars = data?.results ?? [];
  if (!bars.length) throw new Error(`Polygon returned no historical bars for ${symbol}`);
  return bars.map((bar) => ({
    time: Math.floor(bar.t / 1_000),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }));
}
