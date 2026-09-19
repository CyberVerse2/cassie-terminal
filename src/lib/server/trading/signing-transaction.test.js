import assert from 'node:assert/strict';
import { test } from 'node:test';
import { signerFailure, signingTransaction } from './signing-transaction.js';

test('keeps only the Base eip1559 fields Dynamic can sign', () => {
  const signed = signingTransaction({
    account: '0x1111111111111111111111111111111111111111',
    from: '0x1111111111111111111111111111111111111111',
    to: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    data: '0x095ea7b3',
    value: 0n,
    nonce: 0,
    gas: 46000n,
    maxFeePerGas: 7n,
    maxPriorityFeePerGas: 1n,
    type: 'eip1559',
  }, 8453);
  assert.deepEqual(Object.keys(signed).sort(), [
    'chainId', 'data', 'gas', 'maxFeePerGas', 'maxPriorityFeePerGas', 'nonce', 'to', 'type', 'value',
  ]);
  assert.equal(signed.chainId, 8453);
  assert.equal(signed.nonce, 0);
  assert.equal(signed.value, 0n);
});

test('names a Dynamic 400 instead of Invalid request', () => {
  assert.throws(
    () => signerFailure({ status: 400, message: 'Invalid request' }),
    { message: 'Dynamic rejected the wallet signature. Cassie asked it to sign a Base token approval.' },
  );
});
