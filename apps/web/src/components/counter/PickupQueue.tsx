'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  PICKUP_ESCALATE_ATTEMPTS, dubaiTime, formatForDisplay, minutesSince, overdueParts,
} from '@carnival/shared';
import { checkOutAction, pickupAttemptAction } from '@/app/actions/counter';
import { Shape } from '../Brand';
import { TickingNumber } from '../TickingNumber';
import { useLocale } from '../LocaleProvider';
import { ReleaseDialog } from './ReleaseDialog';
import { panelClass, type WireRow } from './SessionRow';

/**
 * The Pickup queue.
 *
 * PRD s5: "This queue is the reason to build the system, not a side feature. It
 * should be the clearest screen in the product." So: one card per child, the
 * biggest number on the card is how long they have been waiting, one tap to
 * call, and every attempt logged with an outcome. Nothing else is on screen.
 *
 * A card escalates after three failed attempts or thirty minutes, and the
 * escalated card says out loud what to do next, because at that point the
 * person reading it is under pressure.
 */
export function PickupQueue({ initialRows, serverNowIso }: {
  initialRows: WireRow[];
  /** See the note in ZoneBoard: the clock has to start from the server's. */
  serverNowIso: string;
}) {
  const { t } = useLocale();
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [now, setNow] = useState(() => new Date(serverNowIso).getTime());
  const skew = useRef(new Date(serverNowIso).getTime() - Date.now());
  const [error, setError] = useState<string | null>(null);
  const [logging, setLogging] = useState<WireRow | null>(null);
  const [releasing, setReleasing] = useState<WireRow | null>(null);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + skew.current), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const response = await fetch('/api/pickup-queue', { cache: 'no-store' });
        if (response.ok) {
          const next = (await response.json()) as { rows: WireRow[]; serverNowIso: string };
          setRows(next.rows);
          skew.current = new Date(next.serverNowIso).getTime() - Date.now();
        }
      } catch { /* keep the last known queue on screen */ }
    }, 10_000);
    return () => clearInterval(poll);
  }, []);

  function drop(sessionId: string) {
    setRows((prev) => prev.filter((r) => r.sessionId !== sessionId));
    router.refresh();
  }

  /**
   * An overdue child is still a child in a zone, so releasing them from this
   * screen goes through exactly the same check as releasing them from the
   * board: in a drop-off zone the returning adult produces the code, and
   * anyone who is not the registered guardian needs a supervisor.
   */
  async function collected(row: WireRow) {
    setError(null);
    if (row.supervisionMode === 'drop_off') { setReleasing(row); return; }
    const result = await checkOutAction(row.sessionId, { verifyMethod: 'name_match' });
    if (!result.ok) { setError(result.message); return; }
    drop(row.sessionId);
  }

  if (rows.length === 0) {
    return (
      <div className="p-6 max-w-[--container-page] mx-auto">
        <div className="card card-poster relative overflow-hidden text-center py-16">
          <Shape name="clover" size={220} className="absolute -right-12 -bottom-12 text-indigo" style={{ opacity: 0.12 }} />
          <div className="relative">
            <div className="display" style={{ fontSize: 'var(--font-size-3xl)' }}>{t.counter.nobodyWaiting}</div>
            <p className="muted mt-3">{t.counter.nobodyWaitingBody}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[--container-page] mx-auto flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="display" style={{ fontSize: 'var(--font-size-3xl)' }}>{t.counter.pickupQueue}</h1>
        <span className="eyebrow">{t.counter.waiting(rows.length)}</span>
      </div>

      {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}

      {rows.map((row) => {
        const overdueMinutes = minutesSince(new Date(row.endsAt), new Date(now));
        return (
          <div key={row.sessionId} className={`card ${panelClass(row)}`} style={{ borderWidth: '2px' }}>
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <div className="display" style={{ fontSize: 'var(--font-size-3xl)', color: 'inherit' }}>
                  {row.childName}
                </div>
                <div className="text-md mt-1" style={{ opacity: 0.9 }}>
                  {row.zoneName} · <span className="numeric">{row.childCode}</span>
                </div>
                <div className="text-md mt-3">
                  <strong>{row.guardianName}</strong>
                  <span className="numeric"> · {formatForDisplay(row.guardianPhone)}</span>
                </div>
              </div>

              <div className="text-right">
                <TickingNumber
                  value={overdueParts(overdueMinutes).value}
                  className="display-num block"
                  style={{ fontSize: 'var(--font-size-4xl)', color: 'inherit' }}
                />
                <div className="eyebrow" style={{ color: 'inherit', opacity: 0.85 }}>
                  {overdueParts(overdueMinutes).unit === 'hours' ? t.counter.hoursOver : t.counter.minutesOver}{' '}
                  <span className="numeric">{dubaiTime(new Date(row.endsAt))}</span>
                </div>
                {row.attemptCount > 0 ? (
                  <div className="eyebrow mt-2" style={{ color: 'inherit', opacity: 0.85 }}>
                    {t.counter.attempts(row.attemptCount)}
                  </div>
                ) : null}
              </div>
            </div>

            {row.escalated ? (
              <div
                className="notice mt-4"
                style={{ background: 'var(--carnival-white)', borderColor: 'var(--orange-700)', color: 'var(--orange-700)' }}
                role="alert"
              >
                <strong>{t.counter.escalate}</strong>{' '}
                {row.attemptCount >= PICKUP_ESCALATE_ATTEMPTS
                  ? t.counter.escalateAttempts(row.attemptCount)
                  : t.counter.escalateMinutes(overdueMinutes)}{' '}
                {t.counter.escalateAction}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3 mt-5">
              <a className="btn btn-on-dark btn-lg" href={`tel:${row.guardianPhone}`}>
                {t.counter.call(row.guardianName.split(' ')[0]!)}
              </a>
              <button type="button" className="btn btn-outline btn-lg" style={{ background: 'var(--carnival-white)' }} onClick={() => setLogging(row)}>
                {t.counter.logAttempt}
              </button>
              <button type="button" className="btn btn-secondary btn-lg" onClick={() => collected(row)}>
                {t.counter.collected}
              </button>
            </div>
          </div>
        );
      })}

      {logging ? (
        <AttemptDialog
          row={logging}
          onClose={() => setLogging(null)}
          onLogged={() => { setLogging(null); router.refresh(); }}
        />
      ) : null}

      {releasing ? (
        <ReleaseDialog
          row={releasing}
          onClose={() => setReleasing(null)}
          onReleased={() => { drop(releasing.sessionId); setReleasing(null); }}
        />
      ) : null}
    </div>
  );
}

function AttemptDialog({ row, onClose, onLogged }: {
  row: WireRow; onClose: () => void; onLogged: () => void;
}) {
  const { t } = useLocale();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function log(outcome: 'answered' | 'no_answer' | 'on_the_way') {
    setBusy(true);
    setError(null);
    const result = await pickupAttemptAction(row.sessionId, { method: 'call', outcome });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    onLogged();
  }

  return (
    <div className="fixed inset-0 scrim flex items-center justify-center p-6 z-50">
      <div className="card card-poster bg-white w-full max-w-[520px] flex flex-col gap-4">
        <div>
          <div className="eyebrow">{t.counter.howDidCallGo}</div>
          <h2 className="headline" style={{ fontSize: 'var(--font-size-xl)' }}>
            {row.guardianName} · {row.childName}
          </h2>
        </div>

        {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}

        <div className="flex flex-col gap-3">
          <button type="button" className="btn btn-secondary btn-lg btn-block" disabled={busy} onClick={() => log('on_the_way')}>
            {t.counter.onTheWay}
          </button>
          <button type="button" className="btn btn-accent btn-lg btn-block" disabled={busy} onClick={() => log('answered')}>
            {t.counter.answered}
          </button>
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={busy} onClick={() => log('no_answer')}>
            {t.counter.noAnswer}
          </button>
        </div>

        <button type="button" className="btn btn-ghost" onClick={onClose}>{t.common.cancel}</button>
      </div>
    </div>
  );
}
