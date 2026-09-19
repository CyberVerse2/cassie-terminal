import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import {createPublicClient,createWalletClient,http,encodeFunctionData,erc20Abi,defineChain,parseUnits} from 'viem';
import * as chains from 'viem/chains';
import {createDelegatedEvmWalletClient,delegatedSignTransaction,delegatedSignTypedData,delegatedSignMessage} from '@dynamic-labs-wallet/node-evm';
import {decryptDelegatedWebhookData} from '@dynamic-labs-wallet/node';
import {readDelegation} from './delegations';
import {EVM_CHAINS} from './asset-directory.js';
import {FLASH_ALLOWANCE,authorizeSingleQuote} from './authorization.js';
import {flash} from './flash';
import {signerFailure,signingTransaction,signingTypedData} from './signing-transaction.js';
export function chainClients(name:string){
  const chain=Object.values(chains).find((c:any)=>c.id===EVM_CHAINS[name]);
  if(!chain)throw Error('This EVM chain has no configured RPC client.');
  const url=env[`${name.toUpperCase()}_RPC_URL`]||undefined;
  return {rpc:createPublicClient({chain,transport:http(url,{timeout:15000})}),wallet:createWalletClient({chain,transport:http(url,{timeout:15000})})};
}
export function delegatedSigner(userId:string,walletId:string,address:string){
  const client=createDelegatedEvmWalletClient({environmentId:publicEnv.PUBLIC_DYNAMIC_ENVIRONMENT_ID,apiKey:env.DYNAMIC_API_KEY});
  async function credentials(){
    const material=await readDelegation(userId,walletId) as any;
    if(!material||material.publicKey?.toLowerCase()!==address.toLowerCase()||material.chain!=='EVM')throw Error('Trading access is no longer active for this wallet.');
    const d=decryptDelegatedWebhookData({privateKeyPem:env.DYNAMIC_DELEGATION_PRIVATE_KEY.replace(/\\n/g,'\n'),encryptedDelegatedKeyShare:material.encryptedDelegatedShare,encryptedWalletApiKey:material.encryptedWalletApiKey});
    return {walletId,walletApiKey:d.decryptedWalletApiKey,keyShare:d.decryptedDelegatedShare};
  }
  return {credentials,
    typed:async(data:any)=>{try{return await delegatedSignTypedData(client,{...await credentials(),typedData:signingTypedData(data)});}catch(error){signerFailure(error,'order');}},
    message:async(message:string)=>{try{return await delegatedSignMessage(client,{...await credentials(),message});}catch(error){signerFailure(error,'order');}},
    transaction:async(transaction:any,chainId:number)=>{try{return await delegatedSignTransaction(client,{...await credentials(),transaction:signingTransaction(transaction,chainId)});}catch(error){signerFailure(error);}},
  };
}
export async function approveExact(signer:ReturnType<typeof delegatedSigner>,chain:string,address:string,token:string,amount:bigint){
  const {rpc,wallet}=chainClients(chain);
  const allowance=await rpc.readContract({address:token as `0x${string}`,abi:erc20Abi,functionName:'allowance',args:[address as `0x${string}`,FLASH_ALLOWANCE]});
  if(allowance===amount)return;
  const balance=await rpc.getBalance({address:address as `0x${string}`});
  if(balance===0n)throw Error(`Fund network fees on ${chain} in Portfolio before trading this asset.`);
  const data=encodeFunctionData({abi:erc20Abi,functionName:'approve',args:[FLASH_ALLOWANCE,amount]});
  const request=await wallet.prepareTransactionRequest({account:address as `0x${string}`,to:token as `0x${string}`,data,value:0n});
  if(request.gas>250000n||request.gas*(request.maxFeePerGas??request.gasPrice??0n)>1000000000000000n)throw Error('Approval gas exceeds the transaction limit.');
  const raw=await signer.transaction(request,EVM_CHAINS[chain]);
  const hash=await rpc.sendRawTransaction({serializedTransaction:raw as `0x${string}`});
  if((await rpc.waitForTransactionReceipt({hash,timeout:60000})).status!=='success')throw Error('Token approval failed.');
}
export async function signOrder(userId:string,walletId:string,order:any,quote:any,decimals:number){
  const payload=authorizeSingleQuote(quote,order,decimals);
  const signer=delegatedSigner(userId,walletId,order.funderAddress);
  await approveExact(signer,order.side==='buy'?order.contraChain:order.targetChain,order.funderAddress,order.side==='buy'?order.contraAsset:order.targetAsset,parseUnits(order.qty,decimals));
  if(Number(payload.message.deadline)<=Date.now()/1000+15)throw Error('Quote expired during wallet setup.');
  return {...order,quoteId:quote.quoteId,userSignature:await signer.typed(payload),evmOrderTypedData:quote.evm.orderTypedData,...(quote.bridgeQuoteId?{bridgeQuoteId:quote.bridgeQuoteId}:{})};
}
