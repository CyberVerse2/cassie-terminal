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
  hitting the venues (Definitive / Hyperliquid / Alpaca IEX / Polymarket) at read time.
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

`.env` keys: `DATABASE_URL` (required), `PUBLIC_DYNAMIC_ENVIRONMENT_ID` (email sign-up),
`ALPACA_CLIENT_ID`, `ALPACA_CLIENT_SECRET`, and
`ALPACA_ENV=sandbox|live` (required for equity prices), and the public
`HYPERLIQUID_API_URL` / `POLYMARKET_*` defaults.

## Build

```bash
npm run build        # adapter-node build to build/
npm run preview      # preview the production build
node build           # run the production server
```

## Trading setup and delegated access

The signup flow introduces Cassie, lets the user choose per-trade allocation,
maximum deployed capital, and position count, then saves those settings against
their verified Dynamic user ID. Portfolio contains wallet funding addresses,
limit editing, and wallet-delegation revocation. Saved preferences do not grant
signing authority. The right rail estimates cash-position outcomes only when
entry and exit prices are unambiguous and refer to the traded asset.

`POST /api/trading/delegation/webhook` verifies Dynamic's HMAC against the exact
request bytes, checks the environment and owner, verifies decryption, and stores
only encrypted credentials. Revocation clears credentials and retains a
timestamped tombstone so an older grant cannot reactivate access. The server
needs `DYNAMIC_WEBHOOK_SECRET` and `DYNAMIC_DELEGATION_PRIVATE_KEY` (PEM; escaped
newlines are accepted). Never commit either value or expose them to the browser.

Dynamic Sandbox configuration was updated on September 19, 2026: embedded
wallets, optional delegated access, a supplied RSA public key, local/deployed
CORS origins, and the grant/revocation webhook at
`https://cassie-terminal.cyberverse.cloud/api/trading/delegation/webhook`.
Automatic delegation prompts and mandatory delegation remain off. Matching
secrets are in the ignored local `.env`; deployment needs those server secrets
and the new route before deliveries can succeed.

The onboarding requests Dynamic delegation and confirms approval using the SDK's
`hasDelegatedAccess` against refreshed wallet credentials. It does not poll the
database to decide whether the user approved. Server signing readiness is a
separate state requiring an active, matching webhook-backed record; Portfolio
shows that state, and Execute checks it without re-requesting approval.
Server signing also requires `DYNAMIC_API_KEY`; Flash
quotes and execution require `DEFINITIVE_API_KEY`. These are server-only values.
The local database is separate from deployment: a webhook delivered to the live
app does not automatically reach local development. Deploy the receiver and its
matching credentials before testing grants, then replay failed deliveries in
Dynamic. A successful wallet prompt alone does not establish backend readiness.

The right rail submits to `/api/trading/orders`. The server reserves the user's
allocation under a row lock, checks the delegated wallet owner, validates quote
signing payloads, and signs capped approvals plus an entry with attached exits.
This execution path supports Base long cash positions. Stock ideas resolve through
the issuer-verified Coinbase token contracts for NVDA, META, AAPL, GOOGL, AMZN,
MSFT, MSTR, SNDK, SPCX, and TSLA. The resolver rechecks the issuer's published list
(five-minute cache), matches Definitive's exact chain/address/decimals, and reads
the onchain multiplier to convert share-price exits into token-price exits.
Unknown tickers and share-class substitutions fail closed. Other spot assets still
require verified `routes.market_meta.definitive` data (`chain: "base"`, `address`,
and `decimals`). All trades require explicit dollar target/stop prices; missing
research levels are never invented. The authenticated `/api/trading/quote` preflight
validates a live bracket quote without signing or reserving funds; execution obtains
a fresh quote. Perpetuals and prediction markets are excluded from the feed.

Portfolio reconciles entry and protective orders with Definitive. Entry fills
keep capital reserved; finalized exits release it. Ambiguous submissions retain
their reservation for review. Attached exits run at Definitive without further
wallet prompts; this is not yet an autonomous agent that revises a thesis or
rebalances positions. Production webhook delivery has been verified. End-to-end
signing and live execution remain unverified; no real trade was placed during setup.
Existing paper balances remain explicitly labeled simulated in Portfolio.

Validation: `node --test src/lib/trading/*.test.js src/lib/server/trading/*.test.js` and `npm run build`.
