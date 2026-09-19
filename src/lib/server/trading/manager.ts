import { sql } from 'drizzle-orm';
import { parseUnits, formatUnits } from 'viem';
import { db } from '../db/client';
import { ensureOrders, updateOrder } from './orders';
import { flash } from './flash';
import { delegatedSigner, signOrder } from './signer';
import { refreshAsset } from './asset-directory.js';
import { managementDecision, validatedPlan } from '$lib/trading/plan.js';

const terminal=new Set(['ORDER_STATUS_FILLED','ORDER_STATUS_CANCELLED','ORDER_STATUS_REJECTED','ORDER_STATUS_TERMINATED']);
let ready:Promise<unknown>|undefined;
export function ensureManagement(){return ready??=ensureOrders().then(()=>db.execute(sql`CREATE TABLE IF NOT EXISTS cassie_position_management (
  order_id uuid PRIMARY KEY REFERENCES cassie_live_orders(id), state jsonb NOT NULL DEFAULT '{}', updated_at timestamptz NOT NULL DEFAULT now()
)`)).then(()=>db.execute(sql`CREATE TABLE IF NOT EXISTS cassie_position_actions (
  id uuid PRIMARY KEY, order_id uuid NOT NULL REFERENCES cassie_live_orders(id), action_key text NOT NULL,
  role text NOT NULL, status text NOT NULL, request jsonb NOT NULL, provider_id text, result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(order_id,action_key)
)`)).catch(e=>{ready=undefined;throw e;});}
const same=(a:unknown,b:unknown)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
async function readOrder(id:string,intent:any,side:string){
  const result=await flash(`/orders/${encodeURIComponent(id)}?funderAddress=${encodeURIComponent(intent.address)}`);
  const o=result.order;
  if(o?.orderId!==id||!same(o.funderAddress,intent.address)||!same(o.targetAsset?.address,intent.asset)||o.side!==side)throw Error('Managed order identity mismatch.');
  return result;
}
function settled(result:any){return Array.isArray(result.fills)&&result.fills.every((f:any)=>f.status==='CHAIN_STATUS_FINALIZED');}
function units(value:unknown,decimals:number){const s=String(value??'0');if(!/^\d+(\.\d+)?$/.test(s)||(s.split('.')[1]?.length??0)>decimals)throw Error('Invalid provider quantity.');return parseUnits(s,decimals);}
async function save(id:string,state:any){await db.execute(sql`INSERT INTO cassie_position_management(order_id,state) VALUES(${id},${JSON.stringify(state)}::jsonb) ON CONFLICT(order_id) DO UPDATE SET state=excluded.state,updated_at=now()`);}

// Submission intent is durable before any network write. An ambiguous response
// remains blocked rather than submitting another sell after a restart.
async function submit(row:any,key:string,role:string,order:any){
  const quote=await flash('/quote',order);
  const body=await signOrder(row.user_id,row.wallet_id,order,quote,row.intent.decimals);
  const id=crypto.randomUUID();
  const inserted=await db.execute(sql`INSERT INTO cassie_position_actions(id,order_id,action_key,role,status,request) VALUES(${id},${row.id},${key},${role},'submitting',${JSON.stringify(order)}::jsonb) ON CONFLICT(order_id,action_key) DO NOTHING RETURNING id`);
  if(!inserted.length)throw Error('This management action already exists.');
  try{
    const result=await flash('/order',body);
    if(typeof result.orderId!=='string')throw Error('Missing management acknowledgement.');
    await db.execute(sql`UPDATE cassie_position_actions SET status='submitted',provider_id=${result.orderId},result=${JSON.stringify(result)}::jsonb,updated_at=now() WHERE id=${id}`);
  }catch(e){await db.execute(sql`UPDATE cassie_position_actions SET status='needs_review',updated_at=now() WHERE id=${id}`);throw e;}
}
async function cancel(row:any,id:string){
  const cancelMessage=`Definitive Flash v1 — Cancel Order\nOrder: ${id}`;
  const userSignature=await delegatedSigner(row.user_id,row.wallet_id,row.intent.address).message(cancelMessage);
  await flash(`/orders/${encodeURIComponent(id)}/cancel`,{cancelMessage,userSignature});
}
function sellOrder(intent:any,qty:bigint,stop?:number){return {
  targetChain:intent.chain,contraChain:intent.chain,targetAsset:intent.asset,contraAsset:intent.settlement.address,
  side:'sell',qty:formatUnits(qty,intent.decimals),orderType:stop===undefined?'market':'stop-loss',
  ...(stop===undefined?{}:{triggers:[{notionalPrice:String(stop),triggerType:'lower'}]}),
  maxSlippage:'0.01',maxPriceImpact:stop===undefined?'0.03':'0.1',funderAddress:intent.address,
};}
async function manage(row:any){
  const intent=row.intent;
  // Existing trades keep the strategy originally approved. Never retrofit a
  // new plan to an old order without a new user instruction.
  if(intent?.plan?.version!==1||!intent.settlement||!row.provider_order_id)return;
  validatedPlan(intent.plan,intent.market,Math.min(Date.now(),Date.parse(intent.plan.expiresAt)-1));
  const entry=await readOrder(row.provider_order_id,intent,'buy');
  if(!settled(entry)||!terminal.has(entry.order.status))return;
  const bought=units(entry.order.filled?.targetAmount,intent.decimals);
  if(bought===0n){await updateOrder(row.id,'rejected',{entry});return;}
  const stored=await db.execute(sql`SELECT state FROM cassie_position_management WHERE order_id=${row.id}`);
  const state:any=stored[0]?.state??{completedTargets:[],stopPrice:intent.plan.stopPrice};
  state.entryPrice=Number(entry.order.filled?.contraAmount)/Number(formatUnits(bought,intent.decimals));
  if(!Number.isFinite(state.entryPrice)||state.entryPrice<=0)throw Error('Missing confirmed entry cost.');
  const actions=await db.execute(sql`SELECT * FROM cassie_position_actions WHERE order_id=${row.id} ORDER BY created_at`);
  if(actions.some(a=>!a.provider_id)){throw Error('A management submission needs reconciliation.');}
  const exits:any[]=[];
  const attached=entry.order.attachedBracket?.bracketOrderId;
  if(attached){const r=await readOrder(attached,intent,'sell');if(r.order.sourceEntryOrderId!==row.provider_order_id)throw Error('Unrelated protective order.');exits.push({id:attached,role:'protect',result:r});}
  for(const a of actions){
    const result=await readOrder(String(a.provider_id),intent,'sell');
    await db.execute(sql`UPDATE cassie_position_actions SET result=${JSON.stringify(result)}::jsonb,status=${terminal.has(result.order.status)?'terminal':'submitted'},updated_at=now() WHERE id=${a.id}`);
    exits.push({id:a.provider_id,role:a.role,key:a.action_key,result});
  }
  if(exits.some(e=>!settled(e.result)))return;
  const sold=exits.reduce((n,e)=>n+units(e.result.order.filled?.targetAmount,intent.decimals),0n);
  if(sold>bought)throw Error('Exit fills exceed the managed position.');
  const remaining=bought-sold;
  const active=exits.filter(e=>!terminal.has(e.result.order.status));
  if(remaining===0n){
    for(const a of active)await cancel(row,a.id);
    if(active.length)return;
    await updateOrder(row.id,'closed',{entry,exits});await save(row.id,{...state,remaining:'0',message:'Position closed.'});return;
  }
  // A market reduction must finish before changing any allowance or protection.
  if(active.some(a=>a.role!=='protect'))return;
  for(const e of exits.filter(e=>e.role==='reduce'&&terminal.has(e.result.order.status))){
    if(units(e.result.order.filled?.targetAmount,intent.decimals)!==units(e.result.order.qty,intent.decimals))throw Error('A partial reduction needs reconciliation.');
    const index=Number(String(e.key).replace('target-',''));
    if(!state.completedTargets.includes(index))state.completedTargets.push(index);
  }
  if(exits.some(e=>e.role==='close'&&terminal.has(e.result.order.status)&&remaining>0n))throw Error('A partial close needs reconciliation.');
  const market=await refreshAsset(intent.market,flash);
  state.highWater=Math.max(state.highWater??state.entryPrice,market.price);
  state.remaining=formatUnits(remaining,intent.decimals);state.currentPrice=market.price;state.checkedAt=new Date().toISOString();
  const decision=state.closeRequested?{type:'close',key:'user-close',reason:'You requested this position be closed.'}:managementDecision(intent.plan,state,market.price);
  // Keep the attached bracket until a change is actually necessary. Cancel,
  // then wait for confirmed terminal fills before replacing or reducing it.
  if(decision?.type==='reduce'||decision?.type==='close'||(decision?.type==='tighten'&&active.some(a=>a.id===attached))){
    if(active.length){for(const a of active)await cancel(row,a.id);state.message='Updating position protection.';await save(row.id,state);return;}
    if(decision.type==='tighten'){state.stopPrice=decision.price;}
    else{
      const requested=decision.type==='close'?remaining:bought*BigInt(decision.percent)/100n;
      const qty=decision.type==='reduce'&&decision.index===intent.plan.targets.length-1?remaining:requested>remaining?remaining:requested;
      if(qty===0n)throw Error('Position is too small for its staged exit.');
      await submit(row,decision.key,decision.type==='close'?'close':'reduce',sellOrder(intent,qty));
      state.message=decision.reason;await save(row.id,state);return;
    }
  }
  if(decision?.type==='tighten'&&active.length){
    const protection=active[0];
    const price=String(decision.price);
    const updateMessage=`Definitive Flash — Update Order\nOrder: ${protection.id}\nIssued At: ${new Date().toISOString()}\nTrigger Lower Notional Price: ${price}`;
    const userSignature=await delegatedSigner(row.user_id,row.wallet_id,intent.address).message(updateMessage);
    await flash(`/orders/${encodeURIComponent(protection.id)}`,{trigger:{notionalPrice:price,triggerType:'lower'},updateMessage,userSignature},'PATCH');
    // Store the new stop only after it is observable on the provider order.
    const updated=await readOrder(protection.id,intent,'sell');
    if(!updated.order.pendingUpdate&&Number(updated.order.trigger?.notionalPrice)===decision.price)state.stopPrice=decision.price;
  }
  if(!active.length){
    await submit(row,`protect-${actions.length}`,'protect',sellOrder(intent,remaining,state.stopPrice));
    state.message='Protective stop placed.';
  }else state.message='Cassie is managing this position.';
  state.needsAttention=false;
  await save(row.id,state);await updateOrder(row.id,'open',{entry,exits});
}
let busy=false;
export async function managePositions(){
  if(busy)return;busy=true;
  try{
    await ensureManagement();
    const rows=await db.execute(sql`SELECT * FROM cassie_live_orders WHERE status IN ('pending','open','needs_review') AND intent->'plan'->>'version'='1' ORDER BY updated_at LIMIT 100`);
    for(const row of rows){
      try{await db.transaction(async tx=>{
        const lock=await tx.execute(sql`SELECT pg_try_advisory_xact_lock(hashtextextended(${row.wallet_id},0)) AS acquired`);
        if(lock[0]?.acquired)await manage(row);
      });}catch(error){
        await db.execute(sql`INSERT INTO cassie_position_management(order_id,state) VALUES(${row.id},${JSON.stringify({message:String((error as Error).message),checkedAt:new Date().toISOString(),needsAttention:true})}::jsonb) ON CONFLICT(order_id) DO UPDATE SET state=cassie_position_management.state || excluded.state,updated_at=now()`);
        // Retain the last provider snapshot and all reserved capital.
        await db.execute(sql`UPDATE cassie_live_orders SET status='needs_review',updated_at=now() WHERE id=${row.id}`);
      }
    }
  }finally{busy=false;}
}
