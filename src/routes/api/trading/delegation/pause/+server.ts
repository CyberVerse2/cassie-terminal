import { json } from '@sveltejs/kit';
import { verifyDynamicToken } from '$lib/server/dynamic-auth';
import { pauseDelegation } from '$lib/server/trading/delegations';
export async function POST({request,url}) {
  if(request.headers.get('origin')!==url.origin)return json({error:'Invalid origin.'},{status:403});
  const user=await verifyDynamicToken(request);
  if(!user)return json({error:'Sign in to manage permissions.'},{status:401});
  let walletId;
  try{({walletId}=await request.json());if(typeof walletId!=='string'||walletId.length>128)throw new Error();}
  catch{return json({error:'Invalid wallet.'},{status:400});}
  await pauseDelegation(user.userId,walletId);
  return json({paused:true});
}
