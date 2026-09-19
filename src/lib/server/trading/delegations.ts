import { sql } from 'drizzle-orm';
import { db } from '../db/client';
let ready: Promise<unknown> | undefined;
function ensure() {
  return ready ??= db.execute(sql`CREATE TABLE IF NOT EXISTS cassie_wallet_delegations (
    wallet_id text PRIMARY KEY,
    user_id text NOT NULL,
    event_id text NOT NULL,
    event_at timestamptz NOT NULL,
    revoked boolean NOT NULL,
    encrypted_material jsonb
  )`).catch(error => { ready = undefined; throw error; });
}

export async function delegationStatus(userId: string) {
  await ensure();
  return db.execute(sql`SELECT wallet_id AS "walletId", revoked,
    encrypted_material->>'publicKey' AS address,
    encrypted_material->>'chain' AS chain
    FROM cassie_wallet_delegations WHERE user_id = ${userId}`);
}

export async function readDelegation(userId: string, walletId: string) {
  await ensure();
  const rows = await db.execute(sql`SELECT encrypted_material FROM cassie_wallet_delegations
    WHERE user_id = ${userId} AND wallet_id = ${walletId} AND NOT revoked`);
  return rows[0]?.encrypted_material ?? null;
}

export async function pauseDelegation(userId: string, walletId: string) {
  await ensure();
  await db.execute(sql`UPDATE cassie_wallet_delegations SET revoked = true,
    encrypted_material = null, event_at = now(), event_id = ${crypto.randomUUID()}
    WHERE user_id = ${userId} AND wallet_id = ${walletId}`);
}

// Retain a revocation tombstone so delayed/replayed creation events cannot
// restore revoked credentials. Only original RSA-encrypted material is stored.
export async function storeDelegationEvent(event: { walletId: string; userId: string; eventId: string; timestamp: Date; revoked: boolean; material: unknown }) {
  await ensure();
  await db.execute(sql`INSERT INTO cassie_wallet_delegations
    (wallet_id, user_id, event_id, event_at, revoked, encrypted_material)
    VALUES (${event.walletId}, ${event.userId}, ${event.eventId}, ${event.timestamp.toISOString()}::timestamptz, ${event.revoked}, ${event.material ? JSON.stringify(event.material) : null}::jsonb)
    ON CONFLICT (wallet_id) DO UPDATE SET
      event_id = excluded.event_id, event_at = excluded.event_at,
      revoked = excluded.revoked, encrypted_material = excluded.encrypted_material
    WHERE cassie_wallet_delegations.user_id = excluded.user_id
      AND cassie_wallet_delegations.event_id <> excluded.event_id
      AND (excluded.event_at > cassie_wallet_delegations.event_at
        OR (excluded.event_at = cassie_wallet_delegations.event_at AND excluded.revoked))`);
}
