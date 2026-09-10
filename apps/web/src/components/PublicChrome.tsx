'use client';

import type { ReactNode } from 'react';
import { Endorsement, Marquee, Wordmark } from './Brand';
import { LocaleToggle } from './LocaleToggle';
import { useLocale } from './LocaleProvider';

/**
 * The frame every guardian-facing screen sits in.
 *
 * The wordmark appears once, in the header, at a size you can actually read —
 * it was previously repeated in the hero of the landing page, which made the
 * top of the first screen two logos deep before any content.
 *
 * The rules ticker lives at the bottom. It is a reminder to act on before you
 * walk into the zone, not a thing to read before you have decided anything, and
 * at the top it pushed the package tiles below the fold on a phone.
 */
export type StepKey = 'package' | 'waiver' | 'guardian' | 'children' | 'consent';

export function PublicChrome({ children, step, ticker = true }: {
  children: ReactNode;
  /** A key, not a label — the chrome localises its own step name. */
  step?: { current: number; total: number; key: StepKey };
  ticker?: boolean;
}) {
  const { t } = useLocale();

  return (
    <div className="min-h-dvh flex flex-col bg-page">
      <header className="bg-indigo px-6 py-4 flex items-center justify-between gap-4">
        <Wordmark colourway="white" height={38} />
        <div className="flex items-center gap-3">
          {step ? (
            <div className="text-end">
              <div className="eyebrow" style={{ color: 'var(--carnival-yellow)' }}>
                {t.steps.of(step.current, step.total)}
              </div>
              <div className="font-ui text-2xs font-semibold text-white">{t.steps[step.key]}</div>
            </div>
          ) : null}
          <LocaleToggle onDark />
        </div>
      </header>

      {step ? (
        <div className="h-1 bg-indigo-100" role="presentation">
          <div
            className="h-full bg-orange transition-[width] duration-[--dur-slow] ease-[--ease-standard]"
            style={{ width: `${(step.current / step.total) * 100}%` }}
          />
        </div>
      ) : null}

      <main className="flex-1">{children}</main>

      {ticker ? (
        <div className="bg-yellow py-3 text-indigo">
          <Marquee items={[...t.landing.ticker, ...t.landing.ticker]} />
        </div>
      ) : null}

      <footer className="bg-indigo px-6 py-7 flex flex-col gap-4 text-white">
        <Endorsement height={40} />
        <p className="text-2xs leading-normal" style={{ opacity: 0.85 }}>
          {t.footer.privacy}
        </p>
      </footer>
    </div>
  );
}
