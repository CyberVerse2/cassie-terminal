import type { Cookies } from '@sveltejs/kit';
import { db, schema } from './db/client';

const COOKIE = 'cassie_paper_account';

export async function paperAccountId(cookies: Cookies, secure: boolean): Promise<string> {
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
