import {sql} from 'drizzle-orm';
import {db} from '../db/client';
import {ensureManagement} from './manager';
import {delegationStatus} from './delegations';
import {flash} from './flash';
import {EVM_CHAINS} from './asset-directory.js';
import {evmUsdcCash} from './usdc.js';
export async function livePortfolio(userId:string){
  await ensureManagement();
  const wallets=await delegationStatus(userId);
  const addresses=[...new Set(wallets.filter(w=>w.chain==='EVM').map(w=>String(w.address).toLowerCase()))];
  const balances=[];
  for(const address of addresses){const result=await flash(`/balances/${encodeURIComponent(address)}`);balances.push(...result.balances.filter((b:any)=>EVM_CHAINS[b.chain]).map((b:any)=>({...b,walletAddress:address})));}
  const rows=await db.execute(sql`SELECT o.*,m.state AS management FROM cassie_live_orders o LEFT JOIN cassie_position_management m ON m.order_id=o.id WHERE o.user_id=${userId} ORDER BY o.created_at DESC LIMIT 100`);
  const positions=rows.filter(r=>r.status!=='rejected').map(r=>{
    const i:any=r.intent,s:any=r.management??{},result:any=r.provider_result??{};
    const entry=result.entry?.order,qty=Number(entry?.filled?.targetAmount??0),cost=Number(entry?.filled?.contraAmount??0);
    const exits=result.exits?.map((e:any)=>e.result)??(result.exit?[result.exit]:[]);
    const sold=exits.reduce((a:number,e:any)=>a+Number(e.order?.filled?.targetAmount??0),0);
    const proceeds=exits.reduce((a:number,e:any)=>a+Number(e.order?.filled?.contraAmount??0),0);
    const remaining=Math.max(0,qty-sold),entryPrice=qty>0?cost/qty:null;
    const holding=balances.find(b=>b.chain===i.chain&&b.address.toLowerCase()===i.asset&&b.walletAddress===i.address.toLowerCase());
    const mark=holding&&Number(holding.balance)>0?Number(holding.notional)/Number(holding.balance):null;
    return {id:r.id,marketLabel:i.ticker,venue:'definitive',direction:'long',instrument:i.market?.kind??'spot',chain:i.chain,status:r.status,
      collateralUsd:cost||Number(r.amount),entryPrice,currentMarkPrice:mark,currentValueUsd:mark===null?null:remaining*mark,
      pnlUsd:r.status==='closed'?proceeds-cost:mark!==null&&entryPrice!==null?remaining*(mark-entryPrice):null,
      closePrice:sold>0?proceeds/sold:null,canClose:i.plan?.version===1&&qty>0&&r.status!=='closed',management:s,
      markError:mark===null?'A current token valuation is unavailable.':null};
  });
  return {cashUsd:evmUsdcCash(balances),
    totalUsd:balances.reduce((n,b)=>n+Number(b.notional),0),holdings:balances,openPositions:positions.filter(p=>p.status!=='closed'),closedPositions:positions.filter(p=>p.status==='closed'),checkedAt:new Date().toISOString()};
}
