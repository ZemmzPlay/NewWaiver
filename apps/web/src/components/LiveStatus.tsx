'use client';

import { useEffect, useRef, useState } from 'react';
import { STATUS_POLL_MS, dubaiTime, formatCountdown } from '@carnival/shared';
import type { StatusPayload } from '@/server/status';
import { Shape } from './Brand';
import { TickingNumber } from './TickingNumber';
import { useLocale } from './LocaleProvider';

/**
 * The parent-facing safety net. A countdown per child, polled every 15 seconds,
 * ticking every second in between so the page never looks frozen.
 *
 * The countdown is computed from an absolute end instant and the server's own
 * clock, because a phone in a hall may be minutes out and a wrong countdown is
 * worse than none.
 */
export function LiveStatus({ initial }: { initial: StatusPayload }) {
  const { t } = useLocale();
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => new Date(initial.serverNowIso).getTime());
  const skew = useRef(new Date(initial.serverNowIso).getTime() - Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + skew.current), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const response = await fetch(`/api/status/${data.code}`, { cache: 'no-store' });
        if (!response.ok) return;
        const next = (await response.json()) as StatusPayload;
        if (cancelled) return;
        skew.current = new Date(next.serverNowIso).getTime() - Date.now();
        setData(next);
      } catch {
        // A dropped poll is not worth showing. The next one is 15 seconds away
        // and the countdown keeps running from the last known end time.
      }
    };
    const timer = setInterval(poll, STATUS_POLL_MS);
    return () => { cancelled = true; clearInterval(timer); };
  }, [data.code]);

  return (
    <div className="flex flex-col gap-4">
      {data.children.map((child) => {
        const remaining = child.endsAtIso ? new Date(child.endsAtIso).getTime() - now : null;
        const panel =
          child.status === 'not_started' || child.status === 'checked_out' ? 'panel-checked_out'
          : child.status === 'overdue' ? 'panel-overdue'
          : child.status === 'expired' ? 'panel-expired'
          : remaining !== null && remaining <= 5 * 60_000 ? 'panel-warned'
          : 'panel-active';

        return (
          <div
            key={child.childCode}
            className={`card ${panel} relative overflow-hidden`}
            style={{ borderWidth: '2px' }}
          >
            <Shape name="clover" size={120} className="absolute -end-6 -bottom-8" style={{ opacity: 0.12 }} />
            <div className="relative flex items-baseline justify-between gap-4">
              <div className="headline" style={{ fontSize: 'var(--font-size-xl)', color: 'inherit' }}>
                {child.firstName}
              </div>
              <div className="eyebrow" style={{ color: 'inherit', opacity: 0.85 }}>
                {child.zoneName ?? t.status.notStarted}
              </div>
            </div>

            {child.status === 'not_started' ? (
              <p className="relative mt-2 text-sm">{t.status.clockStarts}</p>
            ) : child.status === 'checked_out' ? (
              <p className="relative mt-2 text-sm">{t.status.collected}</p>
            ) : (
              <>
                <TickingNumber
                  value={remaining !== null ? formatCountdown(remaining) : '—'}
                  className="relative display-num mt-2 block"
                  style={{ fontSize: 'var(--font-size-4xl)', color: 'inherit' }}
                />
                <div className="relative text-sm mt-1">
                  {remaining !== null && remaining > 0 ? (
                    <>{t.status.finishesAt} <strong className="numeric">{dubaiTime(new Date(child.endsAtIso!))}</strong></>
                  ) : (
                    t.status.timeWasUp(dubaiTime(new Date(child.endsAtIso!)), child.zoneName ?? '')
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
