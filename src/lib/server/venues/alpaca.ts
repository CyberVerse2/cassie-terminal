import { config } from '../config';

const CACHE_TTL_MS = 30_000;
const REQUEST_TIMEOUT_MS = 2_000;
const TOKEN_EXPIRY_BUFFER_MS = 30_000;

type Deferred = {
  promise: Promise<number>;
  resolve: (price: number) => void;
  reject: (error: Error) => void;
};

type LatestTradesResponse = {
  trades?: Record<string, { p?: number }>;
};

type HistoricalBarResponse = {
  bars?: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>;
};

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
};

const cache = new Map<string, { at: number; price: number }>();
const inFlight = new Map<string, Deferred>();
let pending = new Map<string, Deferred>();
let flushScheduled = false;
let tokenCache: { value: string; expiresAt: number } | null = null;
let tokenRequest: Promise<string> | null = null;

function endpoints() {
  if (config.alpacaEnvironment === 'sandbox') {
    return {
      data: 'https://data.sandbox.alpaca.markets',
      auth: 'https://authx.sandbox.alpaca.markets',
    };
  }
  if (config.alpacaEnvironment === 'live') {
    return {
      data: 'https://data.alpaca.markets',
      auth: 'https://authx.alpaca.markets',
    };
  }
  throw new Error('ALPACA_ENV must be sandbox or live');
}

function deferred(): Deferred {
  let resolve!: (price: number) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<number>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function requestAccessToken(): Promise<string> {
  if (!config.alpacaClientId || !config.alpacaClientSecret) {
    throw new Error('Alpaca Broker client credentials are not configured');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.alpacaClientId,
    client_secret: config.alpacaClientSecret,
  });
  let response: Response;
  try {
    response = await fetch(`${endpoints().auth}/v1/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`Alpaca OAuth timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }
  if (!response.ok) throw new Error(`Alpaca OAuth ${response.status}`);

  const token = (await response.json()) as TokenResponse;
  if (!token.access_token || !token.expires_in) throw new Error('Alpaca OAuth response is incomplete');
  tokenCache = {
    value: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1_000,
  };
  return token.access_token;
}

async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
    return tokenCache.value;
  }
  if (tokenRequest) return tokenRequest;
  tokenRequest = requestAccessToken();
  try {
    return await tokenRequest;
  } finally {
    tokenRequest = null;
  }
}

async function fetchLatestTrades(symbols: string[]): Promise<Map<string, number>> {
  const url = new URL('/v2/stocks/trades/latest', endpoints().data);
  url.searchParams.set('symbols', symbols.join(','));
  url.searchParams.set('feed', 'iex');

  let response: Response;
  try {
    const token = await accessToken();
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(`Alpaca latest trades timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(`Alpaca ${response.status} latest trades`);
  }

  const data = (await response.json()) as LatestTradesResponse;
  const prices = new Map<string, number>();
  for (const symbol of symbols) {
    const price = data.trades?.[symbol]?.p;
    if (typeof price === 'number' && Number.isFinite(price)) prices.set(symbol, price);
  }
  return prices;
}

async function flush() {
  const batch = pending;
  pending = new Map();
  const symbols = [...batch.keys()];
  for (const [symbol, request] of batch) inFlight.set(symbol, request);

  try {
    const prices = await fetchLatestTrades(symbols);
    const at = Date.now();
    for (const symbol of symbols) {
      const price = prices.get(symbol);
      const request = batch.get(symbol)!;
      if (price === undefined) {
        request.reject(new Error(`Alpaca returned no IEX trade for ${symbol}`));
        continue;
      }
      cache.set(symbol, { at, price });
      request.resolve(price);
    }
  } catch (error) {
    const failure = error instanceof Error ? error : new Error(String(error));
    for (const request of batch.values()) request.reject(failure);
  } finally {
    for (const symbol of symbols) inFlight.delete(symbol);
    flushScheduled = false;
    if (pending.size > 0) {
      flushScheduled = true;
      queueMicrotask(() => void flush());
    }
  }
}

/** Coalesces concurrent symbol lookups into one Alpaca multi-symbol request. */
export function currentPrice(ticker: string): Promise<number> {
  const symbol = ticker.toUpperCase();
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return Promise.resolve(cached.price);
  const active = inFlight.get(symbol);
  if (active) return active.promise;
  const queued = pending.get(symbol);
  if (queued) return queued.promise;

  const request = deferred();
  pending.set(symbol, request);
  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(() => void flush());
  }
  return request.promise;
}

export async function historicalBars(
  ticker: string,
  start: Date,
  end: Date,
  timeframe: string,
) {
  const symbol = ticker.toUpperCase();
  const url = new URL(`/v2/stocks/${encodeURIComponent(symbol)}/bars`, endpoints().data);
  url.searchParams.set('timeframe', timeframe);
  url.searchParams.set('start', start.toISOString());
  url.searchParams.set('end', end.toISOString());
  url.searchParams.set('limit', '10000');
  url.searchParams.set('feed', 'iex');
  url.searchParams.set('adjustment', 'raw');

  const token = await accessToken();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Alpaca ${response.status} historical bars for ${symbol}`);

  const data = (await response.json()) as HistoricalBarResponse;
  const bars = data.bars ?? [];
  if (bars.length === 0) throw new Error(`Alpaca returned no historical bars for ${symbol}`);
  return bars.map((bar) => ({
    time: Math.floor(new Date(bar.t).getTime() / 1_000),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
  }));
}
