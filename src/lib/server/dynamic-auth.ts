import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '$env/dynamic/public';

const environmentId = env.PUBLIC_DYNAMIC_ENVIRONMENT_ID ?? '';
const jwks = environmentId
  ? createRemoteJWKSet(
      new URL(`https://app.dynamicauth.com/api/v0/sdk/${environmentId}/.well-known/jwks`),
    )
  : null;

export type DynamicUser = { userId: string; email: string | null };

export async function verifyDynamicToken(request: Request): Promise<DynamicUser | null> {
  if (!jwks) return null;
  const header = request.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, jwks, { algorithms: ['RS256'] });
    const userId = typeof payload.sub === 'string' ? payload.sub : null;
    if (!userId) return null;
    const credentials = Array.isArray(payload.verified_credentials)
      ? payload.verified_credentials
      : [];
    const credentialEmail = credentials
      .map((item) => (item && typeof item === 'object' ? (item as { email?: unknown }).email : null))
      .find((value): value is string => typeof value === 'string');
    const email = typeof payload.email === 'string' ? payload.email : credentialEmail ?? null;
    return { userId, email };
  } catch {
    return null;
  }
}
