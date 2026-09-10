'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { checkOutAction } from '@/app/actions/counter';
import { useLocale } from '../LocaleProvider';
import { ReleaseDialog } from './ReleaseDialog';
import { SessionHeadline, panelClass, type WireRow } from './SessionRow';

/**
 * Who is inside, in the order they leave. Check-out honours supervision mode:
 * in an accompanied zone the guardian is already standing there, so a tap is
 * enough; in a drop-off zone the returning adult produces the code.
 *
 * `pane` is for the admin split view — fills one side of the board without the
 * single-column page max-width.
 */
export function ZoneBoard({ zoneId, zoneName, supervisionMode, initialRows, serverNowIso, pane = false }: {
  zoneId: string;
  zoneName: string;
  supervisionMode: 'accompanied' | 'drop_off';
  initialRows: WireRow[];
  /** The server's clock at render. Seeding the countdown from `Date.now()`
   *  produced a different first frame on the server and the client, which React
   *  reports as a hydration mismatch and repaints. */
  serverNowIso: string;
  pane?: boolean;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [now, setNow] = useState(() => new Date(serverNowIso).getTime());
  const skew = useRef(new Date(serverNowIso).getTime() - Date.now());
  const [releasing, setReleasing] = useState<WireRow | null>(null);
  const [confirmingCheckout, setConfirmingCheckout] = useState<WireRow | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + skew.current), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const response = await fetch(`/api/zones/${zoneId}/board`, { cache: 'no-store' });
        if (response.ok) {
          const next = (await response.json()) as { rows: WireRow[]; serverNowIso: string };
          setRows(next.rows);
          skew.current = new Date(next.serverNowIso).getTime() - Date.now();
        }
      } catch { /* a dropped poll is not worth showing on a counter screen */ }
    }, 10_000);
    return () => clearInterval(poll);
  }, [zoneId]);

  async function release(row: WireRow, method: 'code' | 'name_match') {
    setError(null);
    const result = await checkOutAction(row.sessionId, { verifyMethod: method });
    if (!result.ok) { setError(result.message); return; }
    setRows((prev) => prev.filter((r) => r.sessionId !== row.sessionId));
    setReleasing(null);
    router.refresh();
  }

  async function confirmCheckOut() {
    if (!confirmingCheckout) return;
    setCheckingOut(true);
    await release(confirmingCheckout, 'name_match');
    setCheckingOut(false);
    setConfirmingCheckout(null);
  }

  return (
    <div className={pane
      ? 'p-5 flex flex-col gap-4 min-w-0 h-full'
      : 'p-6 max-w-[--container-page] mx-auto flex flex-col gap-4'}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="display" style={{ fontSize: pane ? 'var(--font-size-2xl)' : 'var(--font-size-3xl)' }}>
          {zoneName}
        </h1>
        <span className="eyebrow shrink-0">{t.counter.inside(rows.length)}</span>
      </div>

      {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}

      {rows.length === 0 ? (
        <div className="card"><p className="muted">{t.counter.nobodyInside}</p></div>
      ) : null}

      {rows.map((row) => (
        <div key={row.sessionId} className={`card ${panelClass(row)}`} style={{ borderWidth: '2px' }}>
          <SessionHeadline row={row} now={now} />

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <span className="numeric text-sm" style={{ opacity: 0.85 }}>{row.childCode}</span>
            {row.medicalNotes ? (
              <span className="state state-overdue">{t.counter.medicalNote}</span>
            ) : null}
            <span className="state" style={{ background: 'rgba(255,255,255,.35)', color: 'inherit' }}>
              {row.status.replace('_', ' ')}
            </span>
          </div>

          {row.medicalNotes ? (
            <div className="notice notice-danger mt-3">{row.medicalNotes}</div>
          ) : null}

          <div className="flex flex-wrap gap-3 mt-4">
            {supervisionMode === 'accompanied' ? (
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmingCheckout(row)}>
                {t.counter.checkOut}
              </button>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => setReleasing(row)}>
                {t.counter.release}
              </button>
            )}
          </div>
        </div>
      ))}

      {releasing ? (
        <ReleaseDialog
          row={releasing}
          onClose={() => setReleasing(null)}
          onReleased={() => {
            setRows((prev) => prev.filter((r) => r.sessionId !== releasing.sessionId));
            setReleasing(null);
            router.refresh();
          }}
        />
      ) : null}

      {confirmingCheckout ? (
        <div className="fixed inset-0 scrim flex items-center justify-center p-6 z-50">
          <div className="card card-poster bg-white w-full max-w-[420px] flex flex-col gap-4">
            <div>
              <h2 className="headline" style={{ fontSize: 'var(--font-size-2xl)' }}>{t.counter.checkOutConfirmTitle}</h2>
              <p className="text-sm muted mt-1">{t.counter.checkOutConfirmBody(confirmingCheckout.childName)}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" className="btn btn-ghost" disabled={checkingOut} onClick={() => setConfirmingCheckout(null)}>
                {t.common.cancel}
              </button>
              <button type="button" className="btn btn-primary btn-lg" disabled={checkingOut} onClick={confirmCheckOut}>
                {checkingOut ? t.counter.confirming : t.counter.confirmCheckOut}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
