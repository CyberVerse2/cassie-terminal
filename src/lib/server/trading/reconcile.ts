import { flash } from './flash';
import { listOrders, updateOrder } from './orders';
import { positionStatus } from './position-status.js';
export async function reconcileOrders(userId:string){
  const orders=await listOrders(userId);
  await Promise.allSettled(orders.filter(o=>!(o.plan as any)?.version&&o.providerOrderId&&!['closed','rejected'].includes(String(o.status))).map(async o=>{
    const query=`?funderAddress=${encodeURIComponent(String(o.address))}`;
    const entry=await flash(`/orders/${encodeURIComponent(String(o.providerOrderId))}${query}`);
    if(entry.order?.orderId!==o.providerOrderId)throw new Error('Entry identity mismatch.');
    const exitId=entry.order.attachedBracket?.bracketOrderId;
    const exit=exitId?await flash(`/orders/${encodeURIComponent(exitId)}${query}`):null;
    if(exit&&exit.order?.orderId!==exitId)throw new Error('Exit identity mismatch.');
    const status=positionStatus(entry,exit,{address:o.address,asset:o.asset});
    await updateOrder(String(o.id),status,{entry,exit});
  }));
  return listOrders(userId);
}
