import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashTypedData } from 'viem';
import { signerFailure, signingTransaction, signingTypedData } from './signing-transaction.js';

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
  assert.throws(
    () => signerFailure({ status: 400, message: 'Invalid request' }, 'order'),
    { message: 'Dynamic rejected the wallet signature. Cassie asked it to sign the trade order.' },
  );
});

test('gives Dynamic a viem FlashOrder instead of the quote JSON', () => {
  const signed = signingTypedData({
    primaryType: 'FlashOrder',
    types: { EIP712Domain: [], FlashOrder: [{ name: 'swapper', type: 'address' }] },
    domain: { name: 'DefinitiveFlashAllowance', version: '1', chainId: '8453', verifyingContract: '0x5d00000873b6bf41539e6f5365b0ff7d3c368f78' },
    message: {
      swapper: '0x1111111111111111111111111111111111111111',
      vault: '0x2222222222222222222222222222222222222222',
      recipient: '0x1111111111111111111111111111111111111111',
      fromToken: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
      toToken: '0x4200000000000000000000000000000000000006',
      fromAmount: '100000000',
      salt: '1',
      deadline: '1735689600',
    },
  });
  assert.equal(signed.domain.chainId, 8453);
  assert.equal(signed.message.fromAmount, 100000000n);
  assert.deepEqual(Object.keys(signed.types), ['FlashOrder']);
  assert.match(hashTypedData(signed), /^0x[0-9a-f]{64}$/);
});
