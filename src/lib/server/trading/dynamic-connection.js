const ADDRESS = /^[A-Za-z0-9_-]{18,100}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function walletQuery(params) {
  const rawAddress = String(params?.address ?? '');
  const evm = rawAddress.match(/0x[a-fA-F0-9]{40}/);
  const address = evm?.[0] ?? (ADDRESS.test(rawAddress) ? rawAddress : '');
  const rawId = String(params?.walletId ?? '');
  return { address, walletId: UUID.test(rawId) ? rawId : '', chain: params?.chain === 'SOL' ? 'SOL' : 'EVM' };
}

export function matchDynamicWallet(wallets, { address, walletId }) {
  const listed = Array.isArray(wallets) ? wallets : [];
  const id = typeof walletId === 'string' ? walletId : '';
  const addr = typeof address === 'string' ? address.toLowerCase() : '';
  return listed.find(w => id && w?.id === id) ?? listed.find(w => typeof w?.publicKey === 'string' && w.publicKey.toLowerCase() === addr) ?? null;
}

export function dynamicGrant(wallet) {
  if (!wallet) return { found: false, granted: false, denied: false };
  const props = wallet.properties && typeof wallet.properties === 'object' ? wallet.properties : {};
  const settings = props.settings && typeof props.settings === 'object' ? props.settings : {};
  const sets = [props.shareSetType, ...(Array.isArray(props.otherShareSets) ? props.otherShareSets : []).map(set => set?.shareSetType)];
  const keys = Array.isArray(wallet.delegatedAccessWalletApiKeys) ? wallet.delegatedAccessWalletApiKeys : [];
  const activeKey = keys.some(key => key && !key.deletedAt && !key.revokedAt);
  return {
    found: true,
    granted: sets.includes('delegated') || activeKey,
    denied: Boolean(settings.hasDeniedDelegatedAccess),
  };
}

export function connectionFromDynamic({ liveExecutionAvailable, cassieReady, grant }) {
  if (cassieReady && liveExecutionAvailable) return { ready: true, message: 'Cassie’s trading connection is ready.' };
  if (!liveExecutionAvailable) return { ready: false, message: 'Cassie cannot sign yet. The execution service is not live on this server.' };
  if (!grant.found) return { ready: false, message: 'Dynamic has no wallet that matches this address.' };
  if (grant.denied) return { ready: false, message: 'This wallet has denied trading access in Dynamic.' };
  if (grant.granted) return { ready: false, message: 'Dynamic has the grant. Cassie still does not have the trading key on this server.' };
  return { ready: false, message: 'Dynamic has not granted Cassie a trading key for this wallet.' };
}
