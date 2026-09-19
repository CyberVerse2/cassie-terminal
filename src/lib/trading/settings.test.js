import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSettings, dollarLevel, estimateOutcome } from './settings.js';

test('validates allocations and position limits before saving', () => {
  assert.deepEqual(validateSettings({ amountUsd: '200', maxDeployedUsd: 1000, maxPositions: 3 }), { amountUsd: 200, maxDeployedUsd: 1000, maxPositions: 3 });
  for (const input of [null, [], {}, { amountUsd: 200, maxDeployedUsd: 100, maxPositions: 3 }, { amountUsd: 1.001, maxDeployedUsd: 100, maxPositions: 3 }, { amountUsd: 100, maxDeployedUsd: Infinity, maxPositions: 3 }, { amountUsd: 100, maxDeployedUsd: 100, maxPositions: 1.5 }]) {
    assert.throws(() => validateSettings(input));
  }
});

test('never turns research prose or percentages into asset prices', () => {
  assert.equal(dollarLevel('$1,234.56 USD'), 1234.56);
  for (const text of ['SOXX above 13,000', '20%', '$100–$120', 'target $200 if SPX reaches 6000', '-100', '$1,00', '', '0']) assert.equal(dollarLevel(text), null);
});

test('estimates long cash positions using saved allocation', () => {
  const plan = { instrument: 'spot', side: 'long', entryPrice: 100, target: '$125', stop: '$90' };
  assert.equal(estimateOutcome(plan, 200, 'target').pnl, 50);
  assert.ok(Math.abs(estimateOutcome(plan, 200, 'stop').pnl + 20) < 1e-10);
  assert.equal(estimateOutcome(plan, 400, 'target').pnl, 100);
  for (const change of [{ instrument: 'perp' }, { side: 'short' }, { entryPrice: 0 }, { target: '20%' }, { target: '$90' }]) assert.equal(estimateOutcome({ ...plan, ...change }, 200, 'target'), null);
  assert.equal(estimateOutcome(plan, undefined, 'target'), null);
  assert.equal(estimateOutcome(plan, 200, 'unknown'), null);
  assert.equal(estimateOutcome({ ...plan, stop: '$110' }, 200, 'stop'), null);
});
