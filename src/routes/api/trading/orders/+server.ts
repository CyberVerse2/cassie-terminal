import { json } from '@sveltejs/kit';
import { verifyDynamicToken } from '$lib/server/dynamic-auth';
import { executeTrade } from '$lib/server/trading/execute';
import { reconcileOrders } from '$lib/server/trading/reconcile';
const headers={'cache-control':'no-store'};
export async function GET({request}) {
  const user=await verifyDynamicToken(request);
  if(!user)return json({error:'Sign in to view your trades.'},{status:401,headers});
  return json({orders:await reconcileOrders(user.userId)},{headers});
}
export async function POST({request,url}) {
  if(request.headers.get('origin')!==url.origin)return json({error:'Invalid origin.'},{status:403,headers});
  const user=await verifyDynamicToken(request);
  if(!user)return json({error:'Sign in to trade.'},{status:401,headers});
  try {
    const {ideaId,walletId}=await request.json();
    if(typeof ideaId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ideaId)||typeof walletId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(walletId))return json({error:'Invalid trade or wallet.'},{status:400,headers});
    return json(await executeTrade(user.userId,ideaId,walletId),{headers});
  } catch(error){return json({error:error instanceof Error?error.message:'Trade could not be placed.'},{status:409,headers});}
}
