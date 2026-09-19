import { env } from '$env/dynamic/private';
export async function flash(path: string, body?: unknown) {
  if (!env.DEFINITIVE_API_KEY) throw new Error('Trade execution is not configured.');
  const response = await fetch(`https://flash.definitive.fi/v1${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', 'x-definitive-api-key': env.DEFINITIVE_API_KEY },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Definitive could not complete the request (${response.status}).`);
  return response.json();
}
