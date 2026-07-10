import { config } from '../config';

// Read-path only: reference price + resolution metadata off Gamma.
interface GammaMarket {
  conditionId: string;
  question: string;
  slug: string;
  icon?: string;
  image?: string;
  description?: string;
  outcomes?: string; // JSON '["Yes","No"]'
  outcomePrices?: string; // JSON '["0.62","0.38"]'
  clobTokenIds?: string; // JSON '["yes-token","no-token"]'
  volumeNum?: number;
  endDate?: string;
}

type Outcome = 'yes' | 'no';

type PriceHistoryResponse = {
  history?: Array<{ t: number; p: number }>;
};

function parseList(value: string | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

async function findMarket(conditionId: string): Promise<GammaMarket | null> {
  const url = new URL(`${config.polymarketGammaUrl}/markets`);
  url.searchParams.set('condition_ids', conditionId);
  const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Polymarket Gamma ${response.status} for ${conditionId}`);
  const markets = (await response.json()) as GammaMarket[];
  return markets[0] ?? null;
}

function outcomeIndex(market: GammaMarket, outcome: Outcome): number {
  return parseList(market.outcomes).findIndex((value) => value.toLowerCase() === outcome);
}

/** Current price of the held side, from Gamma (reference, not executable). */
export async function currentPrice(
  conditionId: string,
  direction: Outcome,
): Promise<number | null> {
  const market = await findMarket(conditionId);
  if (!market) return null;
  const index = outcomeIndex(market, direction);
  const price = Number(parseList(market.outcomePrices)[index]);
  return index >= 0 && Number.isFinite(price) ? price : null;
}

/** Historical probability for the routed outcome, plus its public live stream. */
export async function historicalPrices(
  conditionId: string,
  direction: Outcome,
  fidelity: number,
) {
  const market = await findMarket(conditionId);
  if (!market) throw new Error(`Polymarket market not found for ${conditionId}`);

  const index = outcomeIndex(market, direction);
  const assetId = parseList(market.clobTokenIds)[index];
  if (index < 0 || !assetId) {
    throw new Error(`Polymarket ${direction.toUpperCase()} token not found for ${conditionId}`);
  }

  const url = new URL(`${config.polymarketClobUrl}/prices-history`);
  url.searchParams.set('market', assetId);
  url.searchParams.set('interval', 'max');
  url.searchParams.set('fidelity', String(fidelity));

  const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Polymarket CLOB ${response.status} price history`);
  const payload = (await response.json()) as PriceHistoryResponse;
  const data = (payload.history ?? [])
    .filter((point) => Number.isFinite(point.t) && Number.isFinite(point.p) && point.p >= 0 && point.p <= 1)
    .map((point) => ({ time: Math.floor(point.t), value: point.p }));
  if (data.length === 0) throw new Error(`Polymarket returned no price history for ${conditionId}`);

  return {
    data,
    stream: { url: config.polymarketWsUrl, assetId },
  };
}

/** Resolution metadata for a prediction's detail view. */
export async function marketInfo(
  conditionId: string,
): Promise<{ endDate: string | null; criteria: string | null; volume: number | null } | null> {
  const market = await findMarket(conditionId);
  if (!market) return null;
  return {
    endDate: market.endDate ?? null,
    criteria: market.description?.trim() || null,
    volume: market.volumeNum ?? null,
  };
}
