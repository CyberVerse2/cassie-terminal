import test from 'node:test';
import assert from 'node:assert/strict';
import { connectionFromDynamic, dynamicGrant, matchDynamicWallet, walletQuery } from './dynamic-connection.js';

test('accepts an SDK account id and still reads the 0x address', () => {
  const query = walletQuery({ address: '0xAbcdefabcdefabcdefabcdefabcdefabcdefabcd', walletId: 'embeddedwalletdynamicwaasevm:0xabcdefabcdefabcdefabcdefabcdefabcdefabcd', chain: 'ETH' });
  assert.equal(query.address, '0xAbcdefabcdefabcdefabcdefabcdefabcdefabcd');
  assert.equal(query.walletId, '');
  assert.equal(query.chain, 'EVM');
});

const address = '0xAbc';
const wallet = { id: 'wallet-1', publicKey: '0xabc', properties: { otherShareSets: [{ shareSetType: 'delegated' }] } };

test('matches a Dynamic wallet by id then address', () => {
  assert.equal(matchDynamicWallet([wallet], { address, walletId: 'wallet-1' }), wallet);
  assert.equal(matchDynamicWallet([wallet], { address, walletId: '' }), wallet);
  assert.equal(matchDynamicWallet([wallet], { address: '0xdef', walletId: '' }), null);
});

test('reads a Dynamic grant from a delegated share set or active key', () => {
  assert.deepEqual(dynamicGrant(null), { found: false, granted: false, denied: false });
  assert.deepEqual(dynamicGrant(wallet), { found: true, granted: true, denied: false });
  assert.deepEqual(dynamicGrant({ publicKey: address, properties: { settings: { hasDeniedDelegatedAccess: true } } }), { found: true, granted: false, denied: true });
  assert.deepEqual(dynamicGrant({ publicKey: address, delegatedAccessWalletApiKeys: [{ deletedAt: null }] }), { found: true, granted: true, denied: false });
});

test('explains Cassie readiness from Dynamic and the stored key', () => {
  const granted = { found: true, granted: true, denied: false };
  assert.equal(connectionFromDynamic({ liveExecutionAvailable: true, cassieReady: true, grant: granted }).ready, true);
  assert.equal(connectionFromDynamic({ liveExecutionAvailable: false, cassieReady: false, grant: granted }).message, 'Cassie cannot sign yet. The execution service is not live on this server.');
  assert.equal(connectionFromDynamic({ liveExecutionAvailable: true, cassieReady: false, grant: granted }).message, 'Dynamic has the grant. Cassie still does not have the trading key on this server.');
  assert.equal(connectionFromDynamic({ liveExecutionAvailable: true, cassieReady: false, grant: { found: true, granted: false, denied: false } }).message, 'Dynamic has not granted Cassie a trading key for this wallet.');
  assert.equal(connectionFromDynamic({ liveExecutionAvailable: true, cassieReady: false, grant: { found: false, granted: false, denied: false } }).message, 'Dynamic has no wallet that matches this address.');
});
