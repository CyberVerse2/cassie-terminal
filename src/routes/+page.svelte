<script>
  import { ArrowRight } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import { initialState, computeVals, money, fmtPrice } from '$lib/logic.js';
  import * as api from '$lib/api.js';
  import TopBar from '$lib/components/TopBar.svelte';
  import Feed from '$lib/components/Feed.svelte';
  import Terminal from '$lib/components/Terminal.svelte';
  import TradeRail from '$lib/components/TradeRail.svelte';
  import Portfolio from '$lib/components/Portfolio.svelte';

  let state = $state({ ...initialState });
  function setState(patch) {
    const p = typeof patch === 'function' ? patch(state) : patch;
    Object.assign(state, p);
  }

  const DIR = { long: 'Long', short: 'Short', yes: 'Yes', no: 'No' };
  let ideasToken = 0;
  let detailToken = 0;
  const STARRED_IDEAS_KEY = 'cassie.starred-theses';

  async function loadStatus() {
    try { state.status = await api.fetchStatus(); } catch { /* header just stays "connecting…" */ }
  }

  async function loadPortfolio() {
    try {
      const paper = await api.fetchPaperPortfolio();
      setState({
        cash: paper.cashUsd,
        positions: paper.openPositions,
        closedPositions: paper.closedPositions,
        portfolioError: null,
      });
    } catch (e) {
      state.portfolioError = String(e?.message ?? e);
    }
  }

  async function loadIdeas(tab) {
    const token = ++ideasToken;
    setState({ ideasLoading: true, ideasError: null });
    try {
      const groups = await api.fetchTradeGroups({ tab, limit: 60 });
      if (token !== ideasToken) return;
      const cards = groups.map((group) => ({
        ...group.members[0],
        id: group.id,
        currentPrice: group.currentPrice,
        currentPriceError: group.currentPriceError,
        sincePostedPct: group.sincePostedPct,
        postedAt: group.postedAt,
        horizon: group.horizon,
        horizons: group.horizons,
        conviction: group.conviction,
        category: group.category,
        instrument: group.instrument,
        author: group.author,
        thesis: group.thesis,
        text: group.summary,
        groupMembers: group.members,
      }));
      state.ideas = cards;
      state.ideasLoading = false;
      const stillSelected = state.selId && cards.some((c) => c.id === state.selId);
      if (!stillSelected) {
        if (cards.length) selectIdea(cards[0].id);
        else { state.selId = null; state.detail = null; }
      }
    } catch (e) {
      if (token !== ideasToken) return;
      state.ideasLoading = false;
      state.ideasError = String(e?.message ?? e);
    }
  }

  async function selectIdea(id) {
    const card = state.ideas.find((c) => c.id === id);
    setState({
      selId: id, mobileScreen: 'terminal', placed: false, amount: '',
      orderDirection: null, appliedSetup: null, detail: null, detailError: null, detailLoading: true, author: null, tradeError: null,
    });
    const token = ++detailToken;
    try {
      const detail = await api.fetchIdea(id);
      if (token === detailToken) {
        state.detail = detail;
        state.detailLoading = false;
        if (!card?.author?.handle && detail.author?.handle) {
          try { state.author = await api.fetchAuthor(detail.author.handle); } catch { /* best effort */ }
        }
      }
    } catch (e) {
      if (token === detailToken) { state.detailLoading = false; state.detailError = String(e?.message ?? e); }
    }
    const handle = card?.author?.handle;
    if (handle) {
      try { const a = await api.fetchAuthor(handle); if (state.selId === id) state.author = a; } catch { /* best effort */ }
    }
  }

  function toggleStarredIdea(id) {
    const starredIdeaIds = state.starredIdeaIds.includes(id)
      ? state.starredIdeaIds.filter((starredId) => starredId !== id)
      : [...state.starredIdeaIds, id];
    localStorage.setItem(STARRED_IDEAS_KEY, JSON.stringify(starredIdeaIds));
    state.starredIdeaIds = starredIdeaIds;
  }

  function setTab(tab) {
    if (tab !== state.tab) {
      state.tab = tab;
      state.horizon = 'all';
      loadIdeas(tab);
    }
  }
  function setHorizon(horizon) {
    state.horizon = horizon;
    const visible = horizon === 'all'
      ? state.ideas
      : state.ideas.filter((idea) => idea.horizons?.includes(horizon) || idea.horizon === horizon);
    if (visible.some((idea) => idea.id === state.selId)) return;
    if (visible.length) selectIdea(visible[0].id);
    else setState({ selId: null, detail: null, author: null, detailLoading: false, detailError: null });
  }
  function setQuery(query) { state.query = query; }
  async function refreshFeed() {
    await Promise.all([loadIdeas(state.tab), loadStatus()]);
  }
  function setAmount(v) { state.amount = v; }
  async function quickEnter(id, amount) {
    const card = state.ideas.find((idea) => idea.id === id);
    if (!card || amount > state.cash || card.currentPrice == null || card.currentPriceError) return;
    selectIdea(id);
    setState({ amount: String(amount), orderDirection: card.direction });
    await place({ ideaId: id, direction: card.direction, amount });
  }
  function setOrderDirection(orderDirection) { setState({ orderDirection, appliedSetup: null, placed: false }); }
  function applyRecommendedSetup() {
    const setup = state.detail?.recommendedSetup;
    if (!setup?.complete) return;
    setState({ orderDirection: setup.side, appliedSetup: setup, placed: false });
  }

  async function place(overrides = {}) {
    const sel = state.ideas.find((x) => x.id === state.selId) || state.detail;
    if (!sel || sel.currentPrice == null || sel.currentPriceError) return;
    const a = overrides.amount ?? (parseFloat(state.amount) || 0);
    if (a <= 0 || a > state.cash) return;
    const side = overrides.direction ?? state.orderDirection ?? sel.direction;
    const direction = DIR[side] || 'Long';
    const setup = state.appliedSetup;
    setState({ tradeSubmitting: true, tradeError: null });
    try {
      const result = await api.placePaperOrder({
        ideaId: overrides.ideaId ?? sel.id,
        direction: side,
        amountUsd: a,
      });
      await loadPortfolio();
      setState({
        placed: true,
        tradeOpen: true,
        tradeSubmitting: false,
        placedInfo: `${direction} · ${result.position.marketLabel} · ${money(a)}, paper fill at ${fmtPrice(result.position.entryPrice)}.${setup ? ' Recommended setup attached.' : ''}`,
      });
    } catch (e) {
      setState({ tradeSubmitting: false, tradeError: String(e?.message ?? e) });
    }
  }

  async function closePosition(id) {
    setState({ closingPositionId: id, portfolioError: null });
    try {
      await api.closePaperPosition(id);
      await loadPortfolio();
    } catch (e) {
      state.portfolioError = String(e?.message ?? e);
    } finally {
      state.closingPositionId = null;
    }
  }

  const actions = { setState, selectIdea, toggleStarredIdea, setTab, setHorizon, setQuery, refreshFeed, setAmount, quickEnter, setOrderDirection, applyRecommendedSetup, place, closePosition };

  onMount(() => {
    const storedStars = JSON.parse(localStorage.getItem(STARRED_IDEAS_KEY) ?? '[]');
    if (!Array.isArray(storedStars) || storedStars.some((id) => typeof id !== 'string')) {
      throw new Error('Invalid saved thesis watchlist');
    }
    state.starredIdeaIds = storedStars;
    loadStatus();
    loadIdeas(state.tab);
    loadPortfolio();
    const statusTimer = setInterval(loadStatus, 60_000);
    const portfolioTimer = setInterval(loadPortfolio, 30_000);
    const onResize = () => { if (Math.abs(window.innerWidth - state.vw) > 2) state.vw = window.innerWidth; };
    window.addEventListener('resize', onResize);
    state.vw = window.innerWidth;
    return () => { clearInterval(statusTimer); clearInterval(portfolioTimer); window.removeEventListener('resize', onResize); };
  });

  let vals = $derived(computeVals(state, actions));
</script>

<div class="app-root">
  <TopBar {vals} />

  <div class="body-grid" style="grid-template-columns:{vals.gridCols}">
    {#if vals.showFeed}
      <Feed {vals} />
    {/if}

    {#if vals.showTerminal}
      <Terminal {vals} />
    {/if}

    {#if vals.showTradeCta}
      <button class="hov hov-bright8" type="button" onclick={vals.openTrade}
        style="position:fixed; left:20px; right:20px; bottom:20px; z-index:70; border:0; background:#D8B87E; color:#141414; border-radius:12px; padding:15px; display:flex; align-items:center; justify-content:center; gap:7px; text-align:center; font:inherit; font-weight:700; font-size:15px; cursor:pointer; box-shadow:0 10px 30px rgba(0,0,0,0.45)">Trade this <ArrowRight size={16} aria-hidden="true" /></button>
    {/if}

    {#if vals.showTradeBackdrop}
      <button type="button" aria-label="Close trade ticket" onclick={vals.closeTrade} style="position:fixed; inset:0; border:0; padding:0; background:rgba(6,7,9,0.55); backdrop-filter:blur(2px); z-index:81"></button>
    {/if}

    {#if vals.tradeVisible}
      <TradeRail {vals} />
    {/if}
  </div>

  {#if vals.portfolioOpen}
    <Portfolio {vals} />
  {/if}
</div>

<style>
  .app-root {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: #0A0B0D;
    color: #E7E6E2;
    font-family: 'Space Grotesk', sans-serif;
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }
  .body-grid {
    flex: 1;
    display: grid;
    min-height: 0;
    overflow: hidden;
  }
</style>
