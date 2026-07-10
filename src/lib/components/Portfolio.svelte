<script>
  import { X } from '@lucide/svelte';
  let { vals } = $props();
</script>

<button type="button" aria-label="Close portfolio" onclick={vals.togglePortfolio} style="position:fixed; inset:0; border:0; padding:0; background:rgba(6,7,9,0.6); backdrop-filter:blur(3px); z-index:80"></button>
<div style="position:fixed; top:0; right:0; bottom:0; width:560px; max-width:92vw; background:#0C0D11; border-left:1px solid rgba(255,255,255,0.09); z-index:81; overflow-y:auto; padding:26px 30px 50px; animation:slideIn 0.28s cubic-bezier(0.22,1,0.36,1) both">
  <div style="display:flex; align-items:center; justify-content:space-between">
    <div style="font-size:22px; font-weight:700; letter-spacing:-0.02em">Portfolio</div>
    <button class="hov hov-text" type="button" aria-label="Close portfolio" onclick={vals.togglePortfolio} style="width:30px; height:30px; border-radius:8px; border:1px solid rgba(255,255,255,0.11); background:transparent; display:flex; align-items:center; justify-content:center; cursor:pointer; color:#8A8C93"><X size={16} aria-hidden="true" /></button>
  </div>
  <div style="margin-top:6px; font-size:13px; color:#8A8C93">Deployed and available across every venue.</div>
  {#if vals.portfolioError}
    <div role="alert" style="margin-top:14px; border:1px solid rgba(224,96,85,.28); border-radius:9px; background:rgba(224,96,85,.08); padding:10px 12px; color:#E87970; font-size:11px">{vals.portfolioError}</div>
  {/if}

  <div style="display:flex; gap:40px; align-items:flex-end; margin-top:26px; flex-wrap:wrap">
    <div>
      <div style="font-size:9px; letter-spacing:0.13em; font-weight:700; color:#6C6E75; margin-bottom:6px">TOTAL</div>
      <div style="font-family:'IBM Plex Mono',monospace; font-size:38px; font-weight:600; line-height:1">{vals.totalFmt}</div>
    </div>
    <div>
      <div style="font-size:9px; letter-spacing:0.13em; font-weight:700; color:#6C6E75; margin-bottom:6px">AVAILABLE</div>
      <div style="font-family:'IBM Plex Mono',monospace; font-size:19px; line-height:1">{vals.cashFmt}</div>
    </div>
    <div>
      <div style="font-size:9px; letter-spacing:0.13em; font-weight:700; color:#6C6E75; margin-bottom:6px">UNREALIZED</div>
      <div style="font-family:'IBM Plex Mono',monospace; font-size:19px; line-height:1; color:{vals.upnlColor}">{vals.upnlFmt}</div>
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
        <span style="font-size:12px; color:#8A8C93">{s.label}</span>
        <span style="font-family:'IBM Plex Mono',monospace; font-size:11px; color:#6C6E75">{s.pct}</span>
      </div>
    {/each}
  </div>

  <div style="margin-top:34px">
    <div style="font-size:10px; letter-spacing:0.13em; font-weight:700; color:#6C6E75; margin-bottom:12px">OPEN POSITIONS</div>
    {#if vals.hasPositions}
      {#each vals.posRows as p}
        <div style="display:flex; justify-content:space-between; align-items:center; gap:14px; padding:15px 0; border-top:1px solid rgba(255,255,255,0.06)">
          <div style="min-width:0; flex:1">
            <div style="font-size:14.5px; font-weight:600; line-height:1.3; text-wrap:pretty">{p.market}</div>
            <div style="margin-top:3px; font-size:11.5px; color:#6C6E75"><span style="color:{p.dirColor}; font-weight:700">{p.dir}</span> · {p.venue} · {p.sizeFmt}</div>
            <div style="margin-top:2px; font-family:'IBM Plex Mono',monospace; font-size:11px; color:#8A8C93">{p.entryNow}</div>
          </div>
          <div style="text-align:right; flex-shrink:0">
            <div style="font-family:'IBM Plex Mono',monospace; font-size:14px; color:{p.pnlColor}">{p.pnlFmt}</div>
            <button class="hov hov-close" type="button" onclick={p.close} disabled={p.closing} style="margin-top:7px; background:transparent; font-size:11px; font-weight:600; color:#8A8C93; border:1px solid rgba(255,255,255,0.12); border-radius:7px; padding:5px 12px; cursor:{p.closing ? 'wait' : 'pointer'}">{p.closing ? 'Closing…' : 'Close'}</button>
          </div>
        </div>
      {/each}
    {/if}
    {#if vals.noPositions}
      <div style="border:1px dashed rgba(255,255,255,0.12); border-radius:12px; padding:32px; text-align:center; color:#6C6E75; font-size:13px">No open positions yet. Pick an idea from The Desk to get started.</div>
    {/if}
  </div>

  {#if vals.hasClosedPositions}
    <div style="margin-top:34px">
      <div style="font-size:10px; letter-spacing:0.13em; font-weight:700; color:#6C6E75; margin-bottom:12px">CLOSED POSITIONS</div>
      {#each vals.closedRows as p}
        <div style="display:flex; justify-content:space-between; align-items:center; gap:14px; padding:13px 0; border-top:1px solid rgba(255,255,255,0.06)">
          <div style="min-width:0; flex:1">
            <div style="font-size:13.5px; font-weight:600; line-height:1.3; text-wrap:pretty">{p.market}</div>
            <div style="margin-top:3px; font-size:11px; color:#6C6E75"><span style="color:{p.dirColor}; font-weight:700">{p.dir}</span> · {p.venue} · {p.sizeFmt}</div>
            <div style="margin-top:2px; font-family:'IBM Plex Mono',monospace; font-size:10.5px; color:#8A8C93">{p.entryNow}</div>
          </div>
          <div style="font-family:'IBM Plex Mono',monospace; font-size:13px; color:{p.pnlColor}">{p.pnlFmt}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>
