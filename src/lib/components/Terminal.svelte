<script>
  import TvChart from './TvChart.svelte';
  let { vals } = $props();
</script>

<div class="terminal-scroll">
  {#if vals.showBack}
    <button class="back-button hov hov-text" type="button" onclick={vals.backToFeed}>← The Desk</button>
  {/if}

  {#if vals.hasSel}
    <div class="idea-view">
      <header class="market-summary">
        <div class="market-identity">
          <div class="market-logo">
            {vals.t_iconText}
            <img src={vals.t_logo} alt="" />
          </div>
          <div>
            <div class="market-ticker">{vals.t_ticker}</div>
            <div class="market-route">{vals.t_venueTag} · {vals.t_instrument}</div>
          </div>
        </div>
        <div class="market-metrics">
          {#each vals.t_summaryCells as cell}
            <div class="market-metric">
              <span>{cell.label}</span>
              <strong style="color:{cell.color}">{cell.value}</strong>
            </div>
          {/each}
        </div>
      </header>

      {#if vals.t_priceErr}
        <div class="price-error">Live price unavailable: {vals.t_priceErr}</div>
      {/if}

      <div class="source-row">
        <a href={vals.t_authorProfile} target="_blank" rel="noreferrer" class="author-link hov hov-op">
          <img src={vals.t_authorAvatar} alt="" />
          <div>
            <div class="author-name">{vals.t_authorName} <span>@{vals.t_authorHandle} · {vals.t_age}</span></div>
            <div class="author-stats">{vals.t_authorLine}</div>
          </div>
        </a>
        {#if vals.t_sourceUrl}
          <a href={vals.t_sourceUrl} target="_blank" rel="noreferrer" class="source-link hov hov-underline">View post ↗</a>
        {/if}
      </div>

      {#if vals.t_groupTweets.length > 1}
        <section class="tweet-group" aria-labelledby="tweet-group-title">
          <div class="tweet-group-head">
            <h2 id="tweet-group-title">{vals.t_groupTweets.length} tweets in this trade</h2>
            <span>Scroll to compare</span>
          </div>
          <div class="tweet-track">
            {#each vals.t_groupTweets as tweet (tweet.id)}
              <a class="tweet-tile" href={tweet.sourceUrl} target="_blank" rel="noreferrer">
                <img src={tweet.avatar} alt="" />
                <div class="tweet-tile-copy">
                  <div><strong>@{tweet.handle}</strong><span>{tweet.age}</span></div>
                  <p>{tweet.text}</p>
                </div>
                <strong class="tweet-return" style="color:{tweet.returnColor}">{tweet.returnFmt}</strong>
              </a>
            {/each}
          </div>
        </section>
      {/if}

      {#if vals.t_chartIdeaId}
        <section class="chart-card">
          <div class="chart-frame">
            {#key vals.t_chartIdeaId}
              <TvChart ideaId={vals.t_chartIdeaId} tweet={vals.t_chartTweet} />
            {/key}
          </div>
        </section>
      {/if}

      {#if vals.t_detailLoading}
        <div class="detail-status">Building the trade brief…</div>
      {:else if vals.t_detailError}
        <div class="detail-status detail-error">Couldn't build the trade brief: {vals.t_detailError}</div>
      {:else}
        <article class="trade-brief">
          <header class="thesis-header">
            <span class="conviction-badge" style="color:{vals.t_convColor}; border-color:{vals.t_convBd}">{vals.t_conviction} conviction</span>
            <h1>{vals.t_thesis}</h1>
          </header>

          {#if vals.t_alphaDrivers.length}
            <section class="brief-section">
              <h2>Alpha drivers</h2>
              <div class="driver-list">
                {#each vals.t_alphaDrivers as driver}
                  <div class="driver-row">
                    <span aria-hidden="true"></span>
                    <p>{driver}</p>
                  </div>
                {/each}
              </div>
            </section>
          {/if}

          <section class="brief-section">
            <h2>Trade plan</h2>
            <div class="plan-table">
              {#each vals.t_planRows as row}
                <div class="plan-row">
                  <span class="plan-label">{row.label}</span>
                  <span class="plan-value">{row.text}</span>
                  <span class="basis-badge" style="color:{row.basisColor}; background:{row.basisBg}">{row.basisLabel}</span>
                </div>
              {/each}
            </div>
          </section>
        </article>
      {/if}
    </div>
  {/if}
</div>

<style>
  .terminal-scroll { min-width: 0; min-height: 0; overflow-y: auto; padding: clamp(16px, 1.4vw, 28px) clamp(20px, 1.8vw, 36px) 72px; }
  .back-button { margin: 0 0 12px; padding: 0; border: 0; background: none; color: #9A9CA3; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
  .idea-view { width: 100%; animation: fadeUp 0.22s ease both; }
  .market-summary { display: flex; align-items: stretch; overflow-x: auto; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; background: #0C0E12; }
  .market-identity { display: flex; min-width: 190px; align-items: center; gap: 11px; padding: 12px 18px; border-right: 1px solid rgba(255,255,255,0.07); }
  .market-logo { position: relative; display: flex; width: 38px; height: 38px; align-items: center; justify-content: center; flex-shrink: 0; overflow: hidden; border-radius: 9px; background: #181A20; color: #C9CBD2; font-size: 12px; font-weight: 700; }
  .market-logo img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; background: #181A20; }
  .market-ticker { max-width: 220px; overflow: hidden; color: #E7E6E2; font-size: 16px; font-weight: 700; letter-spacing: -0.01em; text-overflow: ellipsis; white-space: nowrap; }
  .market-route { margin-top: 3px; color: #777981; font-family: 'IBM Plex Mono', monospace; font-size: 10px; }
  .market-metrics { display: flex; min-width: 0; flex: 1; align-items: stretch; }
  .market-metric { display: flex; min-width: 104px; flex: 1; flex-direction: column; justify-content: center; padding: 10px 16px; border-right: 1px solid rgba(255,255,255,0.05); }
  .market-metric span { color: #777981; font-size: 10px; font-weight: 700; }
  .market-metric strong { margin-top: 5px; font-family: 'IBM Plex Mono', monospace; font-size: 15px; font-weight: 600; white-space: nowrap; }
  .price-error { margin-top: 10px; color: #E87970; font-size: 12px; }
  .source-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-top: 14px; }
  .author-link { display: flex; min-width: 0; align-items: center; gap: 10px; color: inherit; text-decoration: none; }
  .author-link img { width: 34px; height: 34px; flex-shrink: 0; border-radius: 50%; object-fit: cover; background: #20222A; }
  .author-name { color: #E1E1DE; font-size: 13px; font-weight: 600; }
  .author-name span { color: #777981; font-weight: 400; }
  .author-stats { margin-top: 2px; overflow: hidden; color: #92949B; font-size: 11.5px; text-overflow: ellipsis; white-space: nowrap; }
  .source-link { flex-shrink: 0; color: #63A9E8; font-size: 12px; font-weight: 600; text-decoration: none; }
  .tweet-group { margin-top: 14px; }
  .tweet-group-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 7px; }
  .tweet-group-head h2 { margin: 0; color: #D8D9D5; font-size: 11px; font-weight: 650; }
  .tweet-group-head > span { color: #666870; font-family: 'IBM Plex Mono', monospace; font-size: 9px; }
  .tweet-track { display: flex; gap: 7px; overflow-x: auto; padding: 1px 1px 7px; scroll-padding-inline: 1px; scroll-snap-type: x mandatory; }
  .tweet-tile { display: grid; width: clamp(230px, 42%, 340px); height: 58px; flex: 0 0 auto; grid-template-columns: 34px minmax(0,1fr) auto; align-items: center; gap: 9px; border: 1px solid rgba(255,255,255,.08); border-radius: 9px; background: #101217; padding: 7px 11px; color: inherit; text-decoration: none; scroll-snap-align: start; }
  .tweet-tile:hover, .tweet-tile:focus-visible { border-color: rgba(216,184,126,.42); outline: none; }
  .tweet-tile > img { width: 34px; height: 34px; border-radius: 50%; background: #20222A; object-fit: cover; }
  .tweet-tile-copy { display: grid; min-width: 0; gap: 3px; }
  .tweet-tile-copy > div { display: flex; min-width: 0; align-items: baseline; gap: 5px; }
  .tweet-tile-copy strong { overflow: hidden; color: #E1E1DE; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  .tweet-tile-copy span { flex-shrink: 0; color: #696B73; font-size: 8px; }
  .tweet-tile-copy p { overflow: hidden; margin: 0; color: #92949B; font-size: 9.5px; text-overflow: ellipsis; white-space: nowrap; }
  .tweet-return { font-family: 'IBM Plex Mono', monospace; font-size: 11px; font-weight: 700; }
  .chart-card { margin-top: 14px; overflow: hidden; border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; background: #0A0C10; }
  .chart-frame { height: clamp(360px, 32vw, 560px); }
  .detail-status { padding: 28px 0; color: #8A8C93; font-size: 12px; }
  .detail-error { color: #E87970; }
  .trade-brief { width: 100%; margin-top: 28px; }
  .thesis-header { position: relative; }
  .thesis-header h1 { max-width: 68ch; margin: 12px 0 0; color: #EAE9E4; font-size: 22px; font-weight: 550; letter-spacing: -0.018em; line-height: 1.45; text-wrap: pretty; }
  .conviction-badge { display: inline-block; border: 1px solid; border-radius: 5px; padding: 3px 7px; font-size: 10px; font-weight: 700; text-transform: lowercase; }
  .brief-section { margin-top: 30px; padding-top: 25px; border-top: 1px solid rgba(255,255,255,0.08); }
  .brief-section h2 { margin: 0 0 15px; color: #E7E6E2; font-size: 15px; font-weight: 700; }
  .driver-list { display: flex; max-width: 76ch; flex-direction: column; gap: 12px; }
  .driver-row { display: flex; align-items: flex-start; gap: 12px; }
  .driver-row > span { width: 6px; height: 6px; margin-top: 9px; flex-shrink: 0; border-radius: 50%; background: #D8B87E; }
  .driver-row p { max-width: 70ch; margin: 0; color: #C4C6CC; font-size: 15px; line-height: 1.6; text-wrap: pretty; }
  .plan-table { border-top: 1px solid rgba(255,255,255,0.08); }
  .plan-row { display: grid; grid-template-columns: 94px minmax(0,1fr) auto; gap: 16px; align-items: start; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
  .plan-label { padding-top: 3px; color: #8F9198; font-size: 11px; font-weight: 700; }
  .plan-value { color: #D3D4DA; font-size: 14px; line-height: 1.5; text-wrap: pretty; }
  .basis-badge { border-radius: 999px; padding: 4px 9px; font-size: 10px; font-weight: 600; white-space: nowrap; }

  @media (max-width: 640px) {
    .terminal-scroll { padding: 14px 20px 84px; }
    .market-summary { flex-direction: column; overflow: visible; }
    .market-identity { min-width: 0; border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
    .market-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .market-metric { min-width: 0; padding: 10px 12px; }
    .market-metric:last-child { border-right: 0; }
    .market-metric strong { font-size: 13px; }
    .chart-frame { height: 320px; }
    .source-row { align-items: flex-start; }
    .tweet-tile { width: 82%; }
    .author-name span { display: block; margin-top: 2px; }
    .thesis-header h1 { font-size: 20px; }
    .plan-row { grid-template-columns: 76px minmax(0,1fr); gap: 12px; }
    .basis-badge { grid-column: 2; width: max-content; }
  }

  @media (min-width: 1800px) {
    .market-identity { min-width: 230px; }
    .market-metric { padding-inline: 22px; }
    .thesis-header h1 { font-size: 24px; }
    .plan-label { font-size: 12px; }
    .plan-value { font-size: 15px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .idea-view { animation: none; }
  }
</style>
