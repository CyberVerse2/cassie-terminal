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
import { validateSettings } from '$lib/trading/settings.js';
import { refreshAsset, discoverAssets } from './asset-directory.js';
import { entryInRange, validatedPlan } from '$lib/trading/plan.js';
import { authorizeSingleQuote } from './authorization.js';
import { chainClients, signOrder } from './signer';
import { signerFailure, signingTransaction } from './signing-transaction.js';
import { BASE_USDC_MARKET, requireUsdc } from './usdc.js';

export async function prepareTrade(userId:string,ideaId:string,walletId:string) {
  const detail=await getIdea(ideaId);
  if(!detail)throw new Error('This trade idea is no longer available.');
  if(detail.direction!=='long'||!['spot','shares'].includes(detail.instrument??''))throw new Error('This idea is not a supported Definitive spot trade.');
  // Stocks resolve against issuer contracts; other spot assets retain the
  // research pipeline's verified mapping. Never trust a ticker-only search.
  const rows=await db.execute(sql`SELECT market_meta FROM routes WHERE idea_id=${ideaId} AND status='routed' ORDER BY created_at DESC LIMIT 1`);
  const mapping=(rows[0]?.market_meta as any)?.definitive;
  const market=await refreshAsset(mapping,flash);
  const plan=validatedPlan((rows[0]?.market_meta as any)?.executionPlan,market);
  const levels={target:String(plan.targets.at(-1).price),stop:String(plan.stopPrice)};
  if(!entryInRange(market.price,plan))throw Error('The current price is outside this plan’s entry range.');
  const limits=validateSettings(await readSettings(userId));
  const wallets=await delegationStatus(userId);
  const wallet=wallets.find(w=>w.walletId===walletId&&!w.revoked&&w.chain==='EVM');
  if(!wallet)throw new Error('Approve trading permissions first.');
  const intent={asset:market.address.toLowerCase(),chain:market.chain,decimals:market.decimals,address:String(wallet.address),amount:String(limits.amountUsd),maxCapital:String(limits.maxDeployedUsd),ticker:detail.ticker,plan,market,...levels};
  const cross=market.chain!=='base';
  const settlement=cross?(await discoverAssets('USDC','spot',flash,market.chain))[0]:BASE_USDC_MARKET;
  if(!settlement)throw Error('No verified destination USDC market is available for protective exits.');
  Object.assign(intent,{settlement});
  const balances=(await flash(`/balances/${encodeURIComponent(intent.address)}`)).balances??[];
  requireUsdc(balances,limits.amountUsd,settlement);
  const feeChain=cross?market.chain:'base';
  const {rpc}=chainClients(feeChain);
  if(await rpc.getBalance({address:intent.address as `0x${string}`})===0n){
    throw Error(`Fund network fees on ${feeChain} in Portfolio so Cassie can approve this trade.`);
  }
  const order={targetChain:market.chain,contraChain:'base',targetAsset:intent.asset,contraAsset:BASE_USDC,side:'buy',qty:intent.amount,orderType:'market',maxSlippage:'0.01',maxPriceImpact:'0.03',funderAddress:intent.address,...(cross?{recipientAddress:intent.address}:{})};
  const bracket={takeProfit:{notionalPrice:intent.target},stopLoss:{notionalPrice:intent.stop}};
  const quote=await flash('/quote',{...order,...(!cross?{attachedBracket:bracket}:{})});
  const payloads=cross?{entry:authorizeSingleQuote(quote,order,6),exit:null}:authorizeQuote(quote,intent);
  if(cross){
    const protection={targetChain:market.chain,contraChain:market.chain,targetAsset:market.address,contraAsset:settlement.address,side:'sell',qty:quote.to.amount,orderType:'stop-loss',triggers:[{notionalPrice:intent.stop,triggerType:'lower'}],maxSlippage:'0.01',maxPriceImpact:'0.1',funderAddress:intent.address};
    authorizeSingleQuote(await flash('/quote',protection),protection,market.decimals);
  }
  const entry=Number(intent.amount)/Number(quote.to.amount);
  if(!entryInRange(entry,plan))throw new Error('The live execution price is outside this trade’s exit levels.');
  return {walletId:String(wallet.walletId),intent,market,order,bracket,quote,payloads,entry};
}

export async function executeTrade(userId:string,ideaId:string,selectedWalletId:string) {
  const {walletId,intent,order,bracket,quote,payloads}=await prepareTrade(userId,ideaId,selectedWalletId);
  const id=await reserveOrder(userId,walletId,ideaId,intent);
  let submitted=false;
  try {
    return await db.transaction(async tx=>{
      // One transaction sequence per wallet, across processes and devices.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${walletId},0))`);
      if(intent.chain!=='base'){
        const latest=validateSettings(await readSettings(userId));
        if(latest.amountUsd!==Number(intent.amount))throw Error('Your trading allocation changed.');
        const body=await signOrder(userId,walletId,order,quote,6);
        await updateOrder(id,'submitting',{quoteId:quote.quoteId});submitted=true;
        const result=await flash('/order',body);
        if(typeof result.orderId!=='string')throw Error('Execution acknowledgement is missing.');
        await updateOrder(id,'pending',result,result.orderId);return {id,...result};
      }
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
        let serialized;
        try{serialized=await delegatedSignTransaction(client,{...await credentials(),transaction:signingTransaction(request,8453)});}
        catch(error){signerFailure(error);}
        const hash=await rpc.sendRawTransaction({serializedTransaction:serialized as `0x${string}`});
        const receipt=await rpc.waitForTransactionReceipt({hash,timeout:60000});
        if(receipt.status!=='success')throw new Error('Token approval failed.');
      }
      if(Number(payloads.entry.message.deadline)<=Date.now()/1000+15)throw new Error('Quote expired during wallet setup. Try again.');
      let userSignature, bracketSignature;
      try {
        userSignature=await delegatedSignTypedData(client,{...await credentials(),typedData:payloads.entry});
        bracketSignature=await delegatedSignTypedData(client,{...await credentials(),typedData:payloads.exit});
      } catch(error){signerFailure(error);}
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
