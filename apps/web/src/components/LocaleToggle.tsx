'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLocaleAction } from '@/app/actions/locale';
import { useLocale } from './LocaleProvider';

/**
 * One control, always showing the language it switches *to*, written in that
 * language — so it reads correctly to someone who cannot read the current one.
 */
export function LocaleToggle({ onDark = false }: { onDark?: boolean }) {
  const { locale, t } = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next = locale === 'en' ? 'ar' : 'en';

  return (
    <button
      type="button"
      className="btn btn-sm"
      lang={next}
      aria-label={`Switch language to ${next === 'ar' ? 'Arabic' : 'English'}`}
      disabled={pending}
      style={
        onDark
          ? { background: 'transparent', color: 'var(--carnival-white)', border: '2px solid rgba(255,255,255,.4)' }
          : { background: 'transparent', color: 'var(--carnival-indigo)', border: '2px solid var(--carnival-indigo)' }
      }
      onClick={() => startTransition(async () => { await setLocaleAction(next); router.refresh(); })}
    >
      {t.meta.switchTo}
    </button>
  );
}
