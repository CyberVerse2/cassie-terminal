<script>
  import { tradingSetup, beginSetup, openSetup, loadTradingSettings } from '$lib/trading/session.svelte.js';
  import { executionDelegation } from '$lib/trading/approval.js';
  import { estimateOutcome, usd } from '$lib/trading/settings.js';
  import { authHeaders } from '$lib/dynamic/auth.js';
  import { ArrowUpRight, LoaderCircle, X } from '@lucide/svelte';
  let { vals } = $props();
  let focus = $state('target');
  let submitting=$state(false), executionError=$state(''), executedIdea=$state(null);
  const approvedWallets=$derived(tradingSetup.wallets.filter(w=>w.delegated&&w.chain==='EVM'));
  const approvedWallet=$derived(approvedWallets.find(w=>w.address===tradingSetup.approvedWalletAddress)||(approvedWallets.length===1?approvedWallets[0]:null));
  async function execute(){
    if(!tradingSetup.settings||!approvedWallet){beginSetup();return;}
    const ideaId=vals.aiPlan.ideaId;
    const owner=tradingSetup.userId, address=approvedWallet.address;
    submitting=true;executionError='';
    try{
      await loadTradingSettings();
      if(tradingSetup.userId!==owner)throw new Error('Your account changed. Reopen this trade.');
      const current=tradingSetup.wallets.find(w=>w.address===address);
      const wallet=executionDelegation(current,tradingSetup);
      if(!wallet)throw new Error('Cassie’s trading connection is unavailable. Check its status in Portfolio. Your existing wallet approval does not need to be repeated.');
      const response=await fetch('/api/trading/orders',{method:'POST',headers:{'content-type':'application/json',...authHeaders()},body:JSON.stringify({ideaId,walletId:wallet.walletId})});
      const result=await response.json();
      if(!response.ok)throw new Error(result.error||'The trade could not be submitted.');
      executedIdea=ideaId;
    }catch(e){executionError=e.message;}finally{submitting=false;}
  }
  $effect(() => { vals.orderTicker; focus = 'target'; });

  const bookRows = $derived(vals.posRows || []);
  const estimate = $derived(estimateOutcome(vals.aiPlan, tradingSetup.settings?.amountUsd, focus));
</script>

<aside class="trade-rail" style={vals.tradeContainerStyle} aria-label="AI trade plan">
  {#if vals.showTradeHeader}
    <button class="close" type="button" aria-label="Close trade plan" onclick={vals.closeTrade}><X size={16} /></button>
  {/if}

  {#if !vals.hasSel}
    <div class="empty"><div class="empty-orbit"><ArrowUpRight size={30} aria-hidden="true" /></div><p>A thesis is the beginning.<br />Let’s find your trade.</p><small>Select an idea from the feed.</small></div>
  {:else if vals.setupLoading}
    <div class="loading" role="status"><span class="thinking"><LoaderCircle size={16} aria-hidden="true" /></span>Working through the trade…</div>
  {:else if vals.t_detailError}
    <p class="message" role="alert">I couldn’t load this analysis. Refresh the feed to try again.</p>
  {:else if vals.aiPlan}
    <article class="plan" aria-label={`Trade plan for ${vals.aiPlan.market}`}>
      <div class="opening">
        <p class="intent">{vals.aiPlan.action ? `I’ll ${vals.aiPlan.action}` : 'I’m watching'}</p>
        <h3>{vals.aiPlan.market}</h3>
      </div>

      <div class="scenario" class:risk-focus={focus==='stop'} aria-label={`Entry ${vals.aiPlan.entry || 'unavailable'}. Take profit ${vals.aiPlan.targetLevel || 'unset'}. Exit ${vals.aiPlan.stopLevel || 'unset'}.`}>
        <svg viewBox="0 0 280 136" fill="none" aria-hidden="true">
          <defs><pattern id="plan-dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".65" fill="currentColor" /></pattern></defs>
          <rect width="280" height="136" fill="url(#plan-dots)" class="grid" />
          <path d="M18 65H90" class="approach" />
          <path d="M90 65C130 65 135 28 170 28H244" class="profit-path" />
          <path d="M90 65C130 65 135 103 170 103H244" class="stop-path" />
          <circle cx="90" cy="65" r="13" class="origin-halo" /><circle cx="90" cy="65" r="4" class="origin" />
          <circle cx="244" cy="28" r="3.5" class="profit-node" />
          <circle cx="244" cy="103" r="3.5" class="stop-node" />
          <text x="90" y="44" text-anchor="middle" class="map-label">ENTRY</text>
          <text x="90" y="90" text-anchor="middle" class="entry-price">{vals.aiPlan.entry || '—'}</text>
          <text x="236" y="16" text-anchor="end" class="profit-label">TAKE PROFIT</text>
          <text x="236" y="42" text-anchor="end" class="profit-level">{vals.aiPlan.targetLevel || '—'}</text>
          <text x="236" y="92" text-anchor="end" class="stop-label">EXIT</text>
          <text x="236" y="118" text-anchor="end" class="stop-level">{vals.aiPlan.stopLevel || '—'}</text>
        </svg>
      </div>

      <div class="outcomes" role="group" aria-label="Explore the trade outcomes">
        <button class:active={focus==='target'} class="outcome target" type="button" aria-pressed={focus==='target'} onclick={()=>focus='target'}>If I’m right</button>
        <button class:active={focus==='stop'} class="outcome stop" type="button" aria-pressed={focus==='stop'} onclick={()=>focus='stop'}>If I’m wrong</button>
      </div>
      <div class="outcome-copy" class:loss={focus==='stop'} aria-live="polite">
        {#if estimate}
          <p class="outcome-amount">{estimate.pnl>=0?'+':'−'}{usd(Math.abs(estimate.pnl))}</p>
          <p class="outcome-caption">Estimated {focus==='target'?'profit':'loss'} at {usd(estimate.exit)} · before fees</p>
        {:else if tradingSetup.settings}<p class="outcome-caption">A dollar estimate needs valid entry and exit prices for this asset.</p>{/if}
        <p class="outcome-body">{focus==='target' ? (vals.aiPlan.target || 'I still need a take-profit target for this thesis.') : (vals.aiPlan.stop || 'I still need an exit condition to protect this trade.')}</p>
      </div>

      {#if vals.aiPlan.reason}
        <details class="why">
          <summary>Why</summary>
          <p class="why-body">{vals.aiPlan.reason}</p>
        </details>
      {/if}
      <div class="execution">
        {#if tradingSetup.settings}<button class="settings-note" onclick={()=>openSetup(1)}>Using {usd(tradingSetup.settings.amountUsd)} · your trading settings</button>{/if}
        <button class="execute" type="button" disabled={submitting||executedIdea===vals.aiPlan.ideaId} onclick={execute}>{submitting?'Submitting trade…':executedIdea===vals.aiPlan.ideaId?'Trade submitted':'Execute trade'}</button>
        {#if executionError}<p class="execution-error" role="alert">{executionError}</p>{/if}
        {#if executedIdea===vals.aiPlan.ideaId}<p class="execution-status" role="status">Sent to Definitive. Follow its fill and exit orders in Portfolio.</p>{/if}
      </div>
      {#if vals.aiPlan.horizon}
        <p class="horizon"><span>Trade duration</span>{vals.aiPlan.horizon}</p>
      {/if}

      <section class="book" aria-label="Open positions">
        <p class="book-kicker">Open</p>
        {#each bookRows as p}
          <div class="pos">
            <div class="pos-main">
              <p class="pos-market">{p.market}</p>
              <p class="pos-meta"><span style="color:{p.dirColor}">{p.dir}</span> · {p.venue} · {p.sizeFmt}</p>
              <p class="pos-marks">{p.entryNow}</p>
            </div>
            <div class="pos-side">
              <p class="pos-pnl" style="color:{p.pnlColor}">{p.pnlFmt}</p>
              {#if p.close}
                <button class="pos-close" type="button" onclick={p.close} disabled={p.closing}>{p.closing ? 'Closing…' : 'Close'}</button>
              {/if}
            </div>
          </div>
        {/each}
      </section>
    </article>
  {:else}
    <p class="message">I need more analysis before I can prepare this trade.</p>
  {/if}
</aside>

<style>
  .trade-rail { box-sizing:border-box; color:#eee; font-family:var(--font-ui); display:flex; flex-direction:column; height:100%; }
  button { font:inherit; } .close { display:grid; place-items:center; width:28px; height:28px; margin-left:auto; padding:0; border:1px solid #303030; border-radius:4px; background:none; color:#aaa; cursor:pointer; }
  button:focus-visible,summary:focus-visible { outline:2px solid #B5F20B; outline-offset:3px; }
  .plan { margin-top:0; } p { margin:0; overflow-wrap:anywhere; text-wrap:pretty; }
  .execution-error,.execution-status { margin-top:10px; font-size:12px; line-height:1.6; }.execution-error{color:#F098C1}.execution-status{color:#aaa}
  .intent { color:#8a8a8a; font-size:12px; font-weight:500; line-height:1.2; }
  h3 { margin:2px 0 0; color:#B5F20B; font-size:42px; line-height:.95; font-weight:500; letter-spacing:-1.6px; overflow-wrap:anywhere; }
  .scenario { margin:10px -5px 10px; }.scenario svg { display:block; width:100%; height:auto; }.grid { color:#343434; opacity:.7; }
  .approach { stroke:#777; stroke-width:1.5; stroke-dasharray:3 4; }.origin { fill:#ddd; }.origin-halo { fill:#161616; stroke:#444; }
  .profit-path,.stop-path { stroke-width:1.5; stroke-linecap:round; transition:stroke .22s,opacity .22s; }.profit-path { stroke:#B5F20B; }.stop-path { stroke:#814260; opacity:.65; }
  .risk-focus .profit-path { stroke:#5c6e37; opacity:.6; }.risk-focus .stop-path { stroke:#F078B2; opacity:1; }
  .map-label,.profit-label,.stop-label { font:8px var(--font-mono); letter-spacing:.5px; }.map-label { fill:#888; }.profit-label { fill:#B5F20B; }.stop-label { fill:#bb819d; }.risk-focus .stop-label { fill:#F078B2; }
  .entry-price,.profit-level,.stop-level { font:10px var(--font-mono); }
  .entry-price { fill:#d0d0d0; }.profit-level { fill:#C0F35D; }.stop-level { fill:#d7a0b8; }.risk-focus .stop-level { fill:#F098C1; }
  .profit-node { fill:#B5F20B; }.stop-node { fill:#814260; }.risk-focus .stop-node { fill:#F078B2; }
  .outcomes { display:flex; justify-content:space-between; gap:16px; border-bottom:1px solid #242424; }
  .outcome { padding:0 0 11px; border:0; background:none; color:#5a5a5a; font-size:13px; font-weight:500; letter-spacing:-.02em; cursor:pointer; box-shadow:inset 0 -1.5px 0 transparent; }
  .outcome:hover { color:#9a9a9a; }
  .target.active { color:#C0F35D; box-shadow:inset 0 -1.5px 0 #B5F20B; }
  .stop.active { color:#F098C1; box-shadow:inset 0 -1.5px 0 #F078B2; }
  .outcome-copy { padding:16px 0 4px; }
  .outcome-amount { font:500 28px var(--font-mono); color:#B5F20B; letter-spacing:-1px; margin-bottom:6px; }
  .loss .outcome-amount { color:#F078B2; }
  .outcome-caption { font-size:11px; color:#888; line-height:1.6; margin-bottom:12px; }
  .settings-note { display:block; padding:0; margin:0 0 10px; border:0; background:none; color:#999; font-size:11px; cursor:pointer; }
  .outcome-body { color:#c4c4c4; font-size:14px; line-height:1.55; max-width:36ch; }
  .why { margin-top:18px; padding-top:16px; border-top:1px solid #242424; }
  .why summary { display:flex; align-items:center; justify-content:space-between; list-style:none; cursor:pointer; color:#8a8a8a; font:9px var(--font-mono); letter-spacing:.1em; text-transform:uppercase; }
  .why summary::-webkit-details-marker { display:none; }
  .why summary::after { content:'+'; font-size:13px; font-weight:400; color:#555; line-height:1; }
  .why[open] summary::after { content:'–'; }
  .why-body { margin-top:8px; color:#c4c4c4; font-size:14px; line-height:1.55; max-width:36ch; }
  .horizon { display:flex; flex-wrap:wrap; align-items:baseline; gap:8px; margin-top:18px; padding-top:16px; border-top:1px solid #242424; color:#9a9a9a; font-size:12px; line-height:1.4; }
  .horizon span { color:#5a5a5a; font:9px var(--font-mono); letter-spacing:.1em; text-transform:uppercase; }
  .execution { margin-top:22px; }
  .execute {
    width: 100%;
    height: 44px;
    border: 0;
    border-radius: 4px;
    background: #B5F20B;
    color: #111;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: -0.01em;
    cursor: pointer;
  }
  .execute:disabled { opacity: 1; }
  .book { margin-top:22px; padding-top:20px; border-top:1px solid #242424; }
  .book-kicker { margin:0 0 4px; color:#8a8a8a; font:9px var(--font-mono); letter-spacing:.1em; text-transform:uppercase; }
  .pos { display:flex; justify-content:space-between; align-items:flex-start; gap:14px; padding:12px 0; border-top:1px solid #242424; }
  .pos-main { min-width:0; }
  .pos-market { font-size:14px; font-weight:500; letter-spacing:-.02em; }
  .pos-meta { margin-top:3px; color:#6e6e6e; font-size:11px; }
  .pos-marks { margin-top:3px; color:#8a8a8a; font:11px var(--font-mono); }
  .pos-side { flex-shrink:0; text-align:right; }
  .pos-pnl { font:13px var(--font-mono); }
  .pos-close { margin-top:7px; border:0; padding:0; background:none; color:#6e6e6e; font-size:11px; font-weight:500; cursor:pointer; }
  .pos-close:hover { color:#eee; }
  .pos-close:disabled { cursor:wait; color:#555; }
  .empty { padding-top:70px; }.empty-orbit { display:grid; place-items:center; width:64px; height:64px; border:1px solid #384124; border-radius:50%; color:#B5F20B; font-size:30px; margin-bottom:25px; }.empty p { font-size:20px; line-height:1.45; letter-spacing:-.5px; }.empty small { display:block; color:#777; font-size:12px; margin-top:15px; }.message { padding:30px 0; font-size:13px; line-height:1.7; color:#999; }
  .loading { display:flex; align-items:center; gap:10px; padding:35px 0; color:#999; font-size:12px; }.thinking { display:flex; color:#B5F20B; animation:spin 1.5s linear infinite; }@keyframes spin { to { transform:rotate(360deg); } }
  @media(prefers-reduced-motion:reduce) { .thinking { animation:none; }.profit-path,.stop-path { transition:none; } }
  @media(max-width:640px) { h3 { font-size:36px; }.scenario { max-width:330px; margin-inline:auto; width:100%; } }
</style>
