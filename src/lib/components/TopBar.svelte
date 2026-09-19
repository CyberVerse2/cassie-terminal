<script>
  import { Plus, Search, TrendingDown, TrendingUp } from '@lucide/svelte';
  import Auth from './Auth.svelte';
  let { vals } = $props();
</script>

<header>
  <div class="wordmark">cassie</div>

  {#if vals.showSearch}
    <div class="search-wrap">
      <div class="search-field hov hov-border">
        <Search class="search-icon" size={15} aria-hidden="true" />
        <input value={vals.query} oninput={vals.onSearch} placeholder="Search for tokens or traders…" aria-label="Search for tokens or traders" />
        <span class="search-key">Paste</span>
        <span class="search-key">/</span>
      </div>
    </div>
  {:else}
    <div class="spacer"></div>
  {/if}

  <div class="account-area">
    <div class="portfolio-card">
      <button class="portfolio-value hov hov-op" type="button" onclick={vals.togglePortfolio}>
        <span>{vals.totalFmt}</span>
        <span class="pnl" style="background:{vals.upnlBg}; color:{vals.upnlColor}">{#if vals.upnlPositive}<TrendingUp size={12} aria-hidden="true" />{:else}<TrendingDown size={12} aria-hidden="true" />{/if}{vals.upnlPctFmt}</span>
      </button>
      <button class="portfolio-add hov hov-bright" type="button" aria-label="Open portfolio" onclick={vals.togglePortfolio}><Plus size={18} strokeWidth={2.4} aria-hidden="true" /></button>
    </div>
    <Auth onSignedIn={vals.onAuthChanged} onProfileClick={vals.togglePortfolio} profileOpen={vals.portfolioOpen} />
  </div>
</header>

<style>
  header { display: flex; height: 52px; min-width: 0; align-items: center; gap: clamp(8px, 1.4vw, 20px); flex-shrink: 0; padding: 0 clamp(10px, 1.3vw, 18px); border-bottom: 1px solid rgba(255,255,255,0.06); background: #050505; }
  button, input { font: inherit; }
  .wordmark { flex-shrink: 0; color: #eeeeee; font-size: 22px; font-weight: 700; letter-spacing: -0.03em; }
  .search-wrap { display: flex; min-width: 0; flex: 1; justify-content: center; }
  .search-field { display: flex; width: 100%; max-width: 900px; height: 34px; align-items: center; gap: 10px; padding: 0 12px 0 14px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; background: #101010; }
  .search-field:focus-within { border-color: rgba(181,242,11,0.6); }
  .search-field :global(.search-icon) { flex-shrink: 0; color: #575757; }
  .search-field input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: #eeeeee; font-size: 12px; }
  .search-key { padding: 3px 8px; border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; background: #1a1a1a; color: #9c9c9c; font-size: 11px; font-weight: 600; }
  .spacer { flex: 1; }
  .account-area { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
  .portfolio-card { display: flex; align-items: center; gap: 8px; padding: 6px; border: 1px solid rgba(255,255,255,0.09); border-radius: 6px; background: #111111; }
  .portfolio-value { display: flex; align-items: center; gap: 9px; padding: 2px 4px 2px 10px; border: 0; background: transparent; color: #eeeeee; cursor: pointer; }
  .portfolio-value > span:first-child { font-family: var(--font-mono); font-size: 16px; font-weight: 600; }
  .pnl { display: inline-flex; align-items: center; gap: 4px; border-radius: 4px; padding: 5px 8px; font-family: var(--font-mono); font-size: 12px; font-weight: 600; }
  .portfolio-add { display: flex; width: 30px; height: 30px; align-items: center; justify-content: center; flex-shrink: 0; border: 0; border-radius: 4px; background: #B5F20B; color: #080808; font-size: 19px; font-weight: 600; line-height: 1; cursor: pointer; }
  .portfolio-value:focus-visible, .portfolio-add:focus-visible { outline: 2px solid #B5F20B; outline-offset: 2px; }

  @media (max-width: 1200px) {
    .search-key { display: none; }
  }

  @media (max-width: 700px) {
    header { height: 54px; }
    .wordmark { font-size: 19px; }
    .search-field { height: 36px; padding-inline: 10px; }
    .search-field input { font-size: 12px; }
    .portfolio-card { gap: 4px; padding: 4px; }
    .portfolio-value { padding-left: 5px; }
    .portfolio-value > span:first-child { font-size: 13px; }
    .pnl { display: none; }
    .portfolio-add { width: 28px; height: 28px; }
    :global(.auth .signin) { height: 34px; padding-inline: 10px; font-size: 12px; }
    :global(.auth .avatar) { width: 34px; height: 34px; }
  }

  @media (max-width: 420px) {
    header { gap: 7px; padding-inline: 9px; }
    .wordmark { font-size: 17px; }
    .search-field { gap: 5px; border-radius: 4px; }
    .portfolio-value > span:first-child { font-size: 12px; }
  }

  @media (max-width: 350px) {
    .wordmark { display: none; }
  }
</style>
