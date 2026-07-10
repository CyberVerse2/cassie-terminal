import { json } from '@sveltejs/kit';
import { listIdeas } from '$lib/server/feed';

/** GET /api/ideas?tab=all|perps|stocks|tokens|markets&limit=&cursor=<ISO postedAt> */
export async function GET({ url }) {
  const tab = (url.searchParams.get('tab') ?? 'all').toLowerCase();
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 12), 1), 30);
  const cursor = url.searchParams.get('cursor');
  return json(await listIdeas(tab, limit, cursor));
}
