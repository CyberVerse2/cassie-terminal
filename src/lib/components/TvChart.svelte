<script>
  import { onMount } from 'svelte';
  import {
    AreaSeries,
    CandlestickSeries,
    ColorType,
    CrosshairMode,
    HistogramSeries,
    createChart,
  } from 'lightweight-charts';

  let { ideaId, tweet = null } = $props();
  let host = $state();
  let status = $state('loading');
  let interval = $state('');
  let intervals = $state([]);
  let markerLeft = $state(0);
  let markerTop = $state(0);
  let markerAlign = $state('center');
  let markerAbove = $state(false);
  let markerVisible = $state(false);
  let tweetOpen = $state(false);
  let changeInterval = () => {};

  const postedSeconds = $derived(Math.floor(new Date(tweet?.postedAt).getTime() / 1_000));
  const postedLabel = $derived(Number.isFinite(postedSeconds)
    ? new Intl.DateTimeFormat('en', {
        month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      }).format(postedSeconds * 1_000)
    : '');

  function tickLabel(time) {
    const date = new Date(Number(time) * 1_000);
    return new Intl.DateTimeFormat('en', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    }).format(date);
  }

  onMount(() => {
    let controller;
    let dispose = () => {};

    async function load(requestedInterval = '') {
      controller?.abort();
      dispose();
      dispose = () => {};
      const requestController = new AbortController();
      controller = requestController;
      tweetOpen = false;
      markerVisible = false;
      status = 'loading';

      try {
        const query = requestedInterval ? `?interval=${encodeURIComponent(requestedInterval)}` : '';
        const response = await fetch(`/api/ideas/${encodeURIComponent(ideaId)}/bars${query}`, {
          signal: requestController.signal,
          headers: { accept: 'application/json' },
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || `Chart data failed (${response.status})`);
        if (requestController.signal.aborted) return;

        const probability = data.seriesType === 'probability';
        const points = data.data
          .filter((point) => Number.isFinite(point.time) && (
            probability ? Number.isFinite(point.value) : Number.isFinite(point.close)
          ))
          .sort((a, b) => a.time - b.time);
        if (!points.length) throw new Error('No chart data returned');

        interval = data.interval;
        intervals = data.intervals ?? [data.interval];

        const chart = createChart(host, {
          autoSize: true,
          layout: {
            background: { type: ColorType.Solid, color: '#0A0C10' },
            textColor: '#92949B',
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
          },
          grid: {
            vertLines: { color: 'rgba(255,255,255,0.035)' },
            horzLines: { color: 'rgba(255,255,255,0.035)' },
          },
          crosshair: { mode: CrosshairMode.Normal },
          rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
          timeScale: {
            borderColor: 'rgba(255,255,255,0.08)',
            timeVisible: true,
            secondsVisible: false,
            rightOffset: 2,
            minBarSpacing: 1.5,
            tickMarkFormatter: tickLabel,
          },
          handleScroll: true,
          handleScale: true,
        });

        const priceSeries = probability
          ? chart.addSeries(AreaSeries, {
              lineColor: '#A98BD4',
              topColor: 'rgba(169,139,212,0.25)',
              bottomColor: 'rgba(169,139,212,0.02)',
              lineWidth: 2,
              priceLineColor: '#A98BD4',
              priceLineStyle: 2,
              priceFormat: {
                type: 'custom',
                minMove: 0.001,
                formatter: (price) => `${(price * 100).toFixed(price < 0.1 ? 1 : 0)}%`,
              },
            })
          : chart.addSeries(CandlestickSeries, {
              upColor: '#13B89D',
              downColor: '#F04452',
              borderVisible: false,
              wickUpColor: '#13B89D',
              wickDownColor: '#F04452',
              priceLineColor: '#4D9FEB',
              priceLineStyle: 2,
            });

        const seriesData = probability
          ? points.map(({ time, value }) => ({ time, value }))
          : points.map(({ time, open, high, low, close }) => ({ time, open, high, low, close }));
        if (Number.isFinite(postedSeconds) && !points.some((point) => point.time === postedSeconds)) {
          seriesData.push({ time: postedSeconds });
          seriesData.sort((a, b) => Number(a.time) - Number(b.time));
        }
        priceSeries.setData(seriesData);

        const requestedPrice = Number(tweet?.price);
        const nearestPoint = points.reduce((nearest, point) =>
          Math.abs(point.time - postedSeconds) < Math.abs(nearest.time - postedSeconds) ? point : nearest,
        points[0]);
        const markerPrice = Number.isFinite(requestedPrice)
          ? requestedPrice
          : probability ? nearestPoint.value : nearestPoint.close;

        if (!probability && points.some((point) => point.volume > 0)) {
          const volume = chart.addSeries(HistogramSeries, {
            priceFormat: { type: 'volume' },
            priceScaleId: '',
          });
          volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
          volume.setData(points.map((point) => ({
            time: point.time,
            value: point.volume,
            color: point.close >= point.open ? 'rgba(19,184,157,0.42)' : 'rgba(240,68,82,0.42)',
          })));
        }

        function placeMarker() {
          if (!Number.isFinite(postedSeconds)) return;
          const x = chart.timeScale().timeToCoordinate(postedSeconds);
          const y = priceSeries.priceToCoordinate(markerPrice);
          markerVisible = x !== null && y !== null && x >= 0 && x <= host.clientWidth;
          if (!markerVisible) {
            tweetOpen = false;
            return;
          }
          markerLeft = x;
          markerTop = y;
          markerAbove = y > host.clientHeight * 0.55;
          const ratio = x / host.clientWidth;
          markerAlign = ratio > 0.7 ? 'right' : ratio < 0.3 ? 'left' : 'center';
        }

        chart.timeScale().fitContent();
        chart.timeScale().subscribeVisibleLogicalRangeChange(placeMarker);
        const resizeObserver = new ResizeObserver(placeMarker);
        resizeObserver.observe(host);
        requestAnimationFrame(placeMarker);
        status = 'ready';

        let socket;
        let heartbeat;
        if (probability && data.stream?.url && data.stream?.assetId) {
          const assetId = data.stream.assetId;
          let latestSeriesTime = points.at(-1)?.time ?? 0;
          socket = new WebSocket(data.stream.url);
          socket.onopen = () => {
            socket.send(JSON.stringify({
              assets_ids: [assetId],
              type: 'market',
              custom_feature_enabled: true,
            }));
            heartbeat = window.setInterval(() => {
              if (socket.readyState === WebSocket.OPEN) socket.send('PING');
            }, 10_000);
          };
          socket.onmessage = ({ data: message }) => {
            if (message === 'PONG') return;
            let payload;
            try {
              payload = JSON.parse(message);
            } catch {
              return;
            }
            const events = Array.isArray(payload) ? payload : [payload];
            for (const event of events) {
              let value = null;
              if (event.asset_id === assetId && event.event_type === 'last_trade_price') {
                value = Number(event.price);
              } else if (event.asset_id === assetId && event.event_type === 'best_bid_ask') {
                const bid = Number(event.best_bid);
                const ask = Number(event.best_ask);
                if (Number.isFinite(bid) && Number.isFinite(ask) && ask - bid <= 0.1) {
                  value = (bid + ask) / 2;
                }
              } else if (event.event_type === 'price_change') {
                const change = event.price_changes?.find((item) => item.asset_id === assetId);
                const bid = Number(change?.best_bid);
                const ask = Number(change?.best_ask);
                if (Number.isFinite(bid) && Number.isFinite(ask) && ask - bid <= 0.1) {
                  value = (bid + ask) / 2;
                }
              }

              const rawTimestamp = Number(event.timestamp);
              const liveTime = Math.floor(rawTimestamp > 10_000_000_000 ? rawTimestamp / 1_000 : rawTimestamp);
              if (!Number.isFinite(value) || value < 0 || value > 1 || !Number.isFinite(liveTime)) continue;
              if (liveTime < latestSeriesTime) continue;
              priceSeries.update({ time: liveTime, value });
              latestSeriesTime = liveTime;
              placeMarker();
            }
          };
        }

        dispose = () => {
          if (heartbeat) window.clearInterval(heartbeat);
          socket?.close();
          resizeObserver.disconnect();
          chart.timeScale().unsubscribeVisibleLogicalRangeChange(placeMarker);
          chart.remove();
        };
      } catch (cause) {
        if (requestController.signal.aborted) return;
        console.error('Chart data failed', cause);
        status = 'error';
      }
    }

    changeInterval = (nextInterval) => {
      if (nextInterval !== interval) void load(nextInterval);
    };
    void load();
    return () => {
      controller?.abort();
      dispose();
    };
  });
</script>

<svelte:window onkeydown={(event) => {
  if (event.key === 'Escape') tweetOpen = false;
}} />

<div class="chart-shell">
  <div class="chart-host" bind:this={host}></div>

  <div class="chart-toolbar" role="group" aria-label="Chart timeframe">
    {#each intervals as option}
      <button
        type="button"
        class:active={option === interval}
        aria-pressed={option === interval}
        onclick={() => changeInterval(option)}
      >{option}</button>
    {/each}
  </div>

  {#if status === 'loading'}
    <div class="chart-status loading" role="status" aria-label="Loading chart"><span></span></div>
  {:else if status === 'error'}
    <div class="chart-status error">Chart unavailable</div>
  {/if}

  {#if tweet && markerVisible}
    <div class="posted-annotation {markerAlign}" style="left:{markerLeft}px">
      <span class="posted-line" aria-hidden="true"></span>
      <button
        class="post-marker"
        type="button"
        style="top:{markerTop}px"
        aria-label="View post by {tweet.name}"
        aria-expanded={tweetOpen}
        aria-controls="tweet-popover-{ideaId}"
        onclick={() => tweetOpen = !tweetOpen}
      >
        <img src={tweet.avatar} alt="" />
      </button>
      {#if tweetOpen}
        <div
          id="tweet-popover-{ideaId}"
          class="mini-tweet"
          class:above={markerAbove}
          style="top:{markerTop}px"
        >
          <div class="mini-tweet-head">
            <img src={tweet.avatar} alt="" />
            <strong>{tweet.name}</strong>
            <span>@{tweet.handle}</span>
            <time datetime={tweet.postedAt}>{tweet.age}</time>
          </div>
          <p>{tweet.text}</p>
          <div class="mini-tweet-return">
            <strong style="color:{tweet.returnColor}; background:{tweet.returnBg}">{tweet.returnFmt}</strong>
            <span>since posted</span>
          </div>
        </div>
      {/if}
      <span class="posted-label">Posted {postedLabel}</span>
    </div>
  {/if}
</div>

<style>
  .chart-shell { position: relative; width: 100%; height: 100%; overflow: hidden; background: #0A0C10; }
  .chart-host { position: absolute; inset: 0 0 38px; }
  .chart-toolbar { position: absolute; inset: auto 0 0; z-index: 4; display: flex; height: 38px; align-items: center; gap: 4px; padding: 0 10px; border-top: 1px solid rgba(255,255,255,0.07); background: #0D0F13; }
  .chart-toolbar button { min-width: 38px; height: 28px; padding: 0 9px; border: 0; border-radius: 6px; background: transparent; color: #777981; font-family: 'IBM Plex Mono', monospace; font-size: 10px; font-weight: 600; cursor: pointer; }
  .chart-toolbar button:hover { color: #D6D7DC; }
  .chart-toolbar button.active { background: #292B31; color: #E7E6E2; }
  .chart-toolbar button:focus-visible { outline: 2px solid #D8B87E; outline-offset: 1px; }
  .chart-status { position: absolute; inset: 0 0 38px; z-index: 2; display: grid; place-items: center; background: #0A0C10; color: #777981; font-size: 11px; }
  .chart-status.loading span { width: 42%; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.06); animation: pulse 1.4s ease-in-out infinite; }
  .chart-status.error { color: #E87970; }
  .posted-annotation { position: absolute; inset: 0 auto 38px; z-index: 2; width: 0; pointer-events: none; }
  .posted-line { position: absolute; inset: 0 auto 24px 0; border-left: 1px dashed rgba(216,184,126,0.78); }
  .post-marker { position: absolute; left: 0; z-index: 2; display: grid; width: 38px; height: 38px; place-items: center; padding: 3px; border: 1px solid rgba(216,184,126,0.82); border-radius: 50%; background: #0D0F13; box-shadow: 0 2px 8px rgba(0,0,0,0.55); transform: translate(-50%, -50%); cursor: pointer; pointer-events: auto; }
  .post-marker img { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; background: #20222A; }
  .post-marker:hover { border-color: #E5C98F; transform: translate(-50%, -50%) scale(1.05); }
  .post-marker:focus-visible { outline: 2px solid #D8B87E; outline-offset: 3px; }
  .mini-tweet { --card-x: -50%; position: absolute; left: 0; z-index: 3; width: min(330px, 72vw); padding: 13px 14px; border: 1px solid rgba(216,184,126,0.46); border-radius: 12px; background: rgba(12,14,18,0.98); box-shadow: 0 6px 8px rgba(0,0,0,0.38); transform: translate(var(--card-x), 24px); animation: cardIn 0.16s cubic-bezier(0.22,1,0.36,1) both; pointer-events: auto; }
  .mini-tweet.above { transform: translate(var(--card-x), calc(-100% - 24px)); }
  .posted-annotation.left .mini-tweet { --card-x: -8%; }
  .posted-annotation.right .mini-tweet { --card-x: -92%; }
  .mini-tweet-head { display: flex; min-width: 0; align-items: center; gap: 6px; }
  .mini-tweet-head img { width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; object-fit: cover; background: #20222A; }
  .mini-tweet-head strong { overflow: hidden; color: #E1E1DE; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
  .mini-tweet-head span { overflow: hidden; color: #777981; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
  .mini-tweet-head time { margin-left: auto; color: #777981; font-size: 10px; white-space: nowrap; }
  .mini-tweet p { display: -webkit-box; overflow: hidden; margin: 9px 0 0; color: #C4C6CC; font-size: 12px; line-height: 1.5; -webkit-box-orient: vertical; -webkit-line-clamp: 3; line-clamp: 3; }
  .mini-tweet-return { display: flex; align-items: center; gap: 8px; margin-top: 10px; }
  .mini-tweet-return strong { padding: 4px 7px; border-radius: 6px; font-family: 'IBM Plex Mono', monospace; font-size: 11px; }
  .mini-tweet-return span { color: #777981; font-size: 10px; }
  .posted-label { position: absolute; bottom: 5px; padding: 3px 6px; border-radius: 4px; background: #191B21; color: #D8B87E; font-family: 'IBM Plex Mono', monospace; font-size: 8px; white-space: nowrap; }
  .posted-annotation.left .posted-label { transform: translateX(-8%); }
  .posted-annotation.center .posted-label { transform: translateX(-50%); }
  .posted-annotation.right .posted-label { transform: translateX(-92%); }

  @media (max-width: 640px) {
    .mini-tweet { width: min(260px, 70vw); padding: 11px 12px; }
    .mini-tweet p { -webkit-line-clamp: 2; line-clamp: 2; }
    .mini-tweet-head span { display: none; }
  }

  @keyframes pulse { 50% { opacity: 0.35; } }
  @keyframes cardIn { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) {
    .chart-status.loading span, .mini-tweet { animation: none; }
    .post-marker:hover { transform: translate(-50%, -50%); }
  }
</style>
