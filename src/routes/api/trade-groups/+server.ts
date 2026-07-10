import { json } from '@sveltejs/kit';
import { listTradeGroups } from '$lib/server/trade-groups';

export async function GET({ url }) {
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 60), 1), 60);
  const tab = (url.searchParams.get('tab') ?? 'all').toLowerCase();
  return json(await listTradeGroups(limit, tab));
}
