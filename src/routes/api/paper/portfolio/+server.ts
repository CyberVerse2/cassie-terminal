import { json } from '@sveltejs/kit';
import { paperAccountId } from '$lib/server/paper-session';
import { portfolio } from '$lib/server/paper-trading';

export async function GET({ cookies, url, request }) {
  const accountId = await paperAccountId(cookies, url.protocol === 'https:', request);
  return json(await portfolio(accountId));
}
