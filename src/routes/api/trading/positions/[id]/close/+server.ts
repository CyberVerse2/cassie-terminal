import {json} from '@sveltejs/kit';
import {sql} from 'drizzle-orm';
import {db} from '$lib/server/db/client';
import {verifyDynamicToken} from '$lib/server/dynamic-auth';
import {ensureManagement} from '$lib/server/trading/manager';
export async function POST({request,url,params}){
 if(request.headers.get('origin')!==url.origin)return json({error:'Invalid origin.'},{status:403});
 const user=await verifyDynamicToken(request);if(!user)return json({error:'Sign in first.'},{status:401});
 if(!/^[0-9a-f-]{36}$/i.test(params.id))return json({error:'Invalid position.'},{status:400});
 await ensureManagement();
 const result=await db.execute(sql`INSERT INTO cassie_position_management(order_id,state) SELECT id,'{"closeRequested":true}'::jsonb FROM cassie_live_orders WHERE id=${params.id} AND user_id=${user.userId} AND status NOT IN ('closed','rejected') AND intent->'plan'->>'version'='1' ON CONFLICT(order_id) DO UPDATE SET state=cassie_position_management.state || excluded.state,updated_at=now() RETURNING order_id`);
 return result.length?json({requested:true}):json({error:'This position cannot be closed here.'},{status:409});
}
