import { json } from '@sveltejs/kit';
import { paperAccountId } from '$lib/server/paper-session';
import { placeMarketOrder } from '$lib/server/paper-trading';

export async function POST({ cookies, request, url }) {
  try {
    const body = await request.json();
    const accountId = await paperAccountId(cookies, url.protocol === 'https:', request);
    const result = await placeMarketOrder({
      accountId,
      ideaId: String(body.ideaId ?? ''),
      direction: body.direction,
      amountUsd: Number(body.amountUsd),
    });
    return json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('Insufficient') ? 409 : 400;
    return json({ error: message }, { status });
  }
}
