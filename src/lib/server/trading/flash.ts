import { env } from '$env/dynamic/private';
let nextRequest=0;
export async function flash(path: string, body?: unknown, method?:string) {
  if (!env.DEFINITIVE_API_KEY) throw new Error('Trade execution is not configured.');
  const wait=Math.max(0,nextRequest-Date.now());nextRequest=Date.now()+wait+300;
  if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
  const response = await fetch(`https://flash.definitive.fi/v1${path}`, {
    method: method??(body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', 'x-definitive-api-key': env.DEFINITIVE_API_KEY },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok) throw new Error(`Definitive could not complete the request (${response.status}).`);
  return response.json();
}
