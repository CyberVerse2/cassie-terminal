import { json } from '@sveltejs/kit';
import { verifyDynamicToken } from '$lib/server/dynamic-auth';
import { prepareTrade } from '$lib/server/trading/execute';
const headers={'cache-control':'no-store'};
// Read-only preflight: no reservations, approvals, signatures or submissions.
export async function GET({request,url}) {
  const user=await verifyDynamicToken(request);
  if(!user)return json({error:'Sign in to preview execution.'},{status:401,headers});
  const ideaId=url.searchParams.get('ideaId')??'',walletId=url.searchParams.get('walletId')??'';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ideaId)||! /^[a-zA-Z0-9_-]{1,128}$/.test(walletId))return json({error:'Invalid trade or wallet.'},{status:400,headers});
  try {
    const {market,entry,intent}=await prepareTrade(user.userId,ideaId,walletId);
    return json({asset:{symbol:market.symbol??intent.ticker,chain:market.chain,address:market.address,issuer:market.issuer??null},entryPrice:entry,amountUsd:Number(intent.amount),quotedAt:Date.now(),expiresAt:Date.now()+20000},{headers});
  }catch(error){return json({error:error instanceof Error?error.message:'Execution preview is unavailable.'},{status:409,headers});}
}
