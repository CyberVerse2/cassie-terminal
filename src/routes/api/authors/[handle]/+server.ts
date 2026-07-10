import { json } from '@sveltejs/kit';
import { authorStats } from '$lib/server/feed';

/** GET /api/authors/:handle — the track record no single tweet contains. */
export async function GET({ params }) {
  return json(await authorStats(params.handle));
}
