<script>
  import { Copy, Wallet, SlidersHorizontal, ShieldOff, ArrowRight } from '@lucide/svelte';
  import { authUi } from '$lib/auth-ui.svelte.js';
  import { tradingSetup, openSetup, createTradingWallet, revokeTradingAccess, loadTradingSettings } from '$lib/trading/session.svelte.js';
  import { usd } from '$lib/trading/settings.js';
  import { authHeaders } from '$lib/dynamic/auth.js';
  let error=$state(''), busy=$state(false), copied=$state('');
  let orders=$state([]), ordersError=$state('');
  async function loadOrders(){
    const owner=tradingSetup.userId;if(!owner)return;
    try{const response=await fetch('/api/trading/orders',{headers:authHeaders()});const data=await response.json();if(!response.ok)throw new Error(data.error||'Could not load live trades.');if(tradingSetup.userId===owner){orders=data.orders;ordersError='';}}
    catch(e){if(tradingSetup.userId===owner)ordersError=e.message;}
  }
  $effect(()=>{const owner=tradingSetup.userId;orders=[];ordersError='';if(!owner)return;loadOrders();const timer=setInterval(loadOrders,20000);return()=>clearInterval(timer);});
  const statusLabel={reserved:'Preparing',submitting:'Submitting',pending:'Waiting for fill',open:'Position open',closed:'Position closed',rejected:'Not executed',needs_review:'Check execution status'};
  async function run(action){busy=true;error='';try{await action();}catch(e){error=e.message;}finally{busy=false;}}
  async function copy(wallet){await navigator.clipboard.writeText(wallet.address);copied=wallet.id;}
</script>
<section class="trading-controls" aria-label="Wallet and trading permissions">
  <header><h2>Your trading account</h2><Wallet size={18}/></header>
  {#if !authUi.user}<p>Sign in to fund a wallet and save your trading limits.</p><button onclick={()=>authUi.openSignIn()}>Sign in <ArrowRight size={14}/></button>
  {:else}
    {#if tradingSetup.loading}<p role="status">Loading your settings…</p>{:else if tradingSetup.error}<p class="error" role="alert">{tradingSetup.error}</p><button onclick={loadTradingSettings}>Try again</button>{/if}
    {#if tradingSetup.settings}<dl><div><dt>Per trade</dt><dd>{usd(tradingSetup.settings.amountUsd)}</dd></div><div><dt>Maximum capital</dt><dd>{usd(tradingSetup.settings.maxDeployedUsd)}</dd></div><div><dt>Open positions</dt><dd>{tradingSetup.settings.maxPositions} maximum</dd></div></dl>{/if}
    <button disabled={busy||tradingSetup.loading} onclick={()=>openSetup(tradingSetup.settings?1:0)}><SlidersHorizontal size={14}/>{tradingSetup.settings?'Edit trading limits':'Set up trading'}</button>
    <div class="wallets">
      {#each tradingSetup.wallets as wallet}
        <div class="wallet"><strong>{wallet.chain==='SOL'?'Solana':'EVM'} wallet</strong><code>{wallet.address}</code><button disabled={busy} onclick={()=>run(()=>copy(wallet))}><Copy size={13}/>{copied===wallet.id?'Copied':'Copy funding address'}</button><p>Send assets only on a compatible network. Transfers do not activate trading permissions.</p>
          {#if wallet.delegated}<p>Wallet delegation is active.</p><button class="revoke" disabled={busy} onclick={()=>run(()=>revokeTradingAccess(wallet))}><ShieldOff size={14}/>Revoke trading access</button><p>Revocation stops new signatures. It does not cancel orders already submitted.</p>{:else}<p>Trading permissions are off.</p>{/if}
        </div>
      {:else}
        <p>Create a wallet to receive funds.</p><div class="wallet-actions"><button disabled={busy} onclick={()=>run(()=>createTradingWallet('EVM'))}>Create EVM wallet</button><button disabled={busy} onclick={()=>run(()=>createTradingWallet('SOL'))}>Create Solana wallet</button></div>
      {/each}
    </div>
    <section class="live-orders" aria-label="Definitive trades"><h3>Your trades</h3>
      {#each orders as order}<div class="live-order"><strong>{order.ticker}</strong><span>{usd(Number(order.amount))} · {statusLabel[order.status]||order.status}</span>
        {#if order.result?.entry?.order?.attachedBracket?.status==='active'&&order.status==='open'}<p>Take-profit and stop-loss orders are active on Definitive.</p>{/if}
      </div>{:else}<p>No live trades yet.</p>{/each}
      {#if ordersError}<p class="error" role="alert">{ordersError}</p><button onclick={loadOrders}>Refresh trades</button>{/if}
    </section>
  {/if}
  {#if busy}<p role="status">Complete the wallet request…</p>{/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>
<style>
.trading-controls{margin-top:24px;border:1px solid #303030;border-radius:7px;padding:18px;background:#111}.trading-controls header{display:flex;justify-content:space-between;align-items:center;color:#B5F20B}h2{font-size:15px;font-weight:500;color:#eee;margin:0}p{font-size:12px;line-height:1.6;color:#999;margin:12px 0}button{display:inline-flex;align-items:center;justify-content:center;gap:7px;font:12px var(--font-ui);border:1px solid #3c4729;border-radius:4px;padding:9px 11px;background:#202914;color:#bfd990;cursor:pointer}button:disabled{opacity:.5;cursor:wait}button:focus-visible{outline:2px solid #B5F20B;outline-offset:3px}dl{display:grid;gap:10px;margin:20px 0}dl>div{display:flex;justify-content:space-between;gap:10px;font-size:12px}dt{color:#999}dd{margin:0;font-family:var(--font-mono);color:#eee}.wallet{border-top:1px solid #303030;margin-top:18px;padding-top:16px}.wallet strong{font-size:12px;font-weight:500}.wallet code{display:block;font:11px var(--font-mono);overflow-wrap:anywhere;color:#aaa;margin:10px 0}.wallet p{font-size:11px}.wallet-actions{display:flex;flex-wrap:wrap;gap:7px}.revoke{border-color:#553043;background:#27171f;color:#ed9bc2}.error{color:#F098C1}
</style>
