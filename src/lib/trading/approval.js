// Approval is Dynamic's state. Server credential delivery is a separate state
// and must never delay or determine the result of the wallet approval step.
export async function confirmWalletApproval({ wallet, hasAccess, delegate, refresh, assertOwner }) {
  assertOwner();
  if (!hasAccess(wallet)) await delegate(wallet);
  assertOwner();
  const current = refresh().find(w => w.id === wallet.id);
  if (!current || !hasAccess(current)) throw new Error('Dynamic has not confirmed wallet approval. Your permissions have not been confirmed.');
  return current;
}

export function executionDelegation(wallet, state) {
  if (!wallet?.delegated || !state.liveExecutionAvailable || state.error) return null;
  const rows = Array.isArray(state.delegations) ? state.delegations : [];
  return rows.find(d => !d.revoked && d.chain === wallet.chain && d.address?.toLowerCase() === wallet.address.toLowerCase()) ?? null;
}

export function connectionCheckMessage(wallet, state) {
  if (executionDelegation(wallet, state)) return null;
  if (!state.liveExecutionAvailable) return 'Cassie cannot sign yet. The execution service is not live on this server.';
  const rows = Array.isArray(state.delegations) ? state.delegations : [];
  if (!rows.some(d => !d.revoked)) return 'Cassie has your wallet approval, but the server has not received the trading key. Dynamic must deliver the delegation webhook, then check again.';
  return 'Cassie has a trading key, but it does not match this wallet.';
}
