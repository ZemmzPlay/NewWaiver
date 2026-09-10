import 'server-only';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, dictionary, isLocale, type Locale } from '@carnival/shared';

/**
 * The chosen language lives in a cookie rather than the URL.
 *
 * A guardian's confirmation link is emailed, printed on nothing, and shared by
 * screenshot — putting `/ar/` in it would mean two URLs for one family's page,
 * and a staffer reading a code off a parent's screen would see a path they do
 * not recognise. One URL, one cookie, and the toggle is on every screen.
 */
export async function currentLocale(): Promise<Locale> {
  const jar = await cookies();
  const value = jar.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function currentDictionary() {
  return dictionary(await currentLocale());
}
