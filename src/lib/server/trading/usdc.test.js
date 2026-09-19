import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_USDC } from './authorization.js';
import { BASE_USDC_MARKET, evmUsdcCash, requireUsdc, usdcAmount } from './usdc.js';

const ARB_USDC = { chain: 'arbitrum', address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831', decimals: 6 };
const wallet = '0x1111111111111111111111111111111111111111';
const row = (chain, address, balance, extra = {}) => ({ chain, address, balance, walletAddress: wallet, ...extra });

test('reads USDC on the destination chain, not only Base', () => {
  const balances = [
    row('arbitrum', ARB_USDC.address, '80', { symbol: 'USDC', notional: 80 }),
    row('base', BASE_USDC, '25', { symbol: 'USDC', notional: 25 }),
    row('solana', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', '999', { symbol: 'USDC' }),
  ];
  assert.equal(usdcAmount(balances, ARB_USDC), 80);
  assert.equal(usdcAmount(balances, BASE_USDC_MARKET), 25);
  assert.equal(evmUsdcCash(balances), 105);
});

test('accepts a Base trade when Base USDC covers the allocation', () => {
  assert.deepEqual(requireUsdc([row('base', BASE_USDC, '200')], 200, BASE_USDC_MARKET), { dest: 200, base: 200 });
});

test('accepts a cross-chain trade when destination USDC and Base USDC both cover the allocation', () => {
  const balances = [row('arbitrum', ARB_USDC.address, '200'), row('base', BASE_USDC, '200')];
  assert.deepEqual(requireUsdc(balances, 150, ARB_USDC), { dest: 200, base: 200 });
});

test('accepts a cross-chain trade funded from Base when destination USDC is short', () => {
  const balances = [row('arbitrum', ARB_USDC.address, '20'), row('base', BASE_USDC, '200')];
  assert.deepEqual(requireUsdc(balances, 150, ARB_USDC), { dest: 20, base: 200 });
});

test('rejects a cross-chain trade that has destination USDC but no Base USDC to spend', () => {
  assert.throws(
    () => requireUsdc([row('arbitrum', ARB_USDC.address, '200')], 150, ARB_USDC),
    /Base/,
  );
});

test('rejects when neither destination USDC nor Base USDC covers the allocation', () => {
  assert.throws(
    () => requireUsdc([row('arbitrum', ARB_USDC.address, '20'), row('base', BASE_USDC, '20')], 150, ARB_USDC),
    /arbitrum or Base/,
  );
});

test('rejects an unverified settlement market', () => {
  assert.throws(() => requireUsdc([], 100, { chain: 'arbitrum', address: 'not-an-address' }), /verified USDC/);
});
