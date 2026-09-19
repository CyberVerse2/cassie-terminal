import { json } from '@sveltejs/kit';
import { verifyDynamicToken } from '$lib/server/dynamic-auth';
import { readSettings, writeSettings } from '$lib/server/trading/settings';
import { validateSettings } from '$lib/trading/settings.js';
import { tradingCapabilities } from '$lib/server/trading/capabilities';
import { delegationStatus } from '$lib/server/trading/delegations';
const headers = { 'cache-control': 'no-store' };
// A saved preference is not signing authority. Enable only when a managed
// execution service can receive delegation and enforce these limits.
export async function GET({ request }) {
  const user = await verifyDynamicToken(request);
  if (!user) return json({ error: 'Sign in to load your trading settings.' }, { status: 401, headers });
  try { return json({ settings: await readSettings(user.userId), delegations: await delegationStatus(user.userId), ...tradingCapabilities() }, { headers }); }
  catch { return json({ error: 'Your trading settings could not be loaded. Try again.' }, { status: 503, headers }); }
}
export async function PUT({ request, url }) {
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Use Cassie to update your settings.' }, { status: 403, headers });
  const user = await verifyDynamicToken(request);
  if (!user) return json({ error: 'Sign in to save your trading settings.' }, { status: 401, headers });
  let settings;
  try {
    const raw = await request.text();
    if (raw.length > 4096) throw new Error('Settings are too large.');
    settings = validateSettings(JSON.parse(raw));
  } catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid settings.' }, { status: 400, headers }); }
  try { await writeSettings(user.userId, settings); return json({ settings, ...tradingCapabilities() }, { headers }); }
  catch { return json({ error: 'Your settings were not saved. Try again.' }, { status: 503, headers }); }
}
