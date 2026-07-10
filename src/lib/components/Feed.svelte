<script>
  import { Check, ChevronDown, RefreshCw, Star } from '@lucide/svelte';
  let { vals } = $props();
  let horizonOpen = $state(false);
  let selectedHorizon = $derived(vals.horizonOptions.find((option) => option.selected) ?? vals.horizonOptions[0]);

  function closeHorizonOnFocusOut(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) horizonOpen = false;
  }

  function handleHorizonKeydown(event) {
    if (event.key === 'Escape') horizonOpen = false;
  }
</script>

<aside class="desk">
  <header class="desk-header">
    <nav class="filters" aria-label="Idea categories">
      {#each vals.filterTabs as filter}
        <button class="hov hov-text" type="button" aria-pressed={filter.selected} onclick={filter.onClick}
          style="background:{filter.bg}; color:{filter.fg}">{filter.label}</button>
      {/each}
    </nav>
    <div class="filter-toolbar" aria-label="Desk filters">
      <span class="filter-label">Filters</span>
      <div class="filter-control" onfocusout={closeHorizonOnFocusOut}>
        <span>Horizon</span>
        <button class="filter-trigger" type="button" aria-label="Horizon" aria-haspopup="listbox" aria-expanded={horizonOpen}
          onclick={() => horizonOpen = !horizonOpen} onkeydown={handleHorizonKeydown}>
          <span>{selectedHorizon.label}</span>
          <span class:open={horizonOpen} class="select-chevron" aria-hidden="true"><ChevronDown size={13} /></span>
        </button>
        {#if horizonOpen}
          <div class="filter-menu" role="listbox" aria-label="Horizon options">
            {#each vals.horizonOptions as option}
              <button type="button" role="option" aria-selected={option.selected} class:selected={option.selected}
                onclick={() => { option.onClick(); horizonOpen = false; }}>
                <span>{option.menuLabel}</span>
                {#if option.selected}<Check size={13} aria-hidden="true" />{/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      <button class="refresh-button hov hov-text" type="button" aria-label="Refresh ideas" title="Refresh ideas" onclick={vals.refreshFeed} disabled={vals.refreshing}>
        <RefreshCw size={15} aria-hidden="true" />
      </button>
    </div>
  </header>

  <div class="idea-list">
    {#if vals.ideasLoading}
      <div class="list-state">Loading ideas from the desk…</div>
    {:else if vals.ideasError}
      <div class="list-state list-error">Couldn't reach the feed API.<small>{vals.ideasError}</small></div>
    {:else if vals.ideasEmpty}
      <div class="list-state">No calls in this category yet.</div>
    {:else if vals.ideasFilteredEmpty}
      <div class="list-state">No ideas match these filters.</div>
    {:else}
      {#each vals.feedItems as idea (idea.id)}
        <article class="idea-row" class:selected={idea.selected}>
          <button class="idea-main hov hov-row" type="button" aria-pressed={idea.selected} onclick={idea.open}>
            <div class="idea-topline">
              <div class="idea-summary">
                <div class="idea-route">
                  <span>{idea.venueTag}</span>
                  <strong style="color:{idea.dirColor}">{idea.dirLabel}</strong>
                </div>
                <div class="idea-market">{idea.market}</div>
                <div class="idea-price">{idea.priceFmt}</div>
              </div>
              <div class="idea-return" style="color:{idea.retColor}">
                <strong>{idea.retFmt}</strong>
                <small>SINCE POSTED</small>
              </div>
            </div>

            <div class="collective-tweet">
              <div class="source-line">
                {#if idea.traders.length === 1}
                  <img src={idea.traders[0].avatar} alt="" />
                  <div class="source-identity">
                    <strong>{idea.traders[0].name}</strong>
                    <span>@{idea.traders[0].handle}</span>
                  </div>
                {:else}
                  <div class="avatar-stack" aria-label={`${idea.traders.length} contributing traders`}>
                    {#each idea.traders as trader}<img src={trader.avatar} alt={trader.name} />{/each}
                  </div>
                  <div class="source-identity">
                    <strong>@{idea.traders[0].handle} +{idea.traders.length - 1}</strong>
                    <span>{idea.traders.map((trader) => `@${trader.handle}`).join(' · ')}</span>
                  </div>
                {/if}
              </div>
              <h2>{idea.groupTitle}</h2>
              <p>{idea.srcText}</p>
            </div>
          </button>
          <div class="idea-foot">
            <div class="idea-meta">
              <button class:starred={idea.starred} class="feed-star" type="button" aria-label={idea.starred ? `Unstar ${idea.market} thesis` : `Star ${idea.market} thesis`} aria-pressed={idea.starred} onclick={idea.toggleStar}><Star size={21} fill={idea.starred ? 'currentColor' : 'none'} aria-hidden="true" /></button>
              <span>{idea.tweetCount} tweet{idea.tweetCount === 1 ? '' : 's'} · {idea.age}</span>
            </div>
            <div class="quick-entry" aria-label={`Quick ${idea.dirLabel.toLowerCase()} ${idea.market} entry`}>
              {#each idea.quickAmounts as amount}
                <button type="button" disabled={amount.disabled} onclick={amount.enter}>{amount.label}</button>
              {/each}
            </div>
          </div>
        </article>
      {/each}
    {/if}
  </div>
</aside>

<style>
  button { font: inherit; }
  .desk { display: flex; min-height: 0; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.06); background: #0B0C0F; }
  .desk-header { position: relative; z-index: 5; flex-shrink: 0; padding: 12px 18px; border-bottom: 1px solid rgba(255,255,255,0.06); }
  .filters { display: flex; min-width: 0; justify-content: space-between; gap: 2px; }
  .filters button { border: 0; border-radius: 7px; padding: 5px 8px; font-size: 11px; font-weight: 600; cursor: pointer; }
  .refresh-button { display: flex; width: 36px; height: 31px; align-items: center; justify-content: center; flex-shrink: 0; margin-left: auto; padding: 0; border: 0; border-left: 1px solid rgba(255,255,255,0.07); background: transparent; color: #777981; cursor: pointer; }
  .refresh-button:disabled { opacity: 0.45; cursor: wait; }
  .filter-toolbar { display: flex; width: 100%; min-width: 0; align-items: center; margin-top: 10px; border: 1px solid rgba(255,255,255,0.09); border-radius: 7px; background: #111318; }
  .filter-label { padding-left: 10px; color: #60626A; font-size: 9px; font-weight: 700; letter-spacing: 0.11em; text-transform: uppercase; }
  .filter-control { position: relative; display: flex; min-width: 0; align-items: center; margin-left: 8px; }
  .filter-control > span:first-child { padding: 0 8px; color: #6F7179; font-size: 9px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; }
  .filter-trigger { display: flex; width: 82px; height: 29px; align-items: center; justify-content: space-between; border: 0; border-left: 1px solid rgba(255,255,255,0.07); background: transparent; padding: 0 8px 0 9px; color: #D8B87E; font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600; cursor: pointer; }
  .select-chevron { display: flex; width: 14px; height: 14px; align-items: center; justify-content: center; color: #7B7D85; transition: transform 0.16s ease; }
  .select-chevron.open { transform: rotate(180deg); }
  .filter-menu { position: absolute; top: calc(100% + 7px); left: 0; width: 230px; overflow: hidden; border: 1px solid rgba(255,255,255,0.11); border-radius: 9px; background: #14161B; box-shadow: 0 14px 32px rgba(0,0,0,0.48); }
  .filter-menu button { display: flex; width: 100%; align-items: center; justify-content: space-between; border: 0; border-bottom: 1px solid rgba(255,255,255,0.05); background: transparent; padding: 9px 11px; color: #A7A9B0; font-size: 11px; text-align: left; cursor: pointer; }
  .filter-menu button:last-child { border-bottom: 0; }
  .filter-menu button:hover, .filter-menu button:focus-visible { outline: 0; background: rgba(255,255,255,0.05); color: #E7E6E2; }
  .filter-menu button.selected { background: rgba(216,184,126,0.08); color: #D8B87E; }
  .filter-control:focus-within, .filters button:focus-visible, .refresh-button:focus-visible, .idea-main:focus-visible { outline: 2px solid #D8B87E; outline-offset: -2px; }
  .idea-list { min-height: 0; flex: 1; overflow-y: auto; }
  .list-state { padding: 26px 18px; color: #777981; font-size: 12px; line-height: 1.5; }
  .list-error { color: #E87970; }
  .list-state small { display: block; margin-top: 6px; color: #777981; font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
  .idea-row { position: relative; display: block; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.05); border-left: 2px solid transparent; color: inherit; }
  .idea-row.selected { border-left-color: #D8B87E; background: rgba(216,184,126,0.05); }
  .idea-main { display: block; width: 100%; padding: 16px 18px 0; border: 0; background: transparent; color: inherit; text-align: left; cursor: pointer; }
  .idea-topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .idea-summary { min-width: 0; flex: 1; }
  .idea-route { display: flex; align-items: center; gap: 7px; }
  .idea-route span { border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; padding: 2px 5px; color: #8A8C93; font-size: 9px; font-weight: 700; letter-spacing: 0.1em; }
  .idea-route strong { font-size: 11px; }
  .idea-return { display: grid; flex-shrink: 0; justify-items: end; font-family: 'IBM Plex Mono', monospace; }
  .idea-return strong { font-size: 20px; line-height: 1; }
  .idea-return small { margin-top: 4px; color: #6C6E75; font-family: inherit; font-size: 8px; font-weight: 700; letter-spacing: 0.11em; }
  .idea-market { margin-top: 8px; color: #E7E6E2; font-size: 15px; font-weight: 600; letter-spacing: -0.01em; line-height: 1.25; text-wrap: pretty; }
  .idea-price { margin-top: 3px; color: #8A8C93; font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; }
  .collective-tweet { margin: 12px -10px 0; padding: 10px 11px 11px; border: 1px solid rgba(255,255,255,0.06); border-radius: 9px; background: #101217; }
  .source-line { display: flex; min-width: 0; align-items: center; gap: 8px; }
  .source-line > img { width: 27px; height: 27px; flex-shrink: 0; border-radius: 50%; object-fit: cover; background: #20222A; }
  .avatar-stack { display: flex; flex-shrink: 0; padding-left: 7px; }
  .avatar-stack img { width: 27px; height: 27px; margin-left: -7px; border: 2px solid #101217; border-radius: 50%; object-fit: cover; background: #20222A; }
  .source-identity { display: grid; min-width: 0; gap: 2px; }
  .source-identity strong { overflow: hidden; font-size: 10px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
  .source-identity span { overflow: hidden; color: #6C6E75; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
  .collective-tweet h2 { margin: 10px 0 0; color: #E7E6E2; font-size: 14px; font-weight: 600; line-height: 1.35; }
  .collective-tweet p { display: -webkit-box; overflow: hidden; margin: 7px 0 0; color: #A7A9B0; font-size: 12px; line-height: 1.45; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
  .idea-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 18px 15px; color: #666870; font-family: 'IBM Plex Mono', monospace; font-size: 9px; }
  .idea-meta { display: flex; min-width: 0; align-items: center; gap: 7px; }
  .feed-star { display: inline-flex; width: 30px; height: 30px; align-items: center; justify-content: center; flex-shrink: 0; border: 0; border-radius: 6px; background: transparent; padding: 0; color: #4F5158; font-size: 21px; line-height: 1; cursor: pointer; }
  .feed-star:hover, .feed-star:focus-visible, .feed-star.starred { outline: 0; color: #D8B87E; }
  .quick-entry { display: flex; flex-shrink: 0; gap: 4px; }
  .quick-entry button { min-width: 38px; border: 1px solid rgba(216,184,126,.2); border-radius: 5px; background: rgba(216,184,126,.06); padding: 5px 7px; color: #CBB17E; font-size: 9px; font-weight: 700; cursor: pointer; }
  .quick-entry button:hover, .quick-entry button:focus-visible { border-color: #D8B87E; background: #D8B87E; color: #111; outline: 0; }
  .quick-entry button:disabled { opacity: .4; cursor: not-allowed; }

  @media (max-width: 380px) {
    .desk-header { padding-inline: 12px; }
    .filters button { padding-inline: 6px; font-size: 10px; }
    .filter-label { display: none; }
    .filter-trigger { width: 78px; }
  }
</style>
