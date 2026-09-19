import type { Cookies } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db, schema } from './db/client';
import { verifyDynamicToken } from './dynamic-auth';

const COOKIE = 'cassie_paper_account';

async function guestAccountId(cookies: Cookies, secure: boolean): Promise<string> {
  let id = cookies.get(COOKIE);
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    id = crypto.randomUUID();
    cookies.set(COOKIE, id, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure,
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  await db.insert(schema.paperAccounts).values({ id }).onConflictDoNothing();
  return id;
}

export async function paperAccountId(
  cookies: Cookies,
  secure: boolean,
  request?: Request,
): Promise<string> {
  const user = request ? await verifyDynamicToken(request) : null;
  if (!user) return guestAccountId(cookies, secure);

  const [existing] = await db
    .select()
    .from(schema.paperAccounts)
    .where(eq(schema.paperAccounts.dynamicUserId, user.userId))
    .limit(1);
  if (existing) return existing.id;

  const guestId = cookies.get(COOKIE);
  if (guestId && /^[0-9a-f-]{36}$/i.test(guestId)) {
    const [guest] = await db
      .select()
      .from(schema.paperAccounts)
      .where(eq(schema.paperAccounts.id, guestId))
      .limit(1);
    if (guest && !guest.dynamicUserId) {
      await db
        .update(schema.paperAccounts)
        .set({ dynamicUserId: user.userId, updatedAt: new Date() })
        .where(eq(schema.paperAccounts.id, guest.id));
      return guest.id;
    }
  }

  const id = crypto.randomUUID();
  await db.insert(schema.paperAccounts).values({ id, dynamicUserId: user.userId });
  cookies.set(COOKIE, id, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure,
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}
