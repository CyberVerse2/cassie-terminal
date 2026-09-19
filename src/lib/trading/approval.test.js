import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmWalletApproval, connectionCheckMessage, executionDelegation } from './approval.js';
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
  assert.equal(executionDelegation(wallet,{...state,delegations:null}),null);
});
test('check message explains a missing server trading key',()=>{
  const wallet={id:'sdk-id',address:'0xAbc',chain:'EVM',delegated:true};
  assert.equal(connectionCheckMessage(wallet,{delegations:[],liveExecutionAvailable:true}), 'Cassie has your wallet approval, but the server has not received the trading key. Dynamic must deliver the delegation webhook, then check again.');
  assert.equal(connectionCheckMessage(wallet,{delegations:[],liveExecutionAvailable:false}), 'Cassie cannot sign yet. The execution service is not live on this server.');
  assert.equal(connectionCheckMessage(wallet,{delegations:[{walletId:'server-id',address:'0xabc',chain:'EVM',revoked:false}],liveExecutionAvailable:true}), null);
});
