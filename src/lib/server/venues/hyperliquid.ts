import { config } from '../config';

// Read-path only (live mark). The routing/candle side stays in cassie-indexer.
async function info<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${config.hyperliquidApiUrl}/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Hyperliquid info ${res.status}: ${JSON.stringify(body)}`);
  return res.json() as Promise<T>;
}

const midsCache = new Map<string, { at: number; mids: Record<string, string> }>();

export async function livePrice(coin: string, dex = ''): Promise<number | null> {
  const cacheKey = dex || 'default';
  const cached = midsCache.get(cacheKey);
  const mids =
    cached && Date.now() - cached.at < 2_000
      ? cached.mids
      : await info<Record<string, string>>({ type: 'allMids', ...(dex ? { dex } : {}) });
  if (!cached || Date.now() - cached.at >= 2_000) {
    midsCache.set(cacheKey, { at: Date.now(), mids });
  }
  const mid = mids[coin];
  return mid ? Number(mid) : null;
}

type Candle = {
  t: number;
  o: string;
  h: string;
  l: string;
  c: string;
  v: string;
};

export async function historicalBars(coin: string, start: Date, end: Date, interval: string) {
  const candles = await info<Candle[]>({
    type: 'candleSnapshot',
    req: {
      coin,
      interval,
      startTime: start.getTime(),
      endTime: end.getTime(),
    },
  });
  if (candles.length === 0) throw new Error(`Hyperliquid returned no historical bars for ${coin}`);
  return candles.map((bar) => ({
    time: Math.floor(bar.t / 1_000),
    open: Number(bar.o),
    high: Number(bar.h),
    low: Number(bar.l),
    close: Number(bar.c),
    volume: Number(bar.v),
  }));
}
