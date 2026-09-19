import { json } from '@sveltejs/kit';
import { paperAccountId } from '$lib/server/paper-session';
import { closePaperPosition } from '$lib/server/paper-trading';

export async function POST({ cookies, params, url, request }) {
  try {
    const accountId = await paperAccountId(cookies, url.protocol === 'https:', request);
    return json(await closePaperPosition(accountId, params.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('not found') ? 404 : 409;
    return json({ error: message }, { status });
  }
}
