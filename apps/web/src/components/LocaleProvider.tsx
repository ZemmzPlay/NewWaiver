'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_LOCALE, dictionary, localiseDigits, type Dictionary, type Locale } from '@carnival/shared';

interface LocaleValue {
  locale: Locale;
  t: Dictionary;
  dir: 'ltr' | 'rtl';
  /** Arabic-Indic digits in Arabic prose. Never for codes or printed times. */
  n: (value: string | number) => string;
}

const LocaleContext = createContext<LocaleValue>({
  locale: DEFAULT_LOCALE,
  t: dictionary(DEFAULT_LOCALE),
  dir: 'ltr',
  n: (v) => String(v),
});

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value: LocaleValue = {
    locale,
    t: dictionary(locale),
    dir: locale === 'ar' ? 'rtl' : 'ltr',
    n: (v) => localiseDigits(v, locale),
  };
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleValue {
  return useContext(LocaleContext);
}
