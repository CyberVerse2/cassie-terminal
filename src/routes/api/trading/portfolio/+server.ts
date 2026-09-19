import {json} from '@sveltejs/kit';
import {verifyDynamicToken} from '$lib/server/dynamic-auth';
import {livePortfolio} from '$lib/server/trading/portfolio';
export async function GET({request}){
 const user=await verifyDynamicToken(request);const headers={'cache-control':'no-store'};
 if(!user)return json({error:'Sign in to view your portfolio.'},{status:401,headers});
 try{return json(await livePortfolio(user.userId),{headers});}catch{return json({error:'Live balances are temporarily unavailable.'},{status:503,headers});}
}
