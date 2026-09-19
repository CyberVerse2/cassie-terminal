import { getWalletAccounts, onEvent, offEvent } from '@dynamic-labs-sdk/client';
import { createWaasWalletAccounts, isWaasWalletAccount, hasDelegatedAccess, revokeWaasDelegation, delegateWaasKeyShares } from '@dynamic-labs-sdk/client/waas';
import { dynamicClient } from '$lib/dynamic/client.js';
import { authHeaders } from '$lib/dynamic/auth.js';
import { authUi } from '$lib/auth-ui.svelte.js';
import { validateSettings } from './settings.js';
import { confirmWalletApproval } from './approval.js';
export const tradingSetup = $state({ userId:null, settings:null, loading:false, error:'', open:false, step:0, wallets:[], delegations:[], selectedWalletId:null, approvedWalletAddress:null, delegationAvailable:false, liveExecutionAvailable:false });
let generation=0, promptedUser=null;
export function refreshWallets() {
  tradingSetup.wallets=dynamicClient && dynamicClient.user ? getWalletAccounts().filter(wallet=>isWaasWalletAccount({walletAccount:wallet})).map(wallet=>({...wallet,delegated:hasDelegatedAccess({walletAccount:wallet})})) : [];
  return tradingSetup.wallets;
}
export function openSetup(step=0) { tradingSetup.step=step; tradingSetup.open=true; }
async function request(method='GET',body) {
  const response=await fetch('/api/trading/settings',{method,headers:{'content-type':'application/json',...authHeaders()},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(10000)});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not update settings.');return data;
}
export async function loadTradingSettings() {
  const version=++generation,userId=dynamicClient?.user?.id || null;
  if(userId!==tradingSetup.userId){Object.assign(tradingSetup,{userId,settings:null,error:'',open:false,delegations:[],selectedWalletId:null,approvedWalletAddress:null,delegationAvailable:false,liveExecutionAvailable:false});}
  refreshWallets();
  if(!userId){tradingSetup.loading=false;promptedUser=null;return;}
  tradingSetup.loading=true;
  try { const data=await request();if(version!==generation)return;Object.assign(tradingSetup,data,{error:''});if(!data.settings && promptedUser!==userId){promptedUser=userId;openSetup();} }
  catch(e){if(version===generation)tradingSetup.error=e.message;}
  finally{if(version===generation)tradingSetup.loading=false;}
}
export async function saveTradingSettings(input) {
  if(!dynamicClient?.user)throw new Error('Sign in to save these limits.');
  const owner=dynamicClient.user.id, data=await request('PUT',validateSettings(input));
  if(dynamicClient?.user?.id!==owner)throw new Error('Account changed. Reopen trading setup.');
  Object.assign(tradingSetup,data,{error:''});return data.settings;
}
export async function createTradingWallet(chain) {
  if(!dynamicClient?.user)throw new Error('Sign in before creating a wallet.');
  await createWaasWalletAccounts({chains:[chain]});refreshWallets();
}
export async function approveTradingAccess(input, walletId) {
  const owner=dynamicClient?.user?.id;
  if(!owner)throw new Error('Sign in to approve trading access.');
  await saveTradingSettings(input);
  refreshWallets();
  if(!tradingSetup.wallets.some(w=>w.chain==='EVM'))await createTradingWallet('EVM');
  const wallet=tradingSetup.wallets.find(w=>w.id===walletId&&w.chain==='EVM')||tradingSetup.wallets.find(w=>w.chain==='EVM');
  if(!wallet)throw new Error('Your trading wallet could not be created.');
  if(dynamicClient?.user?.id!==owner)throw new Error('Your account changed. Reopen trading setup.');
  const approved=await confirmWalletApproval({
    wallet,
    hasAccess:w=>hasDelegatedAccess({walletAccount:w}),
    delegate:async w=>{
      if(!tradingSetup.delegationAvailable)throw new Error('Cassie’s trading connection is unavailable. Your limits are saved; please try setup later.');
      await delegateWaasKeyShares({walletAccount:w});
    },
    refresh:refreshWallets,
    assertOwner:()=>{if(dynamicClient?.user?.id!==owner)throw new Error('Your account changed. Reopen trading setup.');},
  });
  tradingSetup.approvedWalletAddress=approved.address;
  // Refresh signing readiness independently; it is not an approval condition.
  void loadTradingSettings();
}
export async function revokeTradingAccess(wallet) {
  const delegation=tradingSetup.delegations.find(d=>d.address?.toLowerCase()===wallet.address.toLowerCase());
  if(delegation){const response=await fetch('/api/trading/delegation/pause',{method:'POST',headers:{'content-type':'application/json',...authHeaders()},body:JSON.stringify({walletId:delegation.walletId})});if(!response.ok)throw new Error('Could not pause trading. Try again.');}
  await revokeWaasDelegation({walletAccount:wallet});refreshWallets();await loadTradingSettings();
}
export function startTradingSetup() {
  loadTradingSettings();
  if(!dynamicClient)return ()=>{};
  onEvent({event:'userChanged',listener:loadTradingSettings});onEvent({event:'tokenChanged',listener:loadTradingSettings});onEvent({event:'walletAccountsChanged',listener:refreshWallets});
  return ()=>{generation++;offEvent({event:'userChanged',listener:loadTradingSettings});offEvent({event:'tokenChanged',listener:loadTradingSettings});offEvent({event:'walletAccountsChanged',listener:refreshWallets});};
}
export function beginSetup() { if(!authUi.user){authUi.openSignIn();return;}openSetup(tradingSetup.settings?2:0); }
