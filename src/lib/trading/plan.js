export function publishableRoute(route, now = Date.now()) {
  if (route?.status !== 'routed' || route.venue !== 'definitive' || !['shares', 'spot'].includes(route.instrument)) return false;
  const plan = route.marketMeta?.executionPlan;
  return plan?.version === 1 && Number.isFinite(Date.parse(plan.expiresAt)) && Date.parse(plan.expiresAt) > now;
}

export function validatedPlan(plan,asset,now=Date.now()) {
  if(plan?.version!==1||plan.basis!=='cassie'||plan.priceBasis!=='token'||plan.assetKey!==`${asset.chain}:${asset.address.toLowerCase()}`)throw Error('This idea needs an asset-specific trading plan.');
  if(!Number.isFinite(Date.parse(plan.expiresAt))||Date.parse(plan.expiresAt)<=now)throw Error('This trading thesis has expired.');
  if(!Number.isFinite(plan.entryPrice)||plan.entryPrice<=0||!Number.isFinite(plan.stopPrice)||plan.stopPrice<=0||plan.stopPrice>=plan.entryPrice)throw Error('Invalid plan entry or stop.');
  let prior=plan.entryPrice,total=0;
  if(!Array.isArray(plan.targets)||!plan.targets.length||plan.targets.length>3)throw Error('Missing profit targets.');
  for(const t of plan.targets){if(!Number.isFinite(t.price)||t.price<=prior||!Number.isInteger(t.percent)||t.percent<=0)throw Error('Invalid staged exit.');prior=t.price;total+=t.percent;}
  if(total!==100)throw Error('Exit allocations must total 100%.');
  if(!Number.isFinite(plan.trailingStopPct)||plan.trailingStopPct<0||plan.trailingStopPct>30||!Number.isFinite(plan.breakevenAtPct)||plan.breakevenAtPct<0||plan.breakevenAtPct>100)throw Error('Invalid management limits.');
  return plan;
}
export function entryInRange(price, plan) {
  return Number.isFinite(price) && price > plan.stopPrice && price < plan.targets[0].price;
}
// Decisions can only reduce a position or tighten its stop. They never add
// capital, lower a stop, or infer executable prices from free-form prose.
export function managementDecision(plan,state,price,now=Date.now()) {
  if(!Number.isFinite(price)||price<=0)return null;
  const stop=Math.max(plan.stopPrice,state.stopPrice??0);
  if(price<=stop)return {type:'close',key:'stop',reason:'Protective stop reached.'};
  if(now>=Date.parse(plan.expiresAt))return {type:'close',key:'expiry',reason:'The approved trade duration has ended.'};
  const next=plan.targets.findIndex((_,i)=>!(state.completedTargets??[]).includes(i));
  if(next>=0&&price>=plan.targets[next].price)return {type:'reduce',key:`target-${next}`,index:next,percent:plan.targets[next].percent,reason:`Profit target ${next+1} reached.`};
  const high=Math.max(state.highWater??price,price);
  const breakeven=plan.breakevenAtPct>0&&price>=state.entryPrice*(1+plan.breakevenAtPct/100)?state.entryPrice:0;
  const trailing=plan.trailingStopPct>0?high*(1-plan.trailingStopPct/100):0;
  const tightened=Math.max(stop,breakeven,trailing);
  if(tightened>stop&&tightened<price)return {type:'tighten',price:tightened,highWater:high,reason:breakeven>=trailing?'Move protection to the entry price.':'Raise the trailing stop as the position gains.'};
  return null;
}
