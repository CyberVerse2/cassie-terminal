# Cassie Terminal

The fullstack Cassie app — a **SvelteKit** trading terminal that turns curated trader
posts ("The Desk") into routed, tradable ideas across perps, tokenized stocks, spot
tokens, and prediction markets.

It reads the same Postgres database the **cassie-indexer** writes to. The indexer is a
pure pipeline (collect → extract → route → price); this app owns the read API and the UI.

```
cassie-indexer  ──writes──►  Postgres  ◄──reads──  cassie-terminal (this app)
  (pipeline only)                                   SvelteKit: /api routes + UI
```

## Architecture

- **Backend** (`src/lib/server/`, `src/routes/api/`): SvelteKit endpoints over Drizzle +
  postgres.js. `feed.ts` runs the queries; `serialize.ts` shapes rows into feed cards /
  detail and computes **live** `currentPrice` + direction-adjusted `sincePostedPct` by
  hitting the venues (Hyperliquid / Alpaca IEX / CoinGecko / Polymarket) at read time.
  - `GET /api/ideas?tab=all|perps|stocks|tokens|markets` → `{ cards, nextCursor }`; The Desk treats every routed idea as a Cassie call, orders calls by the pipeline's conviction judgment, and collapses repeated instrument-side calls into one opportunity
  - `GET /api/ideas/:id` → decision-ready detail (`thesis`, three `alphaDrivers`, and normalized `plan`)
  - `GET /api/authors/:handle` → track record (win rate, avg since-posted)
  - `GET /api/status` → feed freshness for the "live · Nm ago" header
- **Frontend** (`src/routes/+page.svelte`, `src/lib/components/`, `src/lib/logic.js`):
  Svelte 5 runes. `logic.js` holds no data — it maps live API responses into the flat
  view-model the components render. `src/lib/api.js` is the browser client. Each selected
  idea opens as one continuous **trade brief**: live market state, source track record,
  synchronized venue-native chart, thesis, three alpha drivers, and a normalized entry / target / stop /
  horizon plan. The Desk supports literal search, venue-category tabs, and a normalized
  horizon filter (`immediate`, `short-term`, `medium-term`, `long-term`, `unspecified`).

Every value shown is live or a transform of a live field. There is **no synthetic market
data**. The primary view contains only information that changes the trade decision: side,
live price, since-call return, chart context, source quality, thesis, drivers, target, stop,
and horizon. The **trade rail is local paper trading**. Direction is fixed to the routed
idea and orders fill against the live price client-side; the indexer holds no trading keys
and performs no execution.

## Setup

Requires the cassie-indexer's Postgres populated with ideas (`bun run daemon` / `bun run demo`).

```bash
npm install
cp .env .env.local   # or edit .env: DATABASE_URL must point at the indexer's DB
npm run dev          # http://localhost:5173
```

`.env` keys: `DATABASE_URL` (required), `ALPACA_CLIENT_ID`, `ALPACA_CLIENT_SECRET`, and
`ALPACA_ENV=sandbox|live` (required for equity prices), `COINGECKO_API_KEY` (optional), and the public
`HYPERLIQUID_API_URL` / `POLYMARKET_*` defaults.

## Build

```bash
npm run build        # adapter-node build to build/
npm run preview      # preview the production build
node build           # run the production server
```
