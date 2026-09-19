import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhook(raw, signature, secret) {
  if (!secret || typeof signature !== 'string' || !/^sha256=[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature.toLowerCase()));
}

export function parseDelegationEvent(raw, environmentId) {
  const event = JSON.parse(raw);
  if (event.eventName === 'ping') return null;
  if (!['wallet.delegation.created', 'wallet.delegation.revoked'].includes(event.eventName)) throw new Error('Unsupported event');
  if (!environmentId || event.environmentId !== environmentId) throw new Error('Wrong environment');
  const data = event.data;
  const userId = event.userId || data?.userId;
  if (!userId || (event.userId && data?.userId && event.userId !== data.userId)) throw new Error('Invalid owner');
  for (const id of [event.eventId, userId, data?.walletId]) if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error('Invalid identifier');
  const timestamp = Date.parse(event.timestamp);
  if (!Number.isFinite(timestamp) || timestamp > Date.now() + 300000) throw new Error('Invalid timestamp');
  const revoked = event.eventName === 'wallet.delegation.revoked';
  if (!revoked) {
    if (!['EVM', 'SOL'].includes(data.chain) || typeof data.publicKey !== 'string' || data.publicKey.length > 200) throw new Error('Invalid wallet');
    for (const encrypted of [data.encryptedDelegatedShare, data.encryptedWalletApiKey]) {
      if (encrypted?.alg !== 'HYBRID-RSA-AES-256') throw new Error('Unsupported encryption');
      for (const key of ['iv', 'ct', 'tag', 'ek']) if (typeof encrypted[key] !== 'string' || !/^[A-Za-z0-9_+/=-]+$/.test(encrypted[key])) throw new Error('Invalid encrypted material');
    }
  }
  return { eventId: event.eventId, userId, walletId: data.walletId, timestamp: new Date(timestamp), revoked, material: revoked ? null : { chain: data.chain, publicKey: data.publicKey, encryptedDelegatedShare: data.encryptedDelegatedShare, encryptedWalletApiKey: data.encryptedWalletApiKey } };
}
