'use server';

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALE_COOKIE, isLocale } from '@carnival/shared';

/** Sets the language for this browser. Lasts a year — it is a preference, not a session. */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  const jar = await cookies();
  jar.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 365 * 24 * 3600,
    sameSite: 'lax',
    httpOnly: false,
  });
  revalidatePath('/', 'layout');
}
