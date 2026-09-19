import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeQuote,BASE_USDC,FLASH_ALLOWANCE} from './authorization.js';
const intent={asset:'0x4200000000000000000000000000000000000006',address:'0x1111111111111111111111111111111111111111',amount:'100',decimals:18};
function fixture(){
  const entry={primaryType:'FlashOrder',domain:{name:'DefinitiveFlashAllowance',version:'1',chainId:'8453',verifyingContract:FLASH_ALLOWANCE},types:{FlashOrder:[['swapper','address'],['vault','address'],['recipient','address'],['fromToken','address'],['toToken','address'],['fromAmount','uint256'],['salt','uint256'],['deadline','uint256']].map(([name,type])=>({name,type}))},message:{swapper:intent.address,recipient:intent.address,vault:'0x2222222222222222222222222222222222222222',fromToken:BASE_USDC,toToken:intent.asset,fromAmount:'100000000',salt:'1',deadline:String(Math.floor(Date.now()/1000)+300)}};
  const exit=structuredClone(entry);Object.assign(exit.message,{fromToken:intent.asset,toToken:BASE_USDC,fromAmount:'105000000000000000',salt:'2',deadline:'281474976710655'});
  return {orderType:'market',side:'buy',targetAsset:intent.asset,contraAsset:BASE_USDC,from:{asset:'contra',amount:'100'},to:{amount:'0.1'},evm:{orderTypedData:JSON.stringify(entry)},attachedBracket:{signedMaxFromAmount:'0.105',salt:'2',deadline:exit.message.deadline,evm:{orderTypedData:JSON.stringify(exit)}}};
}
function change(q,section,fn){const data=JSON.parse(section==='entry'?q.evm.orderTypedData:q.attachedBracket.evm.orderTypedData);fn(data);(section==='entry'?q.evm:q.attachedBracket.evm).orderTypedData=JSON.stringify(data);}
test('accepts a bounded entry and matching protective exit',()=>assert.ok(authorizeQuote(fixture(),intent).exit));
for(const [name,section,mutate] of [
  ['redirected recipient','entry',d=>d.message.recipient='0x3333333333333333333333333333333333333333'],
  ['wrong chain','entry',d=>d.domain.chainId='1'],
  ['larger spend','entry',d=>d.message.fromAmount='101000000'],
  ['unrelated token','exit',d=>d.message.fromToken=BASE_USDC],
  ['expired quote','entry',d=>d.message.deadline='1'],
  ['changed signing schema','entry',d=>d.types.FlashOrder[0].type='bytes32'],
  ['different vault','exit',d=>d.message.vault='0x3333333333333333333333333333333333333333'],
])test(`rejects ${name}`,()=>{const q=fixture();change(q,section,mutate);assert.throws(()=>authorizeQuote(q,intent));});
test('rejects an oversized exit authorization even when payload and metadata agree',()=>{const q=fixture();q.attachedBracket.signedMaxFromAmount='1';change(q,'exit',d=>d.message.fromAmount='1000000000000000000');assert.throws(()=>authorizeQuote(q,intent));});
test('rejects unexpected Permit2 signing',()=>{const q=fixture();q.evm.permitTypedData='{}';assert.throws(()=>authorizeQuote(q,intent));});
