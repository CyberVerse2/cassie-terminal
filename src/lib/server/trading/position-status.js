const terminal=new Set(['ORDER_STATUS_FILLED','ORDER_STATUS_CANCELLED','ORDER_STATUS_REJECTED','ORDER_STATUS_TERMINATED']);
const quantity=value=>{const text=String(value??'0');if(!/^\d+(\.\d{1,36})?$/.test(text))throw new Error('Invalid fill quantity.');const [whole,fraction='']=text.split('.');return BigInt(whole+fraction.padEnd(36,'0'));};
// Entry filled is an OPEN position, not a completed round trip. Release capital
// only after finalized exit fills cover every finalized entry fill.
export function positionStatus(entry, exit, intent) {
  const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
  const order=entry?.order;
  if(!same(order?.funderAddress,intent.address)||!same(order?.targetAsset?.address,intent.asset)||order.side!=='buy')throw new Error('Order identity mismatch.');
  const received=quantity(order.filled?.targetAmount);
  const entryFinal=Array.isArray(entry.fills)&&entry.fills.every(f=>f.status==='CHAIN_STATUS_FINALIZED');
  if(terminal.has(order.status)&&received===0n&&entryFinal&&entry.fills.length===0)return 'rejected';
  if(!exit)return received>0n?'open':'pending';
  if(!same(exit.order?.funderAddress,intent.address)||exit.order?.sourceEntryOrderId!==order.orderId||!same(exit.order?.targetAsset?.address,intent.asset)||exit.order?.side!=='sell')throw new Error('Exit identity mismatch.');
  const sold=quantity(exit.order.filled?.targetAmount);
  const exitFinal=Array.isArray(exit.fills)&&exit.fills.length>0&&exit.fills.every(f=>f.status==='CHAIN_STATUS_FINALIZED');
  if(terminal.has(order.status)&&terminal.has(exit.order.status)&&entryFinal&&entry.fills.length>0&&exitFinal&&received>0n&&sold>=received)return 'closed';
  if(terminal.has(exit.order.status))return 'needs_review';
  return 'open';
}
