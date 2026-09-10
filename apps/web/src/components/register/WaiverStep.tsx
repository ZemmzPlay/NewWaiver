'use client';

import { useEffect, useRef, useState } from 'react';
import { Eyebrow } from '../Brand';
import { useLocale } from '../LocaleProvider';

/**
 * Step 2 — read the waiver.
 *
 * "The Continue control is disabled until the panel is scrolled to the end."
 * The gate only proves they scrolled, which is why the text is kept short; see
 * the drafting notes in WAIVER_DRAFT.md.
 *
 * The progress bar under the frame is not decoration. Without it the button is
 * disabled for a reason the reader cannot see, and the commonest response to
 * that is to stop and ask a staffer — which is the one thing this flow is meant
 * to avoid.
 */
export function WaiverStep({ title, html, version, onContinue, onBack }: {
  title: string; html: string; version: number; onContinue: () => void; onBack: () => void;
}) {
  const { t } = useLocale();
  const panelRef = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;

    const check = () => {
      const scrollable = panel.scrollHeight - panel.clientHeight;
      // A tall viewport may show the whole text at once, which also counts.
      if (scrollable <= 24) { setReachedEnd(true); setProgress(1); return; }
      setProgress(Math.min(1, panel.scrollTop / scrollable));
      if (panel.scrollTop + panel.clientHeight >= panel.scrollHeight - 24) setReachedEnd(true);
    };
    check();
    panel.addEventListener('scroll', check, { passive: true });
    return () => panel.removeEventListener('scroll', check);
  }, [html]);

  return (
    <div className="px-6 py-8 flex flex-col gap-5 max-w-[--container-narrow] mx-auto">
      <div>
        <Eyebrow>{t.waiverStep.version(version)}</Eyebrow>
        <h1 className="headline mt-1" style={{ fontSize: 'var(--font-size-2xl)' }}>{title}</h1>
        <p className="mt-2 text-sm muted">{t.waiverStep.readToEnd}</p>
      </div>

      <div className="waiver-frame">
        <div
          ref={panelRef}
          className="waiver-panel"
          style={{ maxHeight: '52dvh' }}
          tabIndex={0}
          role="region"
          aria-label={title}
        >
          <div className="waiver-prose text-sm" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
        <div className="waiver-progress" role="presentation">
          <div className="waiver-progress-bar" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      {!reachedEnd ? (
        <div className="notice notice-info" role="status">{t.waiverStep.keepScrolling}</div>
      ) : null}

      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost" onClick={onBack}>{t.common.back}</button>
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block"
          disabled={!reachedEnd}
          onClick={onContinue}
        >
          {t.waiverStep.accept}
        </button>
      </div>
    </div>
  );
}
