'use client';

import { useEffect, useRef, useState } from 'react';
import { dubaiTime, formatCountdown, formatForDisplay, formatRegistrationCode, overdueParts } from '@carnival/shared';
import type { Overview as OverviewData } from '@/server/overview';
import { Shape } from '../Brand';
import { useLocale } from '../LocaleProvider';
import { TickingNumber } from '../TickingNumber';
import { panelClass, type WireRow } from './SessionRow';

/** Serialised over the wire, so the Date fields arrive as strings. */
type WireOverview = Omit<OverviewData, 'zones' | 'pickup'> & {
  zones: (Omit<OverviewData['zones'][number], 'rows'> & { rows: WireRow[] })[];
  pickup: WireRow[];
};

/**
 * The supervisor's screen: both zones, the queue, the day's numbers, and the
 * addresses that bounced — all at once, and nothing that can be tapped by
 * accident. Every action lives on the screen that owns it.
 */
export function Overview({ initial }: { initial: WireOverview }) {
  const { t, locale } = useLocale();
  const [data, setData] = useState(initial);
  const [now, setNow] = useState(() => new Date(initial.serverNowIso).getTime());
  const skew = useRef(new Date(initial.serverNowIso).getTime() - Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now() + skew.current), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const response = await fetch('/api/overview', { cache: 'no-store' });
        if (!response.ok) return;
        const next = (await response.json()) as WireOverview;
        skew.current = new Date(next.serverNowIso).getTime() - Date.now();
        setData(next);
      } catch {
        // Keep the last known picture on screen. A supervisor glancing at a
        // stale board is better served than one looking at an error.
      }
    }, 10_000);
    return () => clearInterval(poll);
  }, []);

  const zoneName = (zone: { zoneName: string; zoneNameAr: string | null }) =>
    (locale === 'ar' ? zone.zoneNameAr : null) ?? zone.zoneName;

  const tiles: { label: string; value: number; tone?: 'hot' }[] = [
    { label: t.counter.totalInside, value: data.totals.insideNow },
    { label: t.counter.totalOverdue, value: data.totals.overdueNow, tone: data.totals.overdueNow ? 'hot' : undefined },
    { label: t.counter.totalRegisteredToday, value: data.totals.registrationsToday },
    { label: t.counter.totalChildrenToday, value: data.totals.childrenRegisteredToday },
    { label: t.counter.totalCheckedOut, value: data.totals.checkedOutToday },
  ];

  return (
    <div className="p-6 max-w-[--container-page] mx-auto flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="display" style={{ fontSize: 'var(--font-size-3xl)' }}>{t.counter.overviewTitle}</h1>
        <div className="flex items-center gap-3">
          <span className="state state-active">{t.counter.readOnly}</span>
          <span className="eyebrow">{t.counter.updated}</span>
        </div>
      </div>

      {/* ---------------------------------------------------------- numbers */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="card"
            style={tile.tone === 'hot'
              ? { borderWidth: '2px', background: 'var(--state-overdue-ground)', color: 'var(--state-overdue-ink)', borderColor: 'var(--state-overdue-edge)' }
              : { borderWidth: '2px' }}
          >
            <div className="display-num" style={{ fontSize: 'var(--font-size-3xl)', color: 'inherit' }}>
              {tile.value}
            </div>
            <div className="eyebrow mt-1" style={{ color: 'inherit', opacity: 0.85 }}>{tile.label}</div>
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------ zones */}
      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
        {data.zones.map((zone) => (
          <section key={zone.zoneId} className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="display" style={{ fontSize: 'var(--font-size-2xl)' }}>{zoneName(zone)}</h2>
              <span className="eyebrow">
                {zone.capacity ? t.counter.ofCapacity(zone.inside, zone.capacity) : t.counter.inZone(zone.inside)}
                {zone.overdue > 0 ? ` · ${t.counter.overdueHere(zone.overdue)}` : ''}
              </span>
            </div>

            {zone.rows.length === 0 ? (
              <div className="card"><p className="muted">{t.counter.nobodyInZone}</p></div>
            ) : (
              zone.rows.map((row) => {
                const remaining = new Date(row.endsAt).getTime() - now;
                return (
                  <div key={row.sessionId} className={`card ${panelClass(row)}`} style={{ borderWidth: '2px' }}>
                    <div className="flex items-baseline justify-between gap-4">
                      <div>
                        <div className="headline" style={{ fontSize: 'var(--font-size-lg)', color: 'inherit' }}>
                          {row.childName}
                        </div>
                        <div className="text-2xs mt-1" style={{ opacity: 0.85 }}>
                          {row.guardianName} · <span className="numeric">{formatRegistrationCode(row.registrationCode)}</span>
                        </div>
                      </div>
                      <div className="text-end">
                        <TickingNumber
                          value={formatCountdown(remaining)}
                          className="display-num block"
                          style={{ fontSize: 'var(--font-size-xl)', color: 'inherit' }}
                        />
                        <div className="eyebrow" style={{ color: 'inherit', opacity: 0.8 }}>
                          <span className="numeric">{dubaiTime(new Date(row.endsAt))}</span>
                        </div>
                      </div>
                    </div>
                    {row.medicalNotes ? (
                      <div className="text-2xs mt-2" style={{ opacity: 0.9 }}>
                        <strong>{t.counter.medicalNote}:</strong> {row.medicalNotes}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </section>
        ))}
      </div>

      {/* ------------------------------------------------------ pickup queue */}
      {data.pickup.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="display" style={{ fontSize: 'var(--font-size-2xl)' }}>{t.counter.pickupQueue}</h2>
          {data.pickup.map((row) => (
            <div key={row.sessionId} className={`card ${panelClass(row)}`} style={{ borderWidth: '2px' }}>
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <div>
                  <div className="headline" style={{ fontSize: 'var(--font-size-xl)', color: 'inherit' }}>
                    {row.childName}
                  </div>
                  <div className="text-sm mt-1" style={{ opacity: 0.9 }}>
                    {row.guardianName} · <span className="numeric">{formatForDisplay(row.guardianPhone)}</span>
                  </div>
                </div>
                {(() => {
                  const over = overdueParts(Math.max(0, Math.floor((now - new Date(row.endsAt).getTime()) / 60_000)));
                  return (
                    <div className="text-end">
                      <TickingNumber
                        value={over.value}
                        className="display-num block"
                        style={{ fontSize: 'var(--font-size-2xl)', color: 'inherit' }}
                      />
                      <div className="eyebrow" style={{ color: 'inherit', opacity: 0.85 }}>
                        {over.unit === 'hours' ? t.counter.hoursOver : t.counter.minutesOver}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {/* ----------------------------------------------------- email failures */}
      <section className="flex flex-col gap-3">
        <h2 className="display" style={{ fontSize: 'var(--font-size-2xl)' }}>{t.counter.emailProblems}</h2>
        {data.emailFailures.length === 0 ? (
          <div className="card relative overflow-hidden">
            <Shape name="clover" size={140} className="absolute -end-8 -bottom-10 text-indigo" style={{ opacity: 0.1 }} />
            <p className="muted relative">{t.counter.emailProblemsNone}</p>
          </div>
        ) : (
          <>
            <p className="text-sm muted">{t.counter.emailProblemsBody}</p>
            {data.emailFailures.map((failure) => (
              <div key={failure.guardianId} className="card notice-danger" style={{ borderWidth: '2px' }}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <strong>{failure.guardianName}</strong>{' '}
                    <span className="numeric">{formatRegistrationCode(failure.code)}</span>
                    <div className="latin text-2xs mt-1" style={{ overflowWrap: 'anywhere' }}>{failure.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {failure.liveChildren > 0 ? (
                      <span className="state state-overdue">{t.counter.liveChildren(failure.liveChildren)}</span>
                    ) : null}
                    <span className="state state-warned">{failure.status}</span>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </section>
    </div>
  );
}
