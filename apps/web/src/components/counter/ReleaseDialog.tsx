'use client';

import { useState } from 'react';
import { formatRegistrationCode } from '@carnival/shared';
import { checkOutAction } from '@/app/actions/counter';
import { useLocale } from '../LocaleProvider';
import type { WireRow } from './SessionRow';

/**
 * Drop-off release. The returning adult produces the registration code, or
 * matches the guardian name on file. Anyone else needs a supervisor PIN and
 * their name is written down.
 */
export function ReleaseDialog({ row, onClose, onReleased }: {
  row: WireRow; onClose: () => void; onReleased: () => void;
}) {
  const { t } = useLocale();
  const [typedCode, setTypedCode] = useState('');
  const [someoneElse, setSomeoneElse] = useState(false);
  const [releasedTo, setReleasedTo] = useState('');
  const [supervisorPin, setSupervisorPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const codeMatches = typedCode.replace(/\D/g, '') === row.registrationCode.replace(/\D/g, '');

  async function confirm() {
    setBusy(true);
    setError(null);
    const payload = someoneElse
      ? { verifyMethod: 'supervisor_override' as const, releasedTo: releasedTo.trim(), supervisorPin }
      : { verifyMethod: 'code' as const };
    const result = await checkOutAction(row.sessionId, payload);
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    onReleased();
  }

  return (
    <div className="fixed inset-0 scrim flex items-center justify-center p-6 z-50">
      <div className="card card-poster bg-white w-full max-w-[560px] flex flex-col gap-4">
        <div>
          <div className="eyebrow">{t.counter.releasing}</div>
          <h2 className="headline" style={{ fontSize: 'var(--font-size-2xl)' }}>{row.childName}</h2>
          <p className="text-sm muted mt-1">{t.counter.registeredTo(row.guardianName)}</p>
        </div>

        <div className="notice notice-warn">{t.counter.releaseWarning}</div>

        {!someoneElse ? (
          <div className="field">
            <label className="ui-label" htmlFor="code-check">{t.counter.codeCheck}</label>
            <input
              id="code-check"
              className="field-control numeric"
              style={{ fontSize: 'var(--font-size-xl)' }}
              inputMode="numeric"
              value={typedCode}
              onChange={(event) => setTypedCode(event.target.value.replace(/[^\d\s]/g, '').slice(0, 7))}
              placeholder={formatRegistrationCode('482109')}
              autoFocus
            />
            {typedCode && !codeMatches ? (
              <span className="field-error">{t.counter.wrongCode}</span>
            ) : null}
          </div>
        ) : (
          <>
            <div className="field">
              <label className="ui-label" htmlFor="released-to">{t.counter.whoCollecting}</label>
              <input
                id="released-to"
                className="field-control"
                value={releasedTo}
                onChange={(event) => setReleasedTo(event.target.value)}
                placeholder={t.counter.whoCollectingPlaceholder}
              />
            </div>
            <div className="field">
              <label className="ui-label" htmlFor="sup-pin">{t.counter.supervisorPin}</label>
              <input
                id="sup-pin"
                className="field-control numeric"
                type="password"
                inputMode="numeric"
                value={supervisorPin}
                onChange={(event) => setSupervisorPin(event.target.value)}
              />
            </div>
          </>
        )}

        {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}

        <div className="flex flex-wrap gap-3">
          <button type="button" className="btn btn-ghost" onClick={onClose}>{t.common.cancel}</button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { setSomeoneElse(!someoneElse); setError(null); }}
          >
            {someoneElse ? t.counter.itIsGuardian : t.counter.someoneElse}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-lg"
            disabled={busy || (someoneElse ? !releasedTo.trim() || supervisorPin.length < 4 : !codeMatches)}
            onClick={confirm}
          >
            {busy ? t.counter.confirming : t.counter.confirmRelease}
          </button>
        </div>
      </div>
    </div>
  );
}
