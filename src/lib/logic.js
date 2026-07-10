// View-model builder for the Cassie terminal, over the cassie-indexer read API.
// No synthetic market data: every value here is either a live API field or a
// deterministic presentation transform of one. The trade rail is client-side
// paper trading — the indexer holds no trading keys (execution lives elsewhere).

export const FEED_TABS = [
  { label: 'All', key: 'all' },
  { label: 'Perps', key: 'perps' },
  { label: 'Stocks', key: 'stocks' },
  { label: 'Tokens', key: 'tokens' },
  { label: 'Markets', key: 'markets' },
];

export const PAPER_START_CASH = 25000;
const HORIZONS = [
  { value: 'immediate', label: '≤3D', title: 'Immediate, through 3 days' },
  { value: 'short-term', label: '4D–4W', title: 'Short term, 4 days through 4 weeks' },
  { value: 'medium-term', label: '1–6M', title: 'Medium term, over 4 weeks through 6 months' },
  { value: 'long-term', label: '6M+', title: 'Long term, over 6 months' },
  { value: 'unspecified', label: 'Open', title: 'Timing unspecified' },
];

export const initialState = {
  // feed
  tab: 'all',
  horizon: 'all',
  query: '',
  ideas: [],
  ideasLoading: true,
  ideasError: null,
  // selection / detail
  selId: null,
  detail: null,
  detailLoading: false,
  detailError: null,
  author: null, // track record for the selected idea's author
  status: null, // { lastFetchAt, routedIdeas }
  // trade rail (paper)
  amount: '',
  orderDirection: null,
  appliedSetup: null,
  placed: false,
  placedInfo: '',
  cash: PAPER_START_CASH,
  positions: [],
  closedPositions: [],
  portfolioError: null,
  tradeError: null,
  tradeSubmitting: false,
  closingPositionId: null,
  // ui / responsive
  vw: typeof window !== 'undefined' ? window.innerWidth : 1280,
  portfolioOpen: false,
  tradeOpen: false,
  mobileScreen: 'feed',
};

// ---------- formatting helpers ----------
export const money = (v) => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function fmtPrice(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (Math.abs(n) < 1) return '$' + n.toFixed(4);
  if (Math.abs(n) < 1000) return '$' + n.toFixed(2);
  return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function fmtPct(n, dp = 2) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  return (n > 0 ? '+' : '') + n.toFixed(dp) + '%';
}
function timeAgo(iso) {
  if (!iso) return '';
  const secs = Math.floor((Date.now() - new Date(iso.replace(' ', 'T')).getTime()) / 1000);
  if (!Number.isFinite(secs) || secs < 0) return '';
  if (secs < 60) return secs + 's';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return mins + 'm';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h';
  return Math.floor(hrs / 24) + 'd';
}
const isBull = (d) => d === 'long' || d === 'yes' || d === 'Long' || d === 'Yes';
const dirColor = (d) => (isBull(d) ? '#52C489' : '#E06055');
const dirWord = (d) => ({ long: 'Long', short: 'Short', yes: 'Yes', no: 'No' }[d] || (d ? d[0].toUpperCase() + d.slice(1) : ''));
const signColor = (n) => (n === null || n === undefined ? '#8A8C93' : n > 0.0001 ? '#52C489' : n < -0.0001 ? '#E06055' : '#8A8C93');
function convictionTier(c) {
  if (c === 'high') return { word: 'HIGH', color: '#D8B87E', bd: 'rgba(216,184,126,0.4)' };
  if (c === 'low') return { word: 'LOW', color: '#83858C', bd: 'rgba(131,133,140,0.35)' };
  return { word: 'MEDIUM', color: '#C9CBD2', bd: 'rgba(201,203,210,0.3)' }; // medium or null
}
const iconText = (ticker) => (ticker || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase();
// ---------- paper-portfolio math ----------
function posCalc(p) {
  return { val: p.currentValueUsd, pnl: p.pnlUsd };
}

// ---------- the derived view-model ----------
export function computeVals(state, actions) {
  const S = state;
  const setState = actions.setState;

  // responsive breakpoints (unchanged from the design)
  const mode = S.vw >= 1200 ? 'wide' : S.vw >= 900 ? 'mid' : 'narrow';
  const isNarrow = mode === 'narrow';
  const tradeIsSheet = mode !== 'wide';
  const gridCols = mode === 'wide'
    ? 'clamp(340px, 18vw, 400px) minmax(0,1fr) clamp(344px, 18vw, 400px)'
    : mode === 'mid' ? '320px minmax(0,1fr)' : 'minmax(0,1fr)';
  const showFeed = !isNarrow || S.mobileScreen === 'feed';
  const showTerminal = !isNarrow || S.mobileScreen === 'terminal';
  const tradeVisible = mode === 'wide' || S.tradeOpen;
  const tradeContainerStyle = mode === 'wide'
    ? 'border-left:1px solid rgba(255,255,255,0.06); overflow-y:auto; min-height:0; background:#0B0C0F; padding:20px'
    : isNarrow
      ? 'position:fixed; top:0; left:0; right:0; bottom:0; overflow-y:auto; background:#0B0C0F; padding:18px; z-index:82; animation:slideUp 0.3s cubic-bezier(0.22,1,0.36,1) both'
      : 'position:fixed; top:0; right:0; bottom:0; width:376px; max-width:90vw; overflow-y:auto; background:#0B0C0F; border-left:1px solid rgba(255,255,255,0.1); padding:20px; z-index:82; box-shadow:-16px 0 40px rgba(0,0,0,0.4); animation:slideIn 0.28s cubic-bezier(0.22,1,0.36,1) both';
  const sel = S.selId ? S.ideas.find((x) => x.id === S.selId) || (S.detail && S.detail.id === S.selId ? S.detail : null) : null;
  const showTradeBackdrop = tradeIsSheet && S.tradeOpen;
  const showTradeHeader = tradeIsSheet;
  const showTradeCta = tradeIsSheet && showTerminal && !!sel && !S.tradeOpen;
  const showBack = isNarrow && S.mobileScreen === 'terminal';
  const showSearch = true;

  // ---- paper portfolio ----
  const calcs = S.positions.map((p) => posCalc(p));
  const deployed = calcs.reduce((a, c) => a + c.val, 0);
  const upnl = calcs.reduce((a, c) => a + c.pnl, 0);
  const total = S.cash + deployed;
  const positionKind = (p) => p.instrument === 'perp' ? 'perps'
    : p.instrument === 'shares' ? 'stocks'
      : p.instrument === 'spot' ? 'tokens' : 'markets';
  const byKind = (k) => S.positions.reduce((a, p, i) => a + (positionKind(p) === k ? calcs[i].val : 0), 0);
  const allocSegs = [
    { label: 'Perps', v: byKind('perps'), color: '#37B87D' },
    { label: 'Stocks', v: byKind('stocks'), color: '#8FB8DE' },
    { label: 'Tokens', v: byKind('tokens'), color: '#E3A75A' },
    { label: 'Markets', v: byKind('markets'), color: '#C79FE0' },
    { label: 'Available', v: S.cash, color: '#33353C' },
  ].filter((s) => s.v > 0.01 || s.label === 'Available').map((s) => ({ ...s, w: ((s.v / total) * 100).toFixed(1) + '%', pct: ((s.v / total) * 100).toFixed(0) + '%' }));
  const posRows = S.positions.map((p, i) => {
    const c = calcs[i];
    return {
      market: p.marketLabel, venue: p.venue.toUpperCase(), dir: dirWord(p.direction), dirColor: dirColor(p.direction),
      sizeFmt: money(p.collateralUsd), entryNow: fmtPrice(p.entryPrice) + ' → ' + fmtPrice(p.currentMarkPrice),
      pnlFmt: (c.pnl >= 0 ? '+' : '') + money(c.pnl).replace('$-', '-$'),
      pnlColor: signColor(c.pnl),
      markError: p.markError,
      closing: S.closingPositionId === p.id,
      close: () => actions.closePosition(p.id),
    };
  });
  const closedRows = S.closedPositions.map((p) => ({
    market: p.marketLabel,
    venue: p.venue.toUpperCase(),
    dir: dirWord(p.direction),
    dirColor: dirColor(p.direction),
    sizeFmt: money(p.collateralUsd),
    entryNow: fmtPrice(p.entryPrice) + ' → ' + fmtPrice(p.closePrice),
    pnlFmt: (p.pnlUsd >= 0 ? '+' : '') + money(p.pnlUsd).replace('$-', '-$'),
    pnlColor: signColor(p.pnlUsd),
  }));
  // ---- feed ----
  const horizonIdeas = S.horizon === 'all'
    ? S.ideas
    : S.ideas.filter((idea) => idea.horizons?.includes(S.horizon) || idea.horizon === S.horizon);
  const query = S.query.trim().toLocaleLowerCase();
  const visibleIdeas = query
    ? horizonIdeas.filter((idea) => [idea.ticker, idea.author?.name, idea.author?.handle, idea.text, idea.thesis,
        ...(idea.groupMembers ?? []).flatMap((member) => [member.author?.name, member.author?.handle, member.text])]
        .some((value) => value?.toLocaleLowerCase().includes(query)))
    : horizonIdeas;
  const feedItems = visibleIdeas.map((o) => {
    const priceErr = !!o.currentPriceError;
    const members = o.groupMembers ?? [o];
    const traders = members.filter((member, index) =>
      members.findIndex((candidate) => candidate.author.handle === member.author.handle) === index
    );
    return {
      id: o.id,
      venueTag: o.venueLabel,
      dirLabel: dirWord(o.direction).toUpperCase(),
      dirColor: dirColor(o.direction),
      market: o.ticker,
      priceFmt: priceErr ? '—' : fmtPrice(o.currentPrice),
      retFmt: fmtPct(o.sincePostedPct, 1),
      retColor: signColor(o.sincePostedPct),
      traders: traders.map((member) => ({ avatar: member.author.avatarUrl, name: member.author.name, handle: member.author.handle })),
      groupTitle: o.thesis, tweetCount: members.length,
      age: timeAgo(o.postedAt), srcText: o.text,
      selected: o.id === S.selId,
      selBar: o.id === S.selId ? '#D8B87E' : 'transparent',
      selBg: o.id === S.selId ? 'rgba(216,184,126,0.05)' : 'transparent',
      open: () => actions.selectIdea(o.id),
      quickAmounts: [100, 500, 1000].map((amount) => ({
        label: amount === 1000 ? '$1K' : `$${amount}`,
        disabled: amount > S.cash || priceErr,
        enter: () => actions.quickEnter(o.id, amount),
      })),
    };
  });
  const filterTabs = FEED_TABS.map((f) => ({
    ...f, onClick: () => actions.setTab(f.key),
    selected: S.tab === f.key,
    bg: S.tab === f.key ? '#24262D' : 'transparent', fg: S.tab === f.key ? '#E7E6E2' : '#8A8C93',
  }));
  const horizonOptions = [
    { value: 'all', label: 'All', title: 'All horizons' },
    ...HORIZONS,
  ].map((option) => ({
    ...option,
    menuLabel: option.title,
    selected: S.horizon === option.value,
    onClick: () => actions.setHorizon(option.value),
  }));

  // ---- terminal ----
  let term = {};
  if (sel) {
    const d = S.detail && S.detail.id === S.selId ? S.detail : null; // full detail (may be loading)
    const tier = convictionTier(sel.conviction);
    const priceErr = !!sel.currentPriceError;
    const a = parseFloat(S.amount) || 0;
    const valid = a > 0 && a <= S.cash && !priceErr && sel.currentPrice != null && !S.tradeSubmitting;
    const callSide = dirWord(sel.direction);
    const selectedDirection = S.orderDirection ?? sel.direction;
    const orderSide = dirWord(selectedDirection);
    const setup = d?.recommendedSetup ?? null;
    const groupMembers = sel.groupMembers ?? [sel];

    const summaryCells = [
      { label: 'Now', value: priceErr ? '—' : fmtPrice(sel.currentPrice), color: '#E7E6E2' },
      { label: 'Since call', value: fmtPct(sel.sincePostedPct, 2), color: signColor(sel.sincePostedPct) },
      { label: 'Side', value: callSide.toUpperCase(), color: dirColor(sel.direction) },
    ];

    // author track record (replaces the fabricated "N you follow traded this")
    const au = S.author && S.author.handle === sel.author.handle ? S.author : null;
    let authorLine;
    if (au && au.scored > 0) authorLine = `${au.winRate}% win rate · ${au.routed} trade ideas · avg ${fmtPct(au.avgSincePosted, 1)} since posted`;
    else if (au) authorLine = `${au.routed} trade idea${au.routed === 1 ? '' : 's'} tracked`;
    else authorLine = 'track record loading…';

    term = {
      t_ticker: sel.ticker, t_venueTag: sel.venueLabel, t_instrument: sel.instrument,
      t_chartIdeaId: ['stocks', 'perps', 'tokens', 'markets'].includes(sel.category) ? sel.id : null,
      t_price: priceErr ? '—' : fmtPrice(sel.currentPrice), t_priceErr: sel.currentPriceError || '',
      t_logo: sel.logoUrl, t_iconText: iconText(sel.ticker),
      t_conviction: tier.word, t_convColor: tier.color, t_convBd: tier.bd,
      t_summaryCells: summaryCells,
      t_authorName: sel.author.name, t_authorHandle: sel.author.handle, t_authorAvatar: sel.author.avatarUrl,
      t_authorProfile: sel.author.profileUrl, t_authorLine: authorLine,
      t_age: timeAgo(sel.postedAt), t_sourceUrl: sel.sourceUrl,
      t_groupTweets: groupMembers.map((member) => ({
        id: member.id,
        avatar: member.author.avatarUrl,
        name: member.author.name,
        handle: member.author.handle,
        age: timeAgo(member.postedAt),
        text: member.text,
        sourceUrl: member.sourceUrl,
        returnFmt: fmtPct(member.sincePostedPct, 1),
        returnColor: signColor(member.sincePostedPct),
      })),
      t_chartTweet: sel.text ? {
        postedAt: sel.postedAt,
        price: sel.entryPrice,
        avatar: sel.author.avatarUrl,
        name: sel.author.name,
        handle: sel.author.handle,
        age: timeAgo(sel.postedAt),
        text: sel.text,
        returnFmt: fmtPct(sel.sincePostedPct, 1),
        returnColor: signColor(sel.sincePostedPct),
        returnBg: sel.sincePostedPct > 0
          ? 'rgba(82,196,137,0.1)'
          : sel.sincePostedPct < 0 ? 'rgba(224,96,85,0.1)' : 'rgba(255,255,255,0.06)',
      } : null,
      // detail state
      t_detailLoading: S.detailLoading, t_detailError: S.detailError,
      t_thesis: d?.thesis || '', t_alphaDrivers: d?.alphaDrivers ?? [],
      t_assetContext: d?.assetContext || '',
      t_leverageReason: d?.leverageReason || '',
      t_leverageSteps: d?.leverageSteps ?? [],
      t_invalidatingThesis: d?.invalidatingThesis ? {
        ...d.invalidatingThesis,
        directionLabel: dirWord(d.invalidatingThesis.direction).toUpperCase(),
        directionColor: dirColor(d.invalidatingThesis.direction),
        age: timeAgo(d.invalidatingThesis.postedAt),
      } : null,
      // trade rail
      orderSide, orderTicker: sel.ticker, orderPrice: priceErr ? '—' : fmtPrice(sel.currentPrice),
      recommendedSetupTags: setup ? [
        { value: dirWord(setup.side).toUpperCase(), color: dirColor(setup.side) },
        { value: 'MARKET', color: '#C9CBD2' },
        { value: HORIZONS.find((option) => option.value === sel.horizon)?.label ?? 'OPEN', color: '#9A9CA3' },
      ] : [],
      recommendedPlanRows: setup ? [
        { label: 'Target', value: setup.target?.text || 'Missing' },
        { label: 'Stop', value: setup.stop?.text || 'Missing' },
      ] : [],
      setupLoading: S.detailLoading,
      setupApplied: !!S.appliedSetup,
      setupIncomplete: !!setup && !setup.complete,
      setupMessage: setup && !setup.complete
        ? `Missing ${setup.missing.join(', ')}`
        : 'Applies the full plan to this paper trade.',
      canApplySetup: !!setup?.complete && !S.appliedSetup,
      applySetupLabel: S.detailLoading
        ? 'Loading setup…'
        : S.appliedSetup ? 'Applied' : setup?.complete ? 'Use' : 'Incomplete',
      applyRecommendedSetup: () => actions.applyRecommendedSetup(),
      sideOptions: (sel.category === 'markets'
        ? [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]
        : [{ value: 'long', label: 'Long' }, { value: 'short', label: 'Short' }]
      ).map((option) => ({
        ...option,
        selected: selectedDirection === option.value,
        onClick: () => actions.setOrderDirection(option.value),
      })),
      positionSizeFmt: valid
        ? (a / sel.currentPrice).toLocaleString('en-US', { maximumFractionDigits: 4 })
        : '—',
      estimatedEntryFmt: priceErr ? '—' : fmtPrice(sel.currentPrice),
      estimatedFeeFmt: '—',
      quickChips: ['100', '500', '1000', 'Max'].map((q) => ({ label: q === 'Max' ? 'Max' : '$' + Number(q).toLocaleString('en-US'), onClick: () => actions.setAmount(q === 'Max' ? S.cash.toFixed(2) : q) })),
      canPlace: valid,
      placeBg: valid ? '#D8B87E' : '#1E2027', placeFg: valid ? '#141414' : '#6C6E75',
      placeCursor: valid ? 'pointer' : 'not-allowed',
      placeLabel: S.tradeSubmitting ? 'Placing…' : priceErr ? 'Price unavailable' : a > S.cash ? 'Insufficient balance' : 'Place trade',
      place: () => actions.place(),
    };
  }

  const statusAge = S.status?.lastFetchAt ? timeAgo(S.status.lastFetchAt) : '';

  return {
    hasSel: !!sel,
    ideasLoading: S.ideasLoading, ideasError: S.ideasError,
    ideasEmpty: !S.ideasLoading && !S.ideasError && S.ideas.length === 0,
    ideasFilteredEmpty: !S.ideasLoading && !S.ideasError && S.ideas.length > 0 && visibleIdeas.length === 0,
    notPlaced: !S.placed, placed: S.placed, placedInfo: S.placedInfo,
    statusLine: S.status?.lastFetchAt ? (statusAge ? `live · ${statusAge} ago` : 'live') : 'connecting…',
    routedCount: S.status?.routedIdeas ?? null,
    // layout
    gridCols, showFeed, showTerminal, tradeVisible, tradeContainerStyle,
    showTradeBackdrop, showTradeCta, showTradeHeader, showBack, showSearch,
    openTrade: () => setState({ tradeOpen: true }),
    closeTrade: () => setState({ tradeOpen: false }),
    backToFeed: () => setState({ mobileScreen: 'feed' }),
    portfolioOpen: S.portfolioOpen,
    togglePortfolio: () => setState((s) => {
      const portfolioOpen = !s.portfolioOpen;
      return { portfolioOpen, ...(portfolioOpen ? { tradeOpen: false } : {}) };
    }),
    resetTrade: () => setState({ placed: false, amount: '', appliedSetup: null }),
    feedItems, filterTabs, horizonOptions, horizonValue: S.horizon,
    onHorizonChange: (e) => actions.setHorizon(e.currentTarget.value),
    query: S.query, onSearch: (e) => actions.setQuery(e.currentTarget.value),
    clearSearch: () => actions.setQuery(''),
    refreshFeed: () => actions.refreshFeed(),
    refreshing: S.ideasLoading,
    amount: S.amount,
    onAmount: (e) => actions.setAmount(e.target.value.replace(/[^0-9.]/g, '')),
    cashFmt: money(S.cash), totalFmt: money(total), deployedFmt: money(deployed),
    upnlFmt: (upnl >= 0 ? '+' : '') + money(upnl), upnlColor: signColor(upnl),
    upnlArrow: upnl >= 0 ? '▲' : '▼', upnlBg: upnl >= 0 ? 'rgba(82,196,137,0.12)' : 'rgba(224,96,85,0.12)',
    upnlPctFmt: (upnl >= 0 ? '+' : '−') + Math.abs(total - upnl === 0 ? 0 : (upnl / (total - upnl)) * 100).toFixed(2) + '%',
    allocSegs, posRows, closedRows,
    positionPreview: posRows.slice(0, 2),
    hasPositions: S.positions.length > 0, noPositions: S.positions.length === 0,
    hasClosedPositions: S.closedPositions.length > 0,
    portfolioError: S.portfolioError,
    tradeError: S.tradeError,
    ...term,
  };
}
