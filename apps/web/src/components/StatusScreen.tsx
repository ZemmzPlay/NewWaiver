'use client';

import type { StatusPayload } from '@/server/status';
import { Shape } from './Brand';
import { LiveStatus } from './LiveStatus';
import { useLocale } from './LocaleProvider';
import { PublicChrome } from './PublicChrome';

export function StatusScreen({ status, shownCode, welcome, added }: {
  status: StatusPayload;
  shownCode: string;
  welcome: boolean;
  added: boolean;
}) {
  const { t } = useLocale();

  return (
    <PublicChrome ticker={false}>
      <section className="bg-yellow px-6 py-8 relative overflow-hidden">
        <Shape name="star" size={220} spin className="absolute -end-12 -top-12 text-indigo" style={{ opacity: 0.15 }} />
        <div className="relative">
          <div className="eyebrow" style={{ color: 'var(--carnival-indigo)' }}>
            {welcome
              ? (added ? t.status.added : t.status.registered(status.guardianFirstName))
              : t.status.yourCode}
          </div>
          {/* Six digits, grouped three and three, in the tabular face — this is
              the thing a parent reads out across a loud counter, so it is the
              largest thing that will fit on one line and it never wraps. */}
          <div className="code-display mt-2">{shownCode}</div>
          <p className="mt-3 text-sm" style={{ color: 'var(--carnival-indigo)', maxWidth: '34ch' }}>
            {t.status.showAtCounter}
          </p>
        </div>
      </section>

      <section className="px-6 py-8 flex flex-col gap-6 max-w-[--container-narrow] mx-auto">
        {welcome ? (
          <div className="card card-block">
            <div className="eyebrow">{t.status.doThisNow}</div>
            <p className="mt-2 text-sm">
              <strong>{t.status.keepOpen}</strong> {t.status.keepOpenBody}
            </p>
            <p className="mt-3 text-sm">
              <strong>{t.status.screenshotIt}</strong> {t.status.screenshotBody}
            </p>
          </div>
        ) : null}

        <LiveStatus initial={status} />

        <div className="notice notice-info">{t.status.ruleNotice}</div>
      </section>
    </PublicChrome>
  );
}
