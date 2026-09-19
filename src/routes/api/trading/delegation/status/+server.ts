import { json } from '@sveltejs/kit';
import { verifyDynamicToken } from '$lib/server/dynamic-auth';
import { tradingCapabilities } from '$lib/server/trading/capabilities';
import { delegationStatus } from '$lib/server/trading/delegations';
import { connectionFromDynamic, dynamicGrant, matchDynamicWallet, walletQuery } from '$lib/server/trading/dynamic-connection.js';
import { fetchUserWallets } from '$lib/server/trading/dynamic-wallets';

const headers = { 'cache-control': 'no-store' };

export async function GET({ request, url }) {
  const user = await verifyDynamicToken(request);
  if (!user) return json({ error: 'Sign in to check trading connection.' }, { status: 401, headers });
  const { address, walletId, chain } = walletQuery({
    address: url.searchParams.get('address'),
    walletId: url.searchParams.get('walletId'),
    chain: url.searchParams.get('chain'),
  });
  if (!address) {
    return json({ error: 'Invalid wallet.' }, { status: 400, headers });
  }
  const { liveExecutionAvailable } = tradingCapabilities();
  const cassie = (await delegationStatus(user.userId)).find(row =>
    !row.revoked && row.chain === chain && typeof row.address === 'string' && row.address.toLowerCase() === address.toLowerCase(),
  );
  let grant = { found: false, granted: false, denied: false };
  try {
    grant = dynamicGrant(matchDynamicWallet(await fetchUserWallets(user.userId), { address, walletId }));
  } catch {
    if (cassie && liveExecutionAvailable) return json({ ready: true, message: 'Cassie’s trading connection is ready.' }, { headers });
    return json({ error: 'Cassie could not read this wallet from Dynamic. Try again.' }, { status: 503, headers });
  }
  return json(connectionFromDynamic({ liveExecutionAvailable, cassieReady: Boolean(cassie), grant }), { headers });
}
