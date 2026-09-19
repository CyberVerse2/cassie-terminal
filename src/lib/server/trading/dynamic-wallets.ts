import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchUserWallets(userId: string) {
  const apiKey = env.DYNAMIC_API_KEY;
  const environmentId = publicEnv.PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? '';
  if (!apiKey || !UUID.test(environmentId) || !UUID.test(userId)) throw new Error('Dynamic is not configured.');
  const response = await fetch(
    `https://app.dynamicauth.com/api/v0/environments/${environmentId}/users/${userId}/wallets`,
    { headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' }, signal: AbortSignal.timeout(8000) },
  );
  if (!response.ok) throw new Error('Dynamic did not return this wallet list.');
  const data = await response.json();
  if (Array.isArray(data?.wallets)) return data.wallets;
  if (Array.isArray(data)) return data;
  return [];
}
