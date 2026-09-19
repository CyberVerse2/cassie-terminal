import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { decryptDelegatedWebhookData } from '@dynamic-labs-wallet/node';
import { verifyWebhook, parseDelegationEvent } from '$lib/server/trading/delegation-event.js';
import { storeDelegationEvent } from '$lib/server/trading/delegations';

const headers = { 'cache-control': 'no-store' };
export async function POST({ request }) {
  const secret = env.DYNAMIC_WEBHOOK_SECRET;
  const privateKey = env.DYNAMIC_DELEGATION_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!secret || !privateKey) return json({ error: 'Webhook is not configured.' }, { status: 503, headers });
  const reader = request.body?.getReader();
  if (!reader) return json({ error: 'Missing body.' }, { status: 400, headers });
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 65536) { await reader.cancel(); return json({ error: 'Body too large.' }, { status: 413, headers }); }
      chunks.push(value);
    }
  } catch { return json({ error: 'Invalid body.' }, { status: 400, headers }); }
  const raw = Buffer.concat(chunks);
  if (!verifyWebhook(raw, request.headers.get('x-dynamic-signature-256'), secret)) return json({ error: 'Invalid signature.' }, { status: 401, headers });
  let event;
  try {
    event = parseDelegationEvent(raw.toString('utf8'), publicEnv.PUBLIC_DYNAMIC_ENVIRONMENT_ID);
    if (event?.material) decryptDelegatedWebhookData({
      privateKeyPem: privateKey,
      encryptedDelegatedKeyShare: event.material.encryptedDelegatedShare,
      encryptedWalletApiKey: event.material.encryptedWalletApiKey,
    });
  } catch { return json({ error: 'Invalid delegation event.' }, { status: 400, headers }); }
  try {
    if (event) await storeDelegationEvent(event);
    return json({ received: true }, { headers });
  } catch { return json({ error: 'Delegation could not be stored. Retry delivery.' }, { status: 503, headers }); }
}
