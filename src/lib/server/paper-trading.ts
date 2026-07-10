import { and, desc, eq } from 'drizzle-orm';
import { db, schema } from './db/client';
import { liveCurrentPrice } from './serialize';

type Direction = 'long' | 'short' | 'yes' | 'no';
type Position = typeof schema.paperPositions.$inferSelect;
type Route = typeof schema.routes.$inferSelect;

const STARTING_CASH_USD = 25_000;

function number(value: string | null): number {
  return value === null ? 0 : Number(value);
}

function roundUsd(value: number): number {
  return Math.round(value * 100) / 100;
}

function positionValue(position: Position, markPrice: number): number {
  const quantity = number(position.quantity);
  if (position.venue === 'polymarket' || position.direction === 'long') {
    return roundUsd(quantity * markPrice);
  }
  return roundUsd(Math.max(0, number(position.collateralUsd) + quantity * (number(position.entryPrice) - markPrice)));
}

async function routeForPosition(position: Position): Promise<Route> {
  const [route] = await db.select().from(schema.routes).where(eq(schema.routes.id, position.routeId)).limit(1);
  if (!route) throw new Error(`Route ${position.routeId} was not found`);
  return route;
}

async function markPosition(position: Position): Promise<Position> {
  try {
    const mark = await liveCurrentPrice(await routeForPosition(position), position.direction);
    const value = positionValue(position, mark);
    const pnl = roundUsd(value - number(position.collateralUsd));
    const [updated] = await db.update(schema.paperPositions).set({
      currentMarkPrice: String(mark),
      currentValueUsd: String(value),
      unrealizedPnlUsd: String(pnl),
      markError: null,
      updatedAt: new Date(),
    }).where(eq(schema.paperPositions.id, position.id)).returning();
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const [updated] = await db.update(schema.paperPositions).set({
      markError: message.slice(0, 500),
      updatedAt: new Date(),
    }).where(eq(schema.paperPositions.id, position.id)).returning();
    return updated;
  }
}

function serializePosition(position: Position) {
  const collateral = number(position.collateralUsd);
  const pnl = position.status === 'closed' ? number(position.realizedPnlUsd) : number(position.unrealizedPnlUsd);
  return {
    id: position.id,
    ideaId: position.ideaId,
    venue: position.venue,
    instrument: position.instrument,
    ticker: position.ticker,
    direction: position.direction,
    status: position.status,
    collateralUsd: collateral,
    quantity: number(position.quantity),
    entryPrice: number(position.entryPrice),
    currentMarkPrice: number(position.currentMarkPrice),
    currentValueUsd: number(position.currentValueUsd),
    pnlUsd: pnl,
    pnlPct: collateral === 0 ? 0 : Number(((pnl / collateral) * 100).toFixed(2)),
    markError: position.markError,
    openedAt: position.openedAt,
    closedAt: position.closedAt,
    closePrice: number(position.closePrice),
  };
}

export async function portfolio(accountId: string) {
  const [account] = await db.select().from(schema.paperAccounts).where(eq(schema.paperAccounts.id, accountId)).limit(1);
  if (!account) throw new Error('Paper account was not found');
  const rows = await db.select().from(schema.paperPositions)
    .where(eq(schema.paperPositions.accountId, accountId))
    .orderBy(desc(schema.paperPositions.openedAt));
  const openRows = rows.filter((position) => position.status === 'open');
  const marked = await Promise.all(openRows.map(markPosition));
  const closed = rows.filter((position) => position.status === 'closed');
  const cash = number(account.cashUsd);
  const deployed = roundUsd(marked.reduce((sum, position) => sum + number(position.currentValueUsd), 0));
  const unrealized = roundUsd(marked.reduce((sum, position) => sum + number(position.unrealizedPnlUsd), 0));
  return {
    startingCashUsd: number(account.startingCashUsd) || STARTING_CASH_USD,
    cashUsd: cash,
    deployedUsd: deployed,
    totalEquityUsd: roundUsd(cash + deployed),
    unrealizedPnlUsd: unrealized,
    openPositions: marked.map(serializePosition),
    closedPositions: closed.map(serializePosition),
  };
}

export async function placeMarketOrder(input: {
  accountId: string;
  ideaId: string;
  direction: Direction;
  amountUsd: number;
}) {
  if (!Number.isFinite(input.amountUsd) || input.amountUsd < 1) throw new Error('Amount must be at least $1');
  const [trade] = await db.select({ idea: schema.tradeIdeas, route: schema.routes })
    .from(schema.tradeIdeas)
    .innerJoin(schema.routes, eq(schema.routes.ideaId, schema.tradeIdeas.id))
    .where(and(eq(schema.tradeIdeas.id, input.ideaId), eq(schema.routes.status, 'routed')))
    .limit(1);
  if (!trade || !trade.route.venue || !trade.route.instrument || !trade.route.ticker) throw new Error('Trade route is unavailable');
  const allowed = trade.route.instrument === 'prediction' ? ['yes', 'no'] : ['long', 'short'];
  if (!allowed.includes(input.direction)) throw new Error(`Invalid direction for ${trade.route.instrument}`);
  const fillPrice = await liveCurrentPrice(trade.route, input.direction);
  if (!Number.isFinite(fillPrice) || fillPrice <= 0) throw new Error('No executable live price is available');
  const quantity = input.amountUsd / fillPrice;
  const now = new Date();

  return db.transaction(async (tx) => {
    const [account] = await tx.select().from(schema.paperAccounts)
      .where(eq(schema.paperAccounts.id, input.accountId)).for('update').limit(1);
    if (!account) throw new Error('Paper account was not found');
    const cash = number(account.cashUsd);
    if (input.amountUsd > cash) throw new Error('Insufficient paper balance');
    const [order] = await tx.insert(schema.paperOrders).values({
      accountId: input.accountId,
      ideaId: trade.idea.id,
      routeId: trade.route.id,
      venue: trade.route.venue,
      instrument: trade.route.instrument,
      ticker: trade.route.ticker,
      direction: input.direction,
      requestedUsd: String(roundUsd(input.amountUsd)),
      status: 'filled',
      fillPrice: String(fillPrice),
      filledQuantity: String(quantity),
      filledAt: now,
    }).returning();
    const [position] = await tx.insert(schema.paperPositions).values({
      accountId: input.accountId,
      orderId: order.id,
      ideaId: trade.idea.id,
      routeId: trade.route.id,
      venue: trade.route.venue,
      instrument: trade.route.instrument,
      ticker: trade.route.ticker,
      direction: input.direction,
      collateralUsd: String(roundUsd(input.amountUsd)),
      quantity: String(quantity),
      entryPrice: String(fillPrice),
      currentMarkPrice: String(fillPrice),
      currentValueUsd: String(roundUsd(input.amountUsd)),
      openedAt: now,
      updatedAt: now,
    }).returning();
    await tx.update(schema.paperAccounts).set({
      cashUsd: String(roundUsd(cash - input.amountUsd)),
      updatedAt: now,
    }).where(eq(schema.paperAccounts.id, input.accountId));
    return { orderId: order.id, position: serializePosition(position) };
  });
}

export async function closePaperPosition(accountId: string, positionId: string) {
  const [position] = await db.select().from(schema.paperPositions)
    .where(and(eq(schema.paperPositions.id, positionId), eq(schema.paperPositions.accountId, accountId)))
    .limit(1);
  if (!position) throw new Error('Paper position was not found');
  if (position.status !== 'open') throw new Error('Paper position is already closed');
  const mark = await liveCurrentPrice(await routeForPosition(position), position.direction);
  const value = positionValue(position, mark);
  const pnl = roundUsd(value - number(position.collateralUsd));
  const now = new Date();
  return db.transaction(async (tx) => {
    const [lockedPosition] = await tx.select().from(schema.paperPositions)
      .where(and(eq(schema.paperPositions.id, positionId), eq(schema.paperPositions.accountId, accountId)))
      .for('update').limit(1);
    if (!lockedPosition || lockedPosition.status !== 'open') throw new Error('Paper position is already closed');
    const [account] = await tx.select().from(schema.paperAccounts)
      .where(eq(schema.paperAccounts.id, accountId)).for('update').limit(1);
    if (!account) throw new Error('Paper account was not found');
    const [closed] = await tx.update(schema.paperPositions).set({
      status: 'closed',
      currentMarkPrice: String(mark),
      currentValueUsd: '0',
      unrealizedPnlUsd: '0',
      realizedPnlUsd: String(pnl),
      markError: null,
      closePrice: String(mark),
      closedAt: now,
      updatedAt: now,
    }).where(eq(schema.paperPositions.id, positionId)).returning();
    await tx.update(schema.paperAccounts).set({
      cashUsd: String(roundUsd(number(account.cashUsd) + value)),
      updatedAt: now,
    }).where(eq(schema.paperAccounts.id, accountId));
    return serializePosition(closed);
  });
}
