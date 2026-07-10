import { json } from '@sveltejs/kit';
import { getIdeaChart, isChartInterval } from '$lib/server/feed';

/** GET /api/ideas/:id/bars — venue-native series for the synchronized idea chart. */
export async function GET({ params, url }) {
  const interval = url.searchParams.get('interval');
  if (interval && !isChartInterval(interval)) {
    return json({ error: 'invalid chart interval' }, { status: 400 });
  }
  try {
    const chart = await getIdeaChart(params.id, interval);
    if (!chart) return json({ error: 'not found' }, { status: 404 });
    return json(chart);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return json({ error: message }, { status: 502 });
  }
}
