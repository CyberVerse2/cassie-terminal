import { env } from '$env/dynamic/private';

// Read-path config for the terminal's backend. It reads the same Postgres the
// cassie-indexer writes to, and hits the same public venue endpoints to compute
// live current price / since-posted P&L when the feed is read.
export const config = {
  databaseUrl: env.DATABASE_URL ?? 'postgres://localhost:5432/cassie_indexer',
  alpacaClientId: env.ALPACA_CLIENT_ID ?? '',
  alpacaClientSecret: env.ALPACA_CLIENT_SECRET ?? '',
  alpacaEnvironment: env.ALPACA_ENV ?? '',
  polygonApiKey: env.POLYGON_API_KEY ?? '',
  hyperliquidApiUrl: env.HYPERLIQUID_API_URL ?? 'https://api.hyperliquid.xyz',
  polymarketGammaUrl: env.POLYMARKET_GAMMA_API_URL ?? 'https://gamma-api.polymarket.com',
  polymarketClobUrl: env.POLYMARKET_CLOB_API_URL ?? 'https://clob.polymarket.com',
  polymarketWsUrl: env.POLYMARKET_WS_URL ?? 'wss://ws-subscriptions-clob.polymarket.com/ws/market',
};
