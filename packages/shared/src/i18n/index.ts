import { ar } from './ar.js';
import { en, type Dictionary } from './en.js';

export type { Dictionary } from './en.js';
export type Locale = 'en' | 'ar';

export const LOCALES: Locale[] = ['en', 'ar'];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'carnival_locale';

const DICTIONARIES: Record<Locale, Dictionary> = { en, ar };

export function isLocale(value: unknown): value is Locale {
  return value === 'en' || value === 'ar';
}

export function dictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}

export function direction(locale: Locale): 'ltr' | 'rtl' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Arabic-Indic digits for Arabic copy.
 *
 * Applied to prose, never to anything a guardian has to read back to a staffer:
 * the registration code, the countdown and the printed times stay in Western
 * digits, because the staffer reading the screen may not read Arabic and the
 * sticker is printed once for both languages.
 */
const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function localiseDigits(value: string | number, locale: Locale): string {
  const text = String(value);
  if (locale !== 'ar') return text;
  return text.replace(/\d/g, (d) => ARABIC_DIGITS[Number(d)]!);
}
