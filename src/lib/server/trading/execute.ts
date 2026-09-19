import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { sql } from 'drizzle-orm';
import { createPublicClient, createWalletClient, http, encodeFunctionData, erc20Abi, parseUnits } from 'viem';
import { base } from 'viem/chains';
import { createDelegatedEvmWalletClient, delegatedSignTransaction, delegatedSignTypedData } from '@dynamic-labs-wallet/node-evm';
import { decryptDelegatedWebhookData } from '@dynamic-labs-wallet/node';
import { db } from '../db/client';
import { getIdea } from '../feed';
import { readSettings } from './settings';
import { readDelegation, delegationStatus } from './delegations';
import { reserveOrder, updateOrder } from './orders';
import { flash } from './flash';
import { authorizeQuote, FLASH_ALLOWANCE, BASE_USDC } from './authorization.js';
import { dollarLevel, validateSettings } from '$lib/trading/settings.js';

export async function prepareTrade(userId:string,ideaId:string,walletId:string) {
  const detail=await getIdea(ideaId);
  if(!detail)throw new Error('This trade idea is no longer available.');
  if(detail.direction!=='long'||!['spot','shares'].includes(detail.instrument??''))throw new Error('This idea is not a supported Definitive spot trade.');
  // Asset identity must be verified by the research pipeline. Never route a
  // ticker-only match: counterfeit tokens can copy any stock/token symbol.
  const rows=await db.execute(sql`SELECT market_meta FROM routes WHERE idea_id=${ideaId} AND status='routed' ORDER BY created_at DESC LIMIT 1`);
  const market=(rows[0]?.market_meta as any)?.definitive;
  if(market?.chain!=='base'||!/^0x[a-fA-F0-9]{40}$/.test(market.address??'')||!Number.isInteger(market.decimals)||market.decimals<0||market.decimals>36)throw new Error('Cassie has not verified a Definitive token for this idea yet.');
  const target=dollarLevel(detail.plan.target?.text),stop=dollarLevel(detail.plan.stop?.text),entry=detail.currentPrice;
  if(!target||!stop||!entry||target<=entry||stop>=entry)throw new Error('This trade needs verified entry, take-profit, and stop-loss prices.');
  const limits=validateSettings(await readSettings(userId));
  const wallets=await delegationStatus(userId);
  const wallet=wallets.find(w=>w.walletId===walletId&&!w.revoked&&w.chain==='EVM');
  if(!wallet)throw new Error('Approve trading permissions first.');
  return {walletId:String(wallet.walletId),intent:{asset:market.address.toLowerCase(),decimals:market.decimals,address:String(wallet.address),amount:String(limits.amountUsd),maxCapital:String(limits.maxDeployedUsd),ticker:detail.ticker,target:String(target),stop:String(stop)}};
}

export async function executeTrade(userId:string,ideaId:string,selectedWalletId:string) {
  const {walletId,intent}=await prepareTrade(userId,ideaId,selectedWalletId);
  const id=await reserveOrder(userId,walletId,ideaId,intent);
  let submitted=false;
  try {
    return await db.transaction(async tx=>{
      // One transaction sequence per wallet, across processes and devices.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${walletId},0))`);
      const order={targetChain:'base',contraChain:'base',targetAsset:intent.asset,contraAsset:BASE_USDC,side:'buy',qty:intent.amount,orderType:'market',maxSlippage:'0.01',funderAddress:intent.address};
      const bracket={takeProfit:{notionalPrice:intent.target},stopLoss:{notionalPrice:intent.stop}};
      const quote=await flash('/quote',{...order,attachedBracket:bracket});
      const payloads=authorizeQuote(quote,intent);
      const client=createDelegatedEvmWalletClient({environmentId:publicEnv.PUBLIC_DYNAMIC_ENVIRONMENT_ID,apiKey:env.DYNAMIC_API_KEY});
      const rpc=createPublicClient({chain:base,transport:http(env.BASE_RPC_URL||undefined)});
      const txBuilder=createWalletClient({chain:base,transport:http(env.BASE_RPC_URL||undefined)});
      async function credentials(){
        const material=await readDelegation(userId,walletId) as any;
        if(!material)throw new Error('Trading access has been revoked.');
        const latest=validateSettings(await readSettings(userId));
        if(latest.amountUsd<Number(intent.amount)||latest.maxDeployedUsd<Number(intent.maxCapital))throw new Error('Trading limits changed. Reopen this trade.');
        const active=await db.execute(sql`SELECT count(*)::int AS count,COALESCE(sum(amount),0) AS deployed FROM cassie_live_orders WHERE user_id=${userId} AND status NOT IN ('closed','rejected')`);
        if(Number(active[0].count)>latest.maxPositions||Number(active[0].deployed)>latest.maxDeployedUsd)throw new Error('Your open trades exceed the updated limits.');
        const decoded=decryptDelegatedWebhookData({privateKeyPem:env.DYNAMIC_DELEGATION_PRIVATE_KEY.replace(/\\n/g,'\n'),encryptedDelegatedKeyShare:material.encryptedDelegatedShare,encryptedWalletApiKey:material.encryptedWalletApiKey});
        return {walletId,walletApiKey:decoded.decryptedWalletApiKey,keyShare:decoded.decryptedDelegatedShare};
      }
      // Replace the quote's unlimited ERC-20 approval with an explicit cap.
      for(const [token,cap] of [[BASE_USDC,parseUnits(intent.maxCapital,6)],[intent.asset,BigInt(payloads.exit.message.fromAmount)]] as const){
        const allowance=await rpc.readContract({address:token as `0x${string}`,abi:erc20Abi,functionName:'allowance',args:[intent.address as `0x${string}`,FLASH_ALLOWANCE]});
        if(allowance===cap)continue;
        const data=encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[FLASH_ALLOWANCE,cap]});
        const request=await txBuilder.prepareTransactionRequest({account:intent.address as `0x${string}`,to:token as `0x${string}`,data,value:0n});
        if(request.gas>250000n||request.gas*(request.maxFeePerGas??request.gasPrice??0n)>1000000000000000n)throw new Error('Approval gas exceeds the transaction limit.');
        const serialized=await delegatedSignTransaction(client,{...await credentials(),transaction:request as any});
        const hash=await rpc.sendRawTransaction({serializedTransaction:serialized as `0x${string}`});
        const receipt=await rpc.waitForTransactionReceipt({hash,timeout:60000});
        if(receipt.status!=='success')throw new Error('Token approval failed.');
      }
      if(Number(payloads.entry.message.deadline)<=Date.now()/1000+15)throw new Error('Quote expired during wallet setup. Try again.');
      const userSignature=await delegatedSignTypedData(client,{...await credentials(),typedData:payloads.entry});
      const bracketSignature=await delegatedSignTypedData(client,{...await credentials(),typedData:payloads.exit});
      // Persist ambiguity before submitting. Network failures must not free
      // capital or silently submit a second order on the next click.
      await updateOrder(id,'submitting',{quoteId:quote.quoteId});
      await credentials();
      submitted=true;
      const result=await flash('/order',{...order,quoteId:quote.quoteId,userSignature,evmOrderTypedData:quote.evm.orderTypedData,attachedBracket:{...bracket,userSignature:bracketSignature,salt:quote.attachedBracket.salt,deadline:quote.attachedBracket.deadline,signedMaxFromAmount:quote.attachedBracket.signedMaxFromAmount}});
      if(typeof result.orderId!=='string')throw new Error('Execution acknowledgement is missing. Check Portfolio before retrying.');
      await updateOrder(id,'open',result,result.orderId);
      return {id,...result};
    });
  } catch(error){
    await updateOrder(id,submitted?'needs_review':'rejected',{message:'Execution did not complete. Check the order status before retrying.'});
    throw error;
  }
}
