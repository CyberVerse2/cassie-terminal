import { config } from '../config';

const API = 'https://api.coingecko.com/api/v3';

async function cget<T>(path: string, params: Record<string, string> = {}): Promise<T | null> {
  const url = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers: Record<string, string> = {};
  if (config.coingeckoApiKey) headers['x-cg-demo-api-key'] = config.coingeckoApiKey;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`CoinGecko ${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export async function currentPrice(coinId: string): Promise<number | null> {
  const data = await cget<Record<string, { usd?: number }>>('/simple/price', {
    ids: coinId,
    vs_currencies: 'usd',
  });
  return data?.[coinId]?.usd ?? null;
}

export async function historicalBars(coinId: string, days: string) {
  const data = await cget<Array<[number, number, number, number, number]>>(
    `/coins/${encodeURIComponent(coinId)}/ohlc`,
    { vs_currency: 'usd', days, precision: 'full' },
  );
  if (!data?.length) throw new Error(`CoinGecko returned no historical bars for ${coinId}`);
  return data.map(([timestamp, open, high, low, close]) => ({
    time: Math.floor(timestamp / 1_000),
    open,
    high,
    low,
    close,
    volume: 0,
  }));
}
