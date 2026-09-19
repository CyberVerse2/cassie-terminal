import { building } from '$app/environment';
import { managePositions } from '$lib/server/trading/manager';
let started=false;
export async function init(){
  if(building||started)return;
  started=true;
  const run=()=>managePositions().catch(error=>console.error('Position management unavailable:',error.message));
  void run();
  setInterval(run,15_000).unref();
}
