const API = 'https://api.binance.com/api/v3';
const INTERVAL = {
  '5Min': '5m',
  '30Min': '30m',
  '1Hour': '1h',
  '4Hour': '4h',
  '1Day': '1d',
} as const;

export function spotSymbol(ticker: string): string {
  return ticker.replace(/^\$/, '').replace(/-USD$/i, '').toUpperCase() + 'USDT';
}

async function get<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(API + path);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Binance ${response.status} ${path}`);
  return response.json() as Promise<T>;
}

export async function currentPrice(ticker: string): Promise<number | null> {
  try {
    const data = await get<{ price?: string }>('/ticker/price', { symbol: spotSymbol(ticker) });
    const price = Number(data.price);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function priceAt(ticker: string, at: Date): Promise<number | null> {
  try {
    const rows = await get<[number, string][]>('/klines', {
      symbol: spotSymbol(ticker),
      interval: '5m',
      startTime: String(at.getTime() - 8 * 3_600_000),
      endTime: String(at.getTime()),
      limit: '100',
    });
    const price = Number(rows.at(-1)?.[4]);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function historicalBars(
  ticker: string,
  start: Date,
  end: Date,
  timeframe: keyof typeof INTERVAL,
) {
  const rows = await get<[number, string, string, string, string, string][]>('/klines', {
    symbol: spotSymbol(ticker),
    interval: INTERVAL[timeframe],
    startTime: String(start.getTime()),
    endTime: String(end.getTime()),
    limit: '1000',
  });
  if (!rows.length) throw new Error(`Binance returned no historical bars for ${ticker}`);
  return rows.map((row) => ({
    time: Math.floor(row[0] / 1_000),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
  }));
}
