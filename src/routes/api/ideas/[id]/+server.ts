import { json } from '@sveltejs/kit';
import { getIdea } from '$lib/server/feed';

/** GET /api/ideas/:id — decision-ready thesis, alpha drivers, and normalized plan. */
export async function GET({ params }) {
  const detail = await getIdea(params.id);
  if (!detail) return json({ error: 'not found' }, { status: 404 });
  return json(detail);
}
