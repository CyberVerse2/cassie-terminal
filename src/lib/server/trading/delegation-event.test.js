import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyWebhook, parseDelegationEvent } from './delegation-event.js';

test('authenticates exact webhook bytes and rejects malformed signatures', () => {
  const raw = '{"eventName": "ping"}';
  const signature = `sha256=${createHmac('sha256', 'test-secret').update(raw).digest('hex')}`;
  assert.equal(verifyWebhook(raw, signature, 'test-secret'), true);
  assert.equal(verifyWebhook(raw.replace(' ', ''), signature, 'test-secret'), false);
  for (const bad of [null, '', 'sha256=0', 'sha256=' + 'z'.repeat(64)]) assert.equal(verifyWebhook(raw, bad, 'test-secret'), false);
  assert.equal(verifyWebhook(raw, signature, 'wrong-secret'), false);
});

test('rejects other environments and conflicting wallet ownership', () => {
  const event = { eventId:'event-1', environmentId:'cassie', userId:'user-1', timestamp:new Date().toISOString(), eventName:'wallet.delegation.revoked', data:{walletId:'wallet-1',userId:'user-1'} };
  const parsed = parseDelegationEvent(JSON.stringify(event), 'cassie');
  assert.equal(parsed.revoked, true);
  assert.equal(parsed.material, null);
  assert.throws(() => parseDelegationEvent(JSON.stringify(event), 'other-environment'));
  assert.throws(() => parseDelegationEvent(JSON.stringify({...event,data:{...event.data,userId:'other-user'}}), 'cassie'));
  assert.throws(() => parseDelegationEvent(JSON.stringify({...event,timestamp:'invalid'}), 'cassie'));
  assert.throws(() => parseDelegationEvent(JSON.stringify({...event,eventName:'wallet.delegation.created'}), 'cassie'));
  assert.equal(parseDelegationEvent('{"eventName":"ping"}', 'cassie'), null);
});
