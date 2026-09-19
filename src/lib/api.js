// Client for the cassie-indexer read API (Hono, default :8787, proxied at /api).
// Endpoints (see cassie-indexer/src/api/server.ts):
//   GET /api/ideas?tab=all|perps|stocks|tokens|markets&limit=&cursor=  -> { cards, nextCursor }
//   GET /api/ideas/:id                                                 -> IdeaDetail
//   GET /api/authors/:handle                                           -> AuthorStats
//   GET /api/status                                                    -> { lastFetchAt, routedIdeas }
//
// Shapes mirror cassie-indexer/src/api/serialize.ts. We return the raw JSON and
// do presentation mapping in logic.js.

import { authHeaders } from './dynamic/auth.js';

const BASE = '/api';

async function getJSON(path, { signal } = {}) {
  const res = await fetch(BASE + path, { signal, headers: { accept: 'application/json', ...authHeaders() } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`${path} → ${res.status} ${res.statusText}${body ? `: ${body.slice(0, 200)}` : ''}`);
  }
  return res.json();
}

async function postJSON(path, body) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json', ...authHeaders() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `${path} → ${res.status} ${res.statusText}`);
  return payload;
}

/** Feed cards for a tab. `tab` ∈ all|perps|stocks|tokens|markets. */
export async function fetchIdeas(tab = 'all', { limit = 50, signal } = {}) {
  const data = await getJSON(`/ideas?tab=${encodeURIComponent(tab)}&limit=${limit}`, { signal });
  return data.cards ?? [];
}

/** Decision-ready detail for one idea (thesis, alpha drivers, normalized plan). */
export function fetchIdea(id, { signal } = {}) {
  return getJSON(`/ideas/${encodeURIComponent(id)}`, { signal });
}

/** Author track record — the real substitute for the old "N you follow traded this". */
export function fetchAuthor(handle, { signal } = {}) {
  return getJSON(`/authors/${encodeURIComponent(handle)}`, { signal });
}

/** Feed freshness for the "live · Nm ago" header. */
export function fetchStatus({ signal } = {}) {
  return getJSON('/status', { signal });
}

/** Deterministic real-tweet groups keyed by routed market and direction. */
export async function fetchTradeGroups({ tab = 'all', limit = 60, signal } = {}) {
  const data = await getJSON(`/trade-groups?tab=${encodeURIComponent(tab)}&limit=${limit}`, { signal });
  return data.groups ?? [];
}


export function fetchPaperPortfolio({ signal } = {}) {
  return getJSON('/paper/portfolio', { signal });
}

export function placePaperOrder(input) {
  return postJSON('/paper/orders', input);
}

export function closePaperPosition(positionId) {
  return postJSON(`/paper/positions/${encodeURIComponent(positionId)}/close`);
}
