import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmWalletApproval, executionDelegation } from './approval.js';
const wallet={id:'sdk-id',address:'0xAbc',chain:'EVM',delegated:true};
test('an existing Dynamic approval succeeds without asking again or requiring a webhook',async()=>{
  const result=await confirmWalletApproval({wallet,hasAccess:()=>true,delegate:()=>assert.fail('Must not request approval again'),refresh:()=>[wallet],assertOwner:()=>{}});
  assert.equal(result,wallet);
  assert.equal(executionDelegation(wallet,{delegations:[],liveExecutionAvailable:true}),null);
});
test('a newly approved wallet is checked against refreshed Dynamic state',async()=>{
  let approved=false;
  const result=await confirmWalletApproval({wallet,hasAccess:()=>approved,delegate:async()=>{approved=true;},refresh:()=>[wallet],assertOwner:()=>{}});
  assert.equal(result,wallet);
});
test('SDK completion without delegated access does not report approval',async()=>{
  await assert.rejects(confirmWalletApproval({wallet,hasAccess:()=>false,delegate:async()=>{},refresh:()=>[wallet],assertOwner:()=>{}}),/not confirmed/);
});
test('rejected consent and an account switch cannot complete approval',async()=>{
  await assert.rejects(confirmWalletApproval({wallet,hasAccess:()=>false,delegate:async()=>{throw Error('Cancelled');},refresh:()=>[wallet],assertOwner:()=>{}}),/Cancelled/);
  let changed=false;
  await assert.rejects(confirmWalletApproval({wallet,hasAccess:()=>false,delegate:async()=>{changed=true;},refresh:()=>[wallet],assertOwner:()=>{if(changed)throw Error('Account changed');}}),/Account changed/);
});
test('execution requires both approval and a matching active server delegation',()=>{
  const delegation={walletId:'server-id',address:'0xabc',chain:'EVM',revoked:false};
  const state={delegations:[delegation],liveExecutionAvailable:true};
  assert.equal(executionDelegation(wallet,state),delegation);
  assert.equal(executionDelegation({...wallet,delegated:false},state),null);
  assert.equal(executionDelegation(wallet,{...state,error:'Unavailable'}),null);
  assert.equal(executionDelegation(wallet,{...state,liveExecutionAvailable:false}),null);
  assert.equal(executionDelegation(wallet,{...state,delegations:[{...delegation,revoked:true}]}),null);
  assert.equal(executionDelegation(wallet,{...state,delegations:[{...delegation,address:'0xdef'}]}),null);
});
