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
            <div>
              <span class="conviction-badge" style="color:{vals.t_convColor}; border-color:{vals.t_convBd}">{vals.t_conviction} conviction</span>
              <button class:starred={vals.t_starred} class="thesis-star" type="button" aria-label={vals.t_starred ? 'Unstar this thesis' : 'Star this thesis'} aria-pressed={vals.t_starred} onclick={vals.t_toggleStar}>★</button>
            </div>
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

          {#if vals.t_invalidatingThesis}
            <section class="brief-section counter-thesis">
              <h2>Invalidating thesis in your feed</h2>
              <button type="button" onclick={vals.t_invalidatingThesis.open}>
                <div class="counter-source">
                  <img src={vals.t_invalidatingThesis.author.avatarUrl} alt="" />
                  <div>
                    <strong>{vals.t_invalidatingThesis.author.name}</strong>
                    <span>@{vals.t_invalidatingThesis.author.handle} · {vals.t_invalidatingThesis.age}</span>
                  </div>
                  <b style="color:{vals.t_invalidatingThesis.directionColor}">{vals.t_invalidatingThesis.directionLabel}</b>
                </div>
                <h3>{vals.t_invalidatingThesis.thesis}</h3>
                <p>{vals.t_invalidatingThesis.text}</p>
                <span class="counter-open">Open thesis →</span>
              </button>
            </section>
          {/if}

          {#if vals.t_assetContext || vals.t_leverageReason || vals.t_leverageSteps.length}
            <section class="brief-section asset-lever">
              <h2>Why this asset</h2>
              <div class="asset-lever-grid">
                {#if vals.t_assetContext}
                  <div>
                    <h3>What you're trading</h3>
                    <p>{vals.t_assetContext}</p>
                  </div>
                {/if}
                {#if vals.t_leverageReason}
                  <div>
                    <h3>Why it expresses the narrative</h3>
                    <p>{vals.t_leverageReason}</p>
                  </div>
                {/if}
              </div>
              {#if vals.t_leverageSteps.length}
                <div class="exposure-chain">
                  <h3>Exposure chain</h3>
                  <ol>
                    {#each vals.t_leverageSteps as step}
                      <li>
                        <span>{step.basis}</span>
                        <p>{step.text}</p>
                      </li>
                    {/each}
                  </ol>
                </div>
              {/if}
            </section>
          {/if}
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
  .thesis-header > div { display: flex; align-items: center; gap: 10px; }
  .thesis-header h1 { max-width: 68ch; margin: 12px 0 0; color: #EAE9E4; font-size: 22px; font-weight: 550; letter-spacing: -0.018em; line-height: 1.45; text-wrap: pretty; }
  .thesis-star { border: 0; background: transparent; padding: 2px; color: #50525A; font-size: 19px; line-height: 1; cursor: pointer; }
  .thesis-star:hover, .thesis-star:focus-visible, .thesis-star.starred { outline: 0; color: #D8B87E; }
  .conviction-badge { display: inline-block; border: 1px solid; border-radius: 5px; padding: 3px 7px; font-size: 10px; font-weight: 700; text-transform: lowercase; }
  .brief-section { margin-top: 30px; padding-top: 25px; border-top: 1px solid rgba(255,255,255,0.08); }
  .brief-section h2 { margin: 0 0 15px; color: #E7E6E2; font-size: 15px; font-weight: 700; }
  .driver-list { display: flex; max-width: 76ch; flex-direction: column; gap: 12px; }
  .driver-row { display: flex; align-items: flex-start; gap: 12px; }
  .driver-row > span { width: 6px; height: 6px; margin-top: 9px; flex-shrink: 0; border-radius: 50%; background: #D8B87E; }
  .driver-row p { max-width: 70ch; margin: 0; color: #C4C6CC; font-size: 15px; line-height: 1.6; text-wrap: pretty; }
  .counter-thesis > button { display: block; width: min(100%, 960px); border: 1px solid rgba(224,96,85,.24); border-radius: 11px; background: rgba(224,96,85,.045); padding: 18px; color: inherit; font: inherit; text-align: left; cursor: pointer; }
  .counter-thesis > button:hover, .counter-thesis > button:focus-visible { outline: 0; border-color: rgba(224,96,85,.5); background: rgba(224,96,85,.075); }
  .counter-source { display: flex; align-items: center; gap: 10px; }
  .counter-source img { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: #181A20; }
  .counter-source div { display: flex; min-width: 0; flex: 1; flex-direction: column; }
  .counter-source strong { color: #E1E1DE; font-size: 12px; }
  .counter-source span { margin-top: 2px; color: #777981; font-size: 10px; }
  .counter-source b { font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: .06em; }
  .counter-thesis h3 { margin: 15px 0 0; color: #E5E4DF; font-size: 17px; line-height: 1.4; }
  .counter-thesis p { max-width: 76ch; margin: 8px 0 0; color: #AEB0B7; font-size: 14px; line-height: 1.55; }
  .counter-open { display: inline-block; margin-top: 13px; color: #D8B87E; font-size: 11px; font-weight: 650; }
  .asset-lever-grid { display: grid; max-width: 960px; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 12px; }
  .asset-lever-grid > div, .exposure-chain { border: 1px solid rgba(255,255,255,0.08); border-radius: 11px; background: #0D0F13; padding: 16px 18px; }
  .asset-lever h3 { margin: 0; color: #8F9198; font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .asset-lever p { margin: 8px 0 0; color: #D0D1D6; font-size: 14px; line-height: 1.55; text-wrap: pretty; }
  .exposure-chain { max-width: 960px; margin-top: 12px; }
  .exposure-chain ol { display: grid; gap: 0; margin: 12px 0 0; padding: 0; list-style: none; }
  .exposure-chain li { display: grid; grid-template-columns: 72px minmax(0,1fr); gap: 14px; padding: 11px 0; border-top: 1px solid rgba(255,255,255,.06); }
  .exposure-chain li > span { padding-top: 9px; color: #D8B87E; font-family: 'IBM Plex Mono', monospace; font-size: 9px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .exposure-chain li p { margin-top: 0; }

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
    .asset-lever-grid { grid-template-columns: 1fr; }
  }

  @media (min-width: 1800px) {
    .market-identity { min-width: 230px; }
    .market-metric { padding-inline: 22px; }
    .thesis-header h1 { font-size: 24px; }
    .asset-lever p { font-size: 15px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .idea-view { animation: none; }
  }
</style>
