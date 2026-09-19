import { env } from '$env/dynamic/private';
import { createPublicClient, http, parseAbi, formatUnits } from 'viem';
import { base } from 'viem/chains';
import { stockForTicker, verifiedStockMarket, STOCK_SOURCE } from './stock-assets.js';
import { flash } from './flash';
let issuerCache: {html:string;expires:number}|undefined;
let issuerPending:Promise<string>|undefined;
async function issuerListing() {
  if(issuerCache && issuerCache.expires>Date.now())return issuerCache.html;
  return issuerPending??= (async()=>{
    const response=await fetch(STOCK_SOURCE,{signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw new Error('The stock issuer’s asset list is unavailable.');
    const html=await response.text();
    issuerCache={html,expires:Date.now()+300000};return html;
  })().finally(()=>{issuerPending=undefined;});
}
export async function resolveStock(ticker:string) {
  const stock=stockForTicker(ticker);
  if(!stock)throw new Error(`No verified tokenized ${ticker} market is configured for Cassie yet.`);
  const [listing,search]=await Promise.all([issuerListing(),flash(`/search?chain=base&query=${stock.address}`)]);
  const market=verifiedStockMarket(stock,search.assets,listing);
  const rpc=createPublicClient({chain:base,transport:http(env.BASE_RPC_URL||undefined,{timeout:8000})});
  const multiplier=Number(formatUnits(await rpc.readContract({address:stock.address as `0x${string}`,abi:parseAbi(['function multiplier() view returns (uint256)']),functionName:'multiplier'}),18));
  if(!Number.isFinite(multiplier)||multiplier<=0)throw new Error('The stock’s share conversion is unavailable.');
  return {...market,multiplier};
}
