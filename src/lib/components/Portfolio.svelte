<script>
  import PortfolioTrading from './PortfolioTrading.svelte';
  import { X } from '@lucide/svelte';
  import { authUi } from '$lib/auth-ui.svelte.js';
  let { vals } = $props();
</script>

<button type="button" aria-label="Close portfolio" onclick={vals.togglePortfolio} style="position:fixed; inset:0; border:0; padding:0; background:rgba(0,0,0,0.6); backdrop-filter:blur(3px); z-index:80"></button>
<div style="position:fixed; top:0; right:0; bottom:0; box-sizing:border-box; width:560px; max-width:100vw; background:#0b0b0b; border-left:1px solid rgba(255,255,255,0.09); z-index:81; overflow-y:auto; padding:26px 30px 50px; animation:slideIn 0.28s cubic-bezier(0.22,1,0.36,1) both">
  <div style="display:flex; align-items:center; justify-content:space-between">
    <div style="font-size:22px; font-weight:700; letter-spacing:-0.02em">Portfolio</div>
    <button class="hov hov-text" type="button" aria-label="Close portfolio" onclick={vals.togglePortfolio} style="width:30px; height:30px; border-radius:8px; border:1px solid rgba(255,255,255,0.11); background:transparent; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#8c8c8c"><X size={16} aria-hidden="true" /></button>
  </div>
  <div style="margin-top:6px; font-size:13px; color:#8c8c8c">Manage your wallet, funding, and trading permissions.</div>

  {#if authUi.user}
    <div class="account">
      <div class="account-copy">
        <p class="account-email">{authUi.user.email ?? 'Signed in'}</p>
        {#if authUi.devicePending}
          <p class="account-hint">A confirmation link was sent. Open that email on this machine.</p>
        {/if}
      </div>
      <button class="account-btn" type="button" onclick={() => authUi.signOut()}>Sign out</button>
    </div>
  {/if}

  <PortfolioTrading>
  {#if vals.portfolioError}
    <div role="alert" style="margin-top:14px; color:#FF78B8; font-size:13px">{vals.portfolioError}</div>
  {/if}

  <div style="margin-top:34px; font-size:10px; letter-spacing:0.13em; font-weight:700; color:#6e6e6e">BALANCES</div>
  <div style="display:flex; gap:40px; align-items:flex-end; margin-top:12px; flex-wrap:wrap">
    <div>
      <div style="font-size:9px; letter-spacing:0.13em; font-weight:700; color:#6e6e6e; margin-bottom:6px">TOTAL</div>
      <div style="font-family:var(--font-mono); font-size:38px; font-weight:600; line-height:1">{vals.totalFmt}</div>
    </div>
    <div>
      <div style="font-size:9px; letter-spacing:0.13em; font-weight:700; color:#6e6e6e; margin-bottom:6px">AVAILABLE</div>
      <div style="font-family:var(--font-mono); font-size:19px; line-height:1">{vals.cashFmt}</div>
    </div>
    <div>
      <div style="font-size:9px; letter-spacing:0.13em; font-weight:700; color:#6e6e6e; margin-bottom:6px">UNREALIZED</div>
      <div style="font-family:var(--font-mono); font-size:19px; line-height:1; color:{vals.upnlColor}">{vals.upnlFmt}</div>
    </div>
  </div>

  <div style="display:flex; height:9px; border-radius:999px; overflow:hidden; margin-top:24px">
    {#each vals.allocSegs as s}
      <div style="width:{s.w}; background:{s.color}"></div>
    {/each}
  </div>
  <div style="display:flex; gap:20px; margin-top:11px; flex-wrap:wrap">
    {#each vals.allocSegs as s}
      <div style="display:flex; align-items:center; gap:7px">
        <span style="width:7px; height:7px; border-radius:50%; background:{s.color}"></span>
        <span style="font-size:12px; color:#8c8c8c">{s.label}</span>
        <span style="font-family:var(--font-mono); font-size:11px; color:#6e6e6e">{s.pct}</span>
      </div>
    {/each}
  </div>

  <div style="margin-top:34px">
    <div style="font-size:10px; letter-spacing:0.13em; font-weight:700; color:#6e6e6e; margin-bottom:12px">OPEN POSITIONS</div>
    {#if vals.hasPositions}
      {#each vals.posRows as p}
        <div style="display:flex; justify-content:space-between; align-items:center; gap:14px; padding:15px 0; border-top:1px solid rgba(255,255,255,0.06)">
          <div style="min-width:0; flex:1">
            <div style="font-size:14.5px; font-weight:600; line-height:1.3; text-wrap:pretty">{p.market}</div>
            <div style="margin-top:3px; font-size:11.5px; color:#6e6e6e"><span style="color:{p.dirColor}; font-weight:700">{p.dir}</span> · {p.venue} · {p.sizeFmt}</div>
            <div style="margin-top:2px; font-family:var(--font-mono); font-size:11px; color:#8c8c8c">{p.entryNow}</div>
          </div>
          <div style="text-align:right; flex-shrink:0">
            <div style="font-family:var(--font-mono); font-size:14px; color:{p.pnlColor}">{p.pnlFmt}</div>
            {#if p.close}<button class="hov hov-close" type="button" onclick={p.close} disabled={p.closing} style="margin-top:7px; background:transparent; font-size:11px; font-weight:600; color:#8c8c8c; border:1px solid rgba(255,255,255,0.12); border-radius:7px; padding:5px 12px; cursor:{p.closing ? 'wait' : 'pointer'}">{p.closing ? 'Closing…' : 'Close'}</button>{/if}
          </div>
        </div>
      {/each}
    {/if}
    {#if vals.noPositions}
      <div style="border:1px dashed rgba(255,255,255,0.12); border-radius:12px; padding:32px; text-align:center; color:#6e6e6e; font-size:13px">No open positions yet. Pick an idea from The Desk to get started.</div>
    {/if}
  </div>

  {#if vals.hasClosedPositions}
    <div style="margin-top:34px">
      <div style="font-size:10px; letter-spacing:0.13em; font-weight:700; color:#6e6e6e; margin-bottom:12px">CLOSED POSITIONS</div>
      {#each vals.closedRows as p}
        <div style="display:flex; justify-content:space-between; align-items:center; gap:14px; padding:13px 0; border-top:1px solid rgba(255,255,255,0.06)">
          <div style="min-width:0; flex:1">
            <div style="font-size:13.5px; font-weight:600; line-height:1.3; text-wrap:pretty">{p.market}</div>
            <div style="margin-top:3px; font-size:11px; color:#6e6e6e"><span style="color:{p.dirColor}; font-weight:700">{p.dir}</span> · {p.venue} · {p.sizeFmt}</div>
            <div style="margin-top:2px; font-family:var(--font-mono); font-size:10.5px; color:#8c8c8c">{p.entryNow}</div>
          </div>
          <div style="font-family:var(--font-mono); font-size:13px; color:{p.pnlColor}">{p.pnlFmt}</div>
        </div>
      {/each}
    </div>
  {/if}
  </PortfolioTrading>
</div>

<style>
  .account {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
    margin-top: 22px;
    padding-bottom: 4px;
  }
  .account-copy { min-width: 0; }
  .account-email {
    margin: 0;
    color: #e6e6e6;
    font-size: 13px;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }
  .account-hint { margin: 6px 0 0; color: #8c8c8c; font-size: 12px; line-height: 1.4; }
  .account-btn {
    flex-shrink: 0;
    background: transparent;
    border: 0;
    padding: 0;
    color: #8c8c8c;
    font: 600 11px var(--font-ui);
    cursor: pointer;
  }
  .account-btn:focus-visible { outline: 2px solid #B5F20B; outline-offset: 3px; }
</style>
