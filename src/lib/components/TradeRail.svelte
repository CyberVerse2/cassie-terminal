<script>
  let { vals } = $props();
</script>

<aside class="trade-rail" style={vals.tradeContainerStyle}>
  {#if vals.showTradeHeader}
    <div class="rail-header">
      <strong>Trade</strong>
      <button class="icon-button hov hov-text" type="button" aria-label="Close trade ticket" onclick={vals.closeTrade}>✕</button>
    </div>
  {/if}

  {#if !vals.hasSel}
    <div class="rail-empty">Select an idea from the feed.</div>
  {:else if vals.notPlaced}
    <div class="ticket">
      <div class="balance-row">
        <span>Available</span>
        <strong>{vals.cashFmt}</strong>
      </div>

      <section class="recommended-setup" aria-labelledby="recommended-setup-title">
        {#if vals.setupLoading}
          <div class="setup-loading" role="status">Loading recommended setup…</div>
        {:else if vals.recommendedSetupTags.length}
          <div class="setup-summary">
            <div>
              <strong id="recommended-setup-title">Recommended</strong>
              <div class="setup-tags">
                {#each vals.recommendedSetupTags as tag}
                  <span style="color:{tag.color}">{tag.value}</span>
                {/each}
              </div>
            </div>
            <button
              class="apply-setup-button hov hov-bright8"
              class:applied={vals.setupApplied}
              type="button"
              aria-label={vals.setupApplied ? 'Recommended setup applied' : 'Use recommended setup'}
              onclick={vals.applyRecommendedSetup}
              disabled={!vals.canApplySetup}
            >{vals.applySetupLabel}</button>
          </div>
          <details class="setup-details">
            <summary>Target &amp; stop</summary>
            <dl>
              {#each vals.recommendedPlanRows as row}
                <div>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              {/each}
            </dl>
          </details>
          {#if vals.setupIncomplete}<p class="incomplete">{vals.setupMessage}</p>{/if}
        {/if}
      </section>

      <div class="side-toggle" role="group" aria-label="Trade side">
        {#each vals.sideOptions as side}
          <button type="button" class:active={side.selected} aria-pressed={side.selected} onclick={side.onClick}>{side.label}</button>
        {/each}
      </div>

      <label class="amount-label" for="trade-amount">Amount</label>
      <div class="amount-field">
        <span>$</span>
        <input id="trade-amount" value={vals.amount} oninput={vals.onAmount} placeholder="0" inputmode="decimal" autocomplete="off" />
      </div>

      <div class="quick-amounts">
        {#each vals.quickChips as chip}
          <button class="quick-button hov hov-gold" type="button" onclick={chip.onClick}>{chip.label}</button>
        {/each}
      </div>

      <dl class="estimate">
        <div><dt>Position size</dt><dd>{vals.positionSizeFmt}</dd></div>
        <div><dt>Est. entry</dt><dd>{vals.estimatedEntryFmt}</dd></div>
        <div><dt>Est. fee</dt><dd>{vals.estimatedFeeFmt}</dd></div>
      </dl>

      <button class="place-button hov hov-bright8" type="button" onclick={vals.place} disabled={!vals.canPlace}
        style="background:{vals.placeBg}; color:{vals.placeFg}; cursor:{vals.placeCursor}">{vals.placeLabel}</button>
      {#if vals.tradeError}<p class="trade-error" role="alert">{vals.tradeError}</p>{/if}
      <p class="paper-note">Paper trade only. No order is sent.</p>

      <section class="positions-preview">
        <header>
          <strong>Open positions</strong>
          <button type="button" onclick={vals.togglePortfolio}>Portfolio →</button>
        </header>
        {#if vals.positionPreview.length}
          {#each vals.positionPreview as position}
            <div class="position-row">
              <div>
                <strong>{position.market}</strong>
                <span><b style="color:{position.dirColor}">{position.dir}</b> · {position.sizeFmt}</span>
              </div>
              <strong style="color:{position.pnlColor}">{position.pnlFmt}</strong>
            </div>
          {/each}
        {:else}
          <p class="positions-empty">No open positions</p>
        {/if}
      </section>
    </div>
  {:else}
    <div class="placed-state">
      <div class="success-mark">✓</div>
      <h2>Position opened</h2>
      <p>{vals.placedInfo}</p>
      <button class="primary-button hov hov-bright8" type="button" onclick={vals.togglePortfolio}>View portfolio</button>
      <button class="secondary-button hov hov-text" type="button" onclick={vals.resetTrade}>Place another</button>
    </div>
  {/if}
</aside>

<style>
  .trade-rail { box-sizing: border-box; }
  button, input { font: inherit; }
  .rail-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
  .rail-header > strong { font-size: 15px; }
  .icon-button { display: flex; width: 30px; height: 30px; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,0.11); border-radius: 8px; background: transparent; color: #8A8C93; cursor: pointer; }
  .rail-empty { padding: 16px 0; color: #777981; font-size: 13px; }
  .ticket { padding: 2px 0 28px; }
  .balance-row { display: flex; align-items: baseline; justify-content: space-between; }
  .balance-row span { color: #8F9198; font-size: 13px; }
  .balance-row strong { color: #E7E6E2; font-family: 'IBM Plex Mono', monospace; font-size: 16px; font-weight: 500; }
  .recommended-setup { margin-top: 16px; padding: 11px 12px; border: 1px solid rgba(216,184,126,0.2); border-radius: 10px; background: rgba(216,184,126,0.035); }
  .setup-summary { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .setup-summary > div { min-width: 0; }
  .setup-summary strong { display: block; color: #E7E6E2; font-size: 11px; }
  .setup-tags { display: flex; min-width: 0; align-items: center; gap: 5px; margin-top: 4px; }
  .setup-tags span { padding-right: 5px; border-right: 1px solid rgba(255,255,255,0.09); font-family: 'IBM Plex Mono', monospace; font-size: 8.5px; font-weight: 700; letter-spacing: 0.04em; white-space: nowrap; }
  .setup-tags span:last-child { padding-right: 0; border-right: 0; }
  .setup-details { margin-top: 7px; }
  .setup-details summary { width: fit-content; color: #8F9198; font-size: 9.5px; cursor: pointer; }
  .setup-details summary:hover { color: #D8B87E; }
  .recommended-setup dl { display: grid; gap: 7px; margin: 9px 0 2px; padding-top: 9px; border-top: 1px solid rgba(255,255,255,0.06); }
  .recommended-setup dl div { display: grid; grid-template-columns: 54px minmax(0,1fr); gap: 10px; align-items: baseline; }
  .recommended-setup dt { color: #777981; font-size: 10px; }
  .recommended-setup dd { display: -webkit-box; overflow: hidden; margin: 0; color: #C9CBD2; font-size: 10.5px; line-height: 1.35; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
  .setup-loading { color: #777981; font-size: 10px; }
  .apply-setup-button { flex-shrink: 0; min-width: 58px; height: 30px; padding: 0 10px; border: 1px solid rgba(216,184,126,0.42); border-radius: 7px; background: rgba(216,184,126,0.12); color: #D8B87E; font-size: 10px; font-weight: 700; cursor: pointer; }
  .apply-setup-button.applied { border-color: rgba(82,196,137,0.28); background: rgba(82,196,137,0.08); color: #52C489; }
  .apply-setup-button:disabled { cursor: default; }
  .recommended-setup p { margin: 7px 0 0; color: #696B72; font-size: 9.5px; line-height: 1.4; }
  .recommended-setup p.incomplete { color: #E87970; }
  .side-toggle { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 8px; margin-top: 20px; }
  .side-toggle button { height: 42px; border: 1px solid rgba(255,255,255,0.13); border-radius: 10px; background: transparent; color: #858790; font-size: 14px; font-weight: 700; cursor: pointer; }
  .side-toggle button.active { border-color: #37C98B; background: rgba(55,201,139,0.1); color: #52D49B; }
  .side-toggle button:focus-visible, .quick-button:focus-visible, .positions-preview button:focus-visible, .apply-setup-button:focus-visible { outline: 2px solid #D8B87E; outline-offset: 2px; }
  .amount-label { display: block; margin-top: 20px; color: #8F9198; font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; }
  .amount-field { display: flex; height: 58px; align-items: center; margin-top: 8px; padding: 0 15px; border: 1px solid rgba(255,255,255,0.14); border-radius: 12px; background: #0F1013; }
  .amount-field span { color: #777981; font-family: 'IBM Plex Mono', monospace; font-size: 22px; }
  .amount-field input { width: 100%; margin-left: 8px; border: 0; outline: 0; background: transparent; color: #E7E6E2; font-family: 'IBM Plex Mono', monospace; font-size: 22px; }
  .amount-field:focus-within { border-color: rgba(216,184,126,0.65); }
  .quick-amounts { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 6px; margin-top: 9px; }
  .quick-button { height: 34px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; background: transparent; color: #9A9CA3; font-family: 'IBM Plex Mono', monospace; font-size: 11px; cursor: pointer; }
  .estimate { display: grid; gap: 9px; margin: 20px 0 0; padding: 18px 0 0; border-top: 1px dashed rgba(255,255,255,0.09); }
  .estimate div { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; }
  .estimate dt { color: #8F9198; font-size: 12px; }
  .estimate dd { margin: 0; color: #D7D8DC; font-family: 'IBM Plex Mono', monospace; font-size: 12px; }
  .place-button, .primary-button, .secondary-button { width: 100%; border: 0; border-radius: 10px; font-weight: 700; cursor: pointer; }
  .place-button { height: 48px; margin-top: 20px; font-size: 14px; }
  .place-button:disabled { cursor: not-allowed; }
  .paper-note { margin: 10px 0 0; color: #62646B; font-size: 10px; text-align: center; }
  .trade-error { margin: 10px 0 0; color: #E87970; font-size: 10.5px; line-height: 1.4; text-align: center; }
  .positions-preview { margin-top: 26px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.07); }
  .positions-preview header { display: flex; align-items: center; justify-content: space-between; }
  .positions-preview header > strong { color: #777981; font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; }
  .positions-preview header button { border: 0; background: transparent; color: #D8B87E; font-size: 11px; font-weight: 700; cursor: pointer; }
  .position-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 13px 0; border-top: 1px solid rgba(255,255,255,0.06); }
  .positions-preview header + .position-row { margin-top: 10px; }
  .position-row > div { min-width: 0; }
  .position-row > div > strong { display: block; overflow: hidden; color: #E7E6E2; font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
  .position-row span { display: block; margin-top: 3px; color: #777981; font-size: 11px; }
  .position-row span b { font-weight: 700; }
  .position-row > strong { flex-shrink: 0; font-family: 'IBM Plex Mono', monospace; font-size: 12px; font-weight: 500; }
  .positions-empty { margin: 18px 0 0; color: #666870; font-size: 12px; }
  .placed-state { padding: 24px 4px 10px; text-align: center; animation: popIn 0.22s ease both; }
  .success-mark { display: flex; width: 46px; height: 46px; align-items: center; justify-content: center; margin: 0 auto 16px; border: 1px solid rgba(82,196,137,0.4); border-radius: 50%; background: rgba(82,196,137,0.12); color: #52C489; font-size: 20px; }
  .placed-state h2 { margin: 0; font-size: 20px; }
  .placed-state p { margin: 9px 0 0; color: #8F9198; font-size: 12.5px; line-height: 1.5; }
  .primary-button { margin-top: 22px; padding: 13px; background: #D8B87E; color: #141414; font-size: 13px; }
  .secondary-button { margin-top: 8px; padding: 12px; border: 1px solid rgba(255,255,255,0.12); background: transparent; color: #9A9CA3; font-size: 13px; }
  @media (prefers-reduced-motion: reduce) { .placed-state { animation: none; } }
</style>
