import test from 'node:test';
import assert from 'node:assert/strict';
import { entryInRange, managementDecision, publishableRoute, validatedPlan } from './plan.js';

const asset = { chain: 'base', address: '0x4200000000000000000000000000000000000006' };
const now = Date.parse('2026-09-19T12:00:00Z');
const plan = {
  version: 1,
  basis: 'cassie',
  priceBasis: 'token',
  assetKey: 'base:0x4200000000000000000000000000000000000006',
  expiresAt: '2026-09-26T12:00:00Z',
  entryPrice: 100,
  stopPrice: 90,
  targets: [{ price: 110, percent: 40 }, { price: 120, percent: 60 }],
  trailingStopPct: 10,
  breakevenAtPct: 8,
};

test('accepts an asset-specific Cassie plan and rejects expired or mismatched plans', () => {
  assert.equal(validatedPlan(plan, asset, now), plan);
  assert.throws(() => validatedPlan({ ...plan, expiresAt: '2026-09-19T11:00:00Z' }, asset, now), /expired/);
  assert.throws(() => validatedPlan({ ...plan, assetKey: 'arbitrum:0x4200000000000000000000000000000000000006' }, asset, now));
  assert.throws(() => validatedPlan({ ...plan, targets: [{ price: 110, percent: 40 }] }, asset, now));
  assert.throws(() => validatedPlan({ ...plan, stopPrice: 110 }, asset, now));
});

test('rejects a quote when the live price is already through the stop or first target', () => {
  assert.equal(entryInRange(100, plan), true);
  assert.equal(entryInRange(90, plan), false);
  assert.equal(entryInRange(110, plan), false);
});

test('publishes only an unexpired Definitive plan on a supported spot route', () => {
  const route = { status: 'routed', venue: 'definitive', instrument: 'spot', marketMeta: { executionPlan: plan } };
  assert.equal(publishableRoute(route, now), true);
  assert.equal(publishableRoute({ ...route, venue: 'hyperliquid' }, now), false);
  assert.equal(publishableRoute({ ...route, instrument: 'perp' }, now), false);
  assert.equal(publishableRoute({ ...route, marketMeta: { executionPlan: { ...plan, expiresAt: '2026-09-19T11:00:00Z' } } }, now), false);
});

test('closes at the stop or at expiry and never repeats a completed target', () => {
  const open = { completedTargets: [], stopPrice: 90, entryPrice: 100, highWater: 100 };
  assert.deepEqual(managementDecision(plan, open, 90, now), { type: 'close', key: 'stop', reason: 'Protective stop reached.' });
  assert.equal(managementDecision(plan, open, 100, Date.parse(plan.expiresAt)).key, 'expiry');
  const first = managementDecision(plan, open, 110, now);
  assert.deepEqual(first, { type: 'reduce', key: 'target-0', index: 0, percent: 40, reason: 'Profit target 1 reached.' });
  assert.equal(managementDecision({ ...plan, trailingStopPct: 0, breakevenAtPct: 0 }, { ...open, completedTargets: [0] }, 110, now), null);
  assert.equal(managementDecision(plan, { ...open, completedTargets: [0] }, 120, now).key, 'target-1');
});

test('tightens protection and never lowers the stop', () => {
  const state = { completedTargets: [], stopPrice: 90, entryPrice: 100, highWater: 100 };
  const trail = managementDecision(plan, state, 108, now);
  assert.equal(trail.type, 'tighten');
  assert.ok(trail.price > 90 && trail.price < 108);
  assert.equal(managementDecision({ ...plan, trailingStopPct: 0, breakevenAtPct: 0 }, state, 108, now), null);
});
