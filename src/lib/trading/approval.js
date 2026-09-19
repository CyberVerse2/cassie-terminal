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
  return state.delegations.find(d => !d.revoked && d.chain === wallet.chain && d.address?.toLowerCase() === wallet.address.toLowerCase()) ?? null;
}
