import { sql } from 'drizzle-orm';
import { db } from '../db/client';
let ready: Promise<unknown> | undefined;
function ensure() {
  return ready ??= db.execute(sql`CREATE TABLE IF NOT EXISTS cassie_trading_settings (user_id text PRIMARY KEY, settings jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`).catch(error => { ready = undefined; throw error; });
}
export async function readSettings(userId: string) {
  await ensure();
  const rows = await db.execute(sql`SELECT settings FROM cassie_trading_settings WHERE user_id = ${userId}`);
  return rows[0]?.settings ?? null;
}
export async function writeSettings(userId: string, settings: unknown) {
  await ensure();
  await db.execute(sql`INSERT INTO cassie_trading_settings (user_id, settings) VALUES (${userId}, ${JSON.stringify(settings)}::jsonb) ON CONFLICT (user_id) DO UPDATE SET settings = excluded.settings, updated_at = now()`);
}
