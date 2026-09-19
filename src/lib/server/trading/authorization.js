import { parseUnits } from 'viem';
export const FLASH_ALLOWANCE = '0x5d00000873b6bf41539e6f5365b0ff7d3c368f78';
export const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const same = (a,b) => typeof a==='string' && typeof b==='string' && a.toLowerCase()===b.toLowerCase();
const fields=[['swapper','address'],['vault','address'],['recipient','address'],['fromToken','address'],['toToken','address'],['fromAmount','uint256'],['salt','uint256'],['deadline','uint256']];

// The signer accepts only a provider quote bound to an existing reservation.
// It never accepts raw signing payloads supplied by a browser or an agent.
export function authorizeQuote(quote, intent) {
  if (quote.orderType!=='market' || quote.side!=='buy' || !same(quote.targetAsset,intent.asset) || !same(quote.contraAsset,BASE_USDC)) throw new Error('Trade quote does not match the approved asset.');
  if (quote.from?.asset!=='contra' || quote.from.amount!==intent.amount || !(Number(quote.to?.amount)>0)) throw new Error('Trade quote does not match the approved amount.');
  if (!quote.attachedBracket?.evm?.orderTypedData || !quote.evm?.orderTypedData || quote.evm.permitTypedData || quote.attachedBracket.evm.permitTypedData) throw new Error('Unsupported signing path.');
  const entry=JSON.parse(quote.evm.orderTypedData), exit=JSON.parse(quote.attachedBracket.evm.orderTypedData);
  for (const [data,isExit] of [[entry,false],[exit,true]]) {
    const m=data.message, d=data.domain;
    if(JSON.stringify(data.types?.FlashOrder?.map(f=>[f.name,f.type]))!==JSON.stringify(fields))throw new Error('Unexpected order signing schema.');
    if (data.primaryType!=='FlashOrder' || d?.name!=='DefinitiveFlashAllowance' || d.version!=='1' || Number(d.chainId)!==8453 || !same(d.verifyingContract,FLASH_ALLOWANCE)) throw new Error('Unexpected signing domain.');
    if (!same(m?.swapper,intent.address) || !same(m.recipient,intent.address)) throw new Error('Trade recipients do not match your wallet.');
    if(!/^0x[a-f0-9]{40}$/i.test(m.vault)||/^0x0{40}$/i.test(m.vault))throw new Error('Invalid execution vault.');
    if (!same(m.fromToken,isExit?intent.asset:BASE_USDC) || !same(m.toToken,isExit?BASE_USDC:intent.asset)) throw new Error('Unexpected token transfer.');
    const expected=isExit?parseUnits(quote.attachedBracket.signedMaxFromAmount,intent.decimals):parseUnits(intent.amount,6);
    if (BigInt(m.fromAmount)!==expected || expected<=0n) throw new Error('Signed amount exceeds the approved trade.');
    if(!/^\d+$/.test(String(m.deadline))||!/^\d+$/.test(String(m.salt)))throw new Error('Invalid signing lifetime or nonce.');
    if (!isExit && (Number(m.deadline)<=Date.now()/1000 || Number(m.deadline)>Date.now()/1000+600)) throw new Error('Quote expired or has an unexpected lifetime.');
    if (isExit && (m.deadline!==quote.attachedBracket.deadline || m.salt!==quote.attachedBracket.salt || Number(quote.attachedBracket.signedMaxFromAmount)>Number(quote.to.amount)*1.1)) throw new Error('Exit authorization exceeds the position.');
  }
  if (!same(entry.message.vault,exit.message.vault)) throw new Error('Mismatched execution vaults.');
  return {entry,exit};
}
