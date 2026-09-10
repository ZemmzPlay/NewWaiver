'use client';

import { useState } from 'react';
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
  const [copied, setCopied] = useState(false);

  /**
   * Copies the formatted code as shown (e.g. `554 048`). Falls back to a
   * textarea trick when the Clipboard API is unavailable (older WebViews).
   */
  async function copyCode(): Promise<void> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shownCode);
      } else {
        const area = document.createElement('textarea');
        area.value = shownCode;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        document.execCommand('copy');
        document.body.removeChild(area);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

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
          <div className="flex flex-wrap items-center gap-3 mt-2">
            <div className="code-display">{shownCode}</div>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{
                background: 'var(--carnival-white)',
                borderColor: 'var(--carnival-indigo)',
                color: 'var(--carnival-indigo)',
                width: 'var(--space-8)',
                height: 'var(--space-8)',
                minHeight: 'var(--space-8)',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => { void copyCode(); }}
              aria-label={copied ? t.status.copied : t.status.copyCode}
              title={copied ? t.status.copied : t.status.copyCode}
            >
              {copied ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12.5 9.5 17 19 7.5"
                    stroke="currentColor"
                    strokeWidth="2.25"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <rect
                    x="9" y="9" width="11" height="11" rx="2"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M7 15H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v1"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              )}
            </button>
          </div>
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
