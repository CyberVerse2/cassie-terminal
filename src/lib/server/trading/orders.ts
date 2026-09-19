import { sql } from 'drizzle-orm';
import { db } from '../db/client';
let ready: Promise<unknown> | undefined;
export function ensureOrders() {
  return ready ??= db.execute(sql`CREATE TABLE IF NOT EXISTS cassie_live_orders (
    id uuid PRIMARY KEY, user_id text NOT NULL, wallet_id text NOT NULL, idea_id uuid NOT NULL,
    asset text NOT NULL, amount numeric NOT NULL CHECK(amount>0), status text NOT NULL,
    intent jsonb NOT NULL, provider_order_id text, provider_result jsonb,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
  )`).catch(e=>{ready=undefined;throw e;});
}
export async function reserveOrder(userId:string, walletId:string, ideaId:string, intent:any) {
  await ensureOrders();
  return db.transaction(async tx=>{
    const settings=await tx.execute(sql`SELECT settings FROM cassie_trading_settings WHERE user_id=${userId} FOR UPDATE`);
    const limits=settings[0]?.settings as any;
    if(!limits)throw new Error('Choose your trading limits first.');
    const active=await tx.execute(sql`SELECT id,asset,amount FROM cassie_live_orders WHERE user_id=${userId} AND status NOT IN ('closed','rejected')`);
    if(active.some(o=>o.asset===intent.asset))throw new Error('Cassie already has an open or pending trade for this asset.');
    if(active.length>=limits.maxPositions || active.reduce((sum,o)=>sum+Number(o.amount),0)+Number(intent.amount)>limits.maxDeployedUsd || Number(intent.amount)!==limits.amountUsd)throw new Error('This trade exceeds your saved limits.');
    const delegated=await tx.execute(sql`SELECT wallet_id FROM cassie_wallet_delegations WHERE user_id=${userId} AND wallet_id=${walletId} AND NOT revoked`);
    if(!delegated.length)throw new Error('Trading permission is no longer active.');
    const id=crypto.randomUUID();
    await tx.execute(sql`INSERT INTO cassie_live_orders(id,user_id,wallet_id,idea_id,asset,amount,status,intent) VALUES(${id},${userId},${walletId},${ideaId},${intent.asset},${intent.amount},'reserved',${JSON.stringify(intent)}::jsonb)`);
    return id;
  });
}
export async function updateOrder(id:string,status:string,result:unknown,providerId:string|null=null) {
  await db.execute(sql`UPDATE cassie_live_orders SET status=${status}, provider_result=${JSON.stringify(result)}::jsonb,
    provider_order_id=COALESCE(${providerId},provider_order_id),updated_at=now() WHERE id=${id}`);
}
export async function listOrders(userId:string) {
  await ensureOrders();
  return db.execute(sql`SELECT id,idea_id AS "ideaId",amount,status,asset,intent->>'address' AS address,
    intent->>'ticker' AS ticker,provider_order_id AS "providerOrderId",provider_result AS result
    FROM cassie_live_orders WHERE user_id=${userId} ORDER BY created_at DESC LIMIT 100`);
}
