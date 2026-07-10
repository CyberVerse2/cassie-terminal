import { json } from '@sveltejs/kit';
import { feedStatus } from '$lib/server/feed';

/** GET /api/status — feed freshness for the "live · Nm ago" header. */
export async function GET() {
  return json(await feedStatus());
}
