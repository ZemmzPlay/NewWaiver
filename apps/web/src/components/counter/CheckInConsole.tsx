'use client';

import { useEffect, useRef, useState } from 'react';
import { dubaiTime, formatForDisplay, formatRegistrationCode, stickerName } from '@carnival/shared';
import { startCheckInAction } from '@/app/actions/counter';
import { openPrintWindow, printStickers } from '@/lib/print';
import type { FamilyCard, SearchHit } from '@/server/search';
import { Shape } from '../Brand';
import { useLocale } from '../LocaleProvider';

interface ZoneOption {
  id: string;
  name: string;
  supervisionMode: 'accompanied' | 'drop_off';
  packages: { id: string; minutes: number }[];
}

/**
 * The core staff loop: search, read the greeting aloud, pick the children,
 * confirm the length, start and print.
 *
 * One decision per screen. The staffer is standing in front of a parent with a
 * queue behind them, in a loud hall, on day three.
 */
export function CheckInConsole({ zone, zones }: { zone: ZoneOption; zones: ZoneOption[] }) {
  const { t } = useLocale();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [family, setFamily] = useState<FamilyCard | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [requestedZones, setRequestedZones] = useState<Record<string, string | null>>({});
  const [stubRef, setStubRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ names: string[]; endsAt: string; via: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setHits([]); setError(null); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { cache: 'no-store' });
        if (!response.ok) throw new Error('search failed');
        const data = (await response.json()) as { results: SearchHit[] };
        setHits(data.results);
        setError(null);
      } catch {
        // A stale result set from the previous query left on screen reads as
        // "the system found the wrong family" rather than "the search
        // failed" — clearing it is what makes the failure visible.
        setHits([]);
        setError(t.errors.generic);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  async function openFamily(code: string) {
    setError(null);
    const response = await fetch(`/api/registrations/${code}`, { cache: 'no-store' });
    if (!response.ok) { setError(t.errors.generic); return; }
    const card = (await response.json()) as FamilyCard;

    const requestedZone: Record<string, string | null> = {};
    const defaults: Record<string, string> = {};
    const otherZoneNames = new Set<string>();
    let eligibleCount = 0;
    let liveInThisZone = 0;
    let spentOnThisDesk = 0;

    for (const child of card.children) {
      const owner = zones.find((z) => z.packages.some((p) => p.id === child.requestedPackageId));
      requestedZone[child.id] = owner?.name ?? null;
      if (owner && owner.id !== zone.id) otherZoneNames.add(owner.name);

      if (child.liveSession) {
        if (child.liveSession.zoneName === zone.name) liveInThisZone += 1;
        continue;
      }
      if (owner?.id !== zone.id) continue;
      // Finished a visit already — cannot start again on this child record.
      if (child.lastReleased) {
        spentOnThisDesk += 1;
        continue;
      }
      eligibleCount += 1;
      const requested = owner.packages.find((p) => p.id === child.requestedPackageId);
      const match = zone.packages.find((p) => p.minutes === requested?.minutes) ?? zone.packages[0];
      if (match) defaults[child.id] = match.id;
    }

    // Nobody left to check in at this desk.
    if (eligibleCount === 0 && liveInThisZone === 0) {
      // Finished family: open the card with released status visible — do not
      // vanish back to search with only a flash of error text.
      if (spentOnThisDesk > 0) {
        setFamily(card);
        setHits([]);
        setQuery('');
        setRequestedZones(requestedZone);
        setSelected({});
        return;
      }
      setFamily(null);
      setHits([]);
      setQuery('');
      setRequestedZones({});
      setSelected({});
      const named = [...otherZoneNames];
      setError(
        named.length
          ? t.counter.wrongZone(named.join(' / '), zone.name)
          : t.counter.wrongZoneUnknown(zone.name),
      );
      return;
    }

    setFamily(card);
    setHits([]);
    setQuery('');
    setRequestedZones(requestedZone);
    setSelected(defaults);
  }

  function childBelongsToDesk(requestedPackageId: string | null): boolean {
    if (!requestedPackageId) return false;
    return zone.packages.some((p) => p.id === requestedPackageId);
  }

  function reset() {
    setFamily(null); setSelected({}); setRequestedZones({}); setStubRef(''); setError(null); setDone(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  async function start() {
    if (!family) return;
    const entries = Object.entries(selected)
      .filter(([childId, packageId]) => {
        if (!packageId || !zone.packages.some((p) => p.id === packageId)) return false;
        const child = family.children.find((c) => c.id === childId);
        return Boolean(child && !child.liveSession && !child.lastReleased);
      })
      .map(([childId, packageId]) => ({
        childId, packageId, stubRef, clientUuid: crypto.randomUUID(),
      }));
    if (!entries.length) return;

    setBusy(true);
    setError(null);
    // Opened now, synchronously, while this is still the tap that triggered
    // it — a browser only allows window.open() without asking inside that
    // window. Do it after the request below comes back and every browser
    // blocks it silently, with nothing on screen to explain why no sticker
    // appeared.
    const popup = openPrintWindow();
    const result = await startCheckInAction({ registrationId: family.registrationId, entries });
    if (!result.ok) { setBusy(false); setError(result.message); popup?.close(); return; }

    const started = result.data;
    const outcome = await printStickers(
      started.map((session) => ({
        childName: stickerName(session.childName),
        childCode: session.childCode,
        zone: session.zoneName,
        timeIn: dubaiTime(new Date(session.startedAt)),
        timeOut: dubaiTime(new Date(session.endsAt)),
        copies: 1,
      })),
      started.map((session) => session.sessionId),
      popup,
    );

    setBusy(false);
    setDone({
      names: started.map((session) => session.childName.split(' ')[0]!),
      endsAt: dubaiTime(new Date(started[0]!.endsAt)),
      via: outcome.via,
    });
  }

  /* ---------------------------------------------------------- closing card */

  if (done) {
    return (
      <div className="p-6 max-w-[--container-page] mx-auto">
        <div className="card card-block relative overflow-hidden">
          <Shape name="star" size={200} className="absolute -right-10 -top-10 text-yellow" style={{ opacity: 0.3 }} />
          <div className="relative">
            <div className="eyebrow">{t.counter.sayThis}</div>
            <p className="display mt-2" style={{ fontSize: 'var(--font-size-3xl)' }}>
              {t.counter.backAt} {done.endsAt}
            </p>
            <p className="lede mt-3">
              {/* This is read aloud, so the names are joined with the
                  language's own conjunction — it was rendering as
                  "Yousef + Layla", which is not a thing anybody says. */}
              {t.counter.script(t.common.joinNames(done.names), done.endsAt)}
            </p>
            <p className="mt-3 text-sm">
              {zone.supervisionMode === 'drop_off' ? t.counter.scriptDropOff : t.counter.scriptAccompanied}
            </p>

            {done.via === 'browser' ? (
              <div className="notice notice-warn mt-4">{t.counter.printedBrowser}</div>
            ) : null}
            {done.via === 'failed' ? (
              <div className="notice notice-danger mt-4">{t.counter.printedFailed(done.endsAt)}</div>
            ) : null}

            <button type="button" className="btn btn-primary btn-lg mt-6" onClick={reset}>{t.counter.nextFamily}</button>
          </div>
        </div>
      </div>
    );
  }

  /* ------------------------------------------------------------ family card */

  if (family) {
    const available = family.children.filter((child) => !child.liveSession);
    const chosen = Object.entries(selected).filter(([, id]) => Boolean(id));
    const hasSpent = available.some((child) => child.lastReleased);

    return (
      <div className="p-6 max-w-[--container-page] mx-auto flex flex-col gap-5">
        <button type="button" className="btn btn-ghost btn-sm self-start" onClick={reset}>{t.counter.searchAgain}</button>

        <div className="card card-poster">
          <p className="display" style={{ fontSize: 'var(--font-size-3xl)' }}>
            {family.childFirstNames.length
              ? t.counter.greeting(family.guardianFirstName, t.common.joinNames(family.childFirstNames))
              : t.counter.greetingNoChildren(family.guardianFirstName)}
          </p>
          <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 text-sm">
            <span><span className="eyebrow">{t.common.code}</span> <strong className="numeric">{formatRegistrationCode(family.code)}</strong></span>
            <span><span className="eyebrow">{t.common.mobile}</span> <strong className="numeric">{formatForDisplay(family.guardian.phoneE164)}</strong></span>
            <span>
              <span className="eyebrow">{t.common.email}</span>{' '}
              <strong className="latin" style={{ overflowWrap: 'anywhere' }}>{family.guardian.email}</strong>
            </span>
            <span><span className="eyebrow">{t.counter.relation}</span> <strong>{t.guardianStep.relations[family.guardian.relation as keyof typeof t.guardianStep.relations] ?? family.guardian.relation}</strong></span>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {family.children.map((child) => {
              const name = child.fullName.split(' ')[0]!;
              if (child.liveSession) {
                const finished = child.liveSession.status === 'expired' || child.liveSession.status === 'overdue';
                return (
                  <span key={child.id} className={`state ${finished ? 'state-expired' : 'state-active'}`}>
                    {finished
                      ? t.counter.childCompleted(name)
                      : t.counter.childIn(name, child.liveSession.zoneName)}
                  </span>
                );
              }
              if (child.lastReleased) {
                return (
                  <span key={child.id} className="state state-checked_out">
                    {t.counter.childReleased(name)}
                  </span>
                );
              }
              return (
                <span key={child.id} className="state state-warned">
                  {t.counter.childNotIn(name)}
                </span>
              );
            })}
            {!family.waiverAccepted ? (
              <span className="state state-overdue">{t.counter.noWaiver}</span>
            ) : null}
          </div>

          {!family.waiverAccepted ? (
            <div className="notice notice-danger mt-4">{t.counter.noConsent}</div>
          ) : null}

          {family.guardian.emailStatus === 'bounced' || family.guardian.emailStatus === 'complained' ? (
            <div className="notice notice-danger mt-4">
              <strong>{t.counter.emailFailedTitle}</strong> {t.counter.emailFailedBody}{' '}
              <span className="latin">{family.guardian.email}</span>
            </div>
          ) : null}
        </div>

        {family.children.some((child) => child.liveSession) ? (
          <div className="notice notice-info">
            {family.children.filter((c) => c.liveSession).map((c) => (
              <div key={c.id}>
                {t.counter.alreadyInside(
                  c.fullName.split(' ')[0]!,
                  c.liveSession!.zoneName,
                  dubaiTime(new Date(c.liveSession!.endsAt)),
                )}
              </div>
            ))}
          </div>
        ) : null}

        {hasSpent ? (
          <div className="notice notice-warn">{t.counter.recheckBlocked}</div>
        ) : null}

        <div>
          <div className="eyebrow mb-3">{t.counter.whoIsGoingIn}</div>
          <div className="flex flex-col gap-3">
            {available.map((child) => {
              const belongsHere = childBelongsToDesk(child.requestedPackageId);
              const spent = Boolean(child.lastReleased);
              const canSelect = belongsHere && !spent;
              const active = Boolean(selected[child.id]);
              const otherZone = requestedZones[child.id];
              return (
                <div
                  key={child.id}
                  className={`card ${canSelect ? '' : 'opacity-70'}`}
                  style={{
                    borderWidth: '2px',
                    borderColor: active ? 'var(--carnival-indigo)' : undefined,
                  }}
                >
                  <label className={`flex flex-wrap items-center gap-4 ${canSelect ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                    <input
                      type="checkbox"
                      checked={active}
                      disabled={!canSelect}
                      onChange={(event) => {
                        if (!canSelect) return;
                        setSelected((prev) => {
                          const next = { ...prev };
                          if (event.target.checked) next[child.id] = zone.packages[0]?.id ?? '';
                          else delete next[child.id];
                          return next;
                        });
                      }}
                      style={{ width: 'var(--space-6)', height: 'var(--space-6)', accentColor: 'var(--carnival-indigo)' }}
                    />
                    <span className="headline" style={{ fontSize: 'var(--font-size-xl)' }}>{child.fullName}</span>
                    <span className="state state-active">{t.counter.age(child.ageYears)}</span>
                    {spent ? (
                      <span className="state state-checked_out">{t.counter.releasedNeedsRegistration}</span>
                    ) : null}
                    {!belongsHere && otherZone ? (
                      <span className="state state-warned">{t.counter.wrongZoneChild(otherZone)}</span>
                    ) : null}
                    {belongsHere && !spent && otherZone && otherZone !== zone.name ? (
                      <span className="state state-warned">{t.counter.picked(otherZone)}</span>
                    ) : null}
                  </label>

                  {child.medicalNotes ? (
                    <div className="notice notice-danger mt-3">
                      <span className="eyebrow" style={{ color: 'inherit' }}>{t.counter.medicalNote}</span>
                      <div className="mt-1">{child.medicalNotes}</div>
                    </div>
                  ) : null}

                  {active && canSelect ? (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {zone.packages.map((pkg) => (
                        <button
                          key={pkg.id}
                          type="button"
                          className="chip"
                          aria-pressed={selected[child.id] === pkg.id}
                          onClick={() => setSelected((prev) => ({ ...prev, [child.id]: pkg.id }))}
                        >
                          {pkg.minutes} {t.common.min}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>

        <div className="field max-w-[320px]">
          <label className="ui-label" htmlFor="stub">{t.counter.stubRef}</label>
          <input
            id="stub"
            className="field-control"
            value={stubRef}
            onChange={(event) => setStubRef(event.target.value)}
            placeholder={t.counter.stubPlaceholder}
          />
        </div>

        {error ? (
          <div className="notice notice-danger" role="alert">
            {error}
            <button type="button" className="btn btn-secondary btn-sm ms-3" onClick={start}>{t.common.tryAgain}</button>
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn-primary btn-lg"
          disabled={busy || chosen.length === 0 || !family.waiverAccepted}
          onClick={start}
        >
          {busy ? t.counter.starting : t.counter.start(chosen.length)}
        </button>
        <p className="text-2xs muted">{t.childrenStep.supervision[zone.supervisionMode]}</p>
      </div>
    );
  }

  /* ---------------------------------------------------------------- search */

  return (
    <div className="p-6 max-w-[--container-page] mx-auto flex flex-col gap-5">
      <div className="field">
        <label className="ui-label" htmlFor="q">{t.counter.findFamily}</label>
        <input
          id="q"
          ref={inputRef}
          className="field-control"
          style={{ fontSize: 'var(--font-size-xl)', minHeight: 'var(--counter-row-height)' }}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.counter.findPlaceholder}
          autoComplete="off"
        />
        <span className="field-hint">{t.counter.findHint}</span>
      </div>

      {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}

      {searching && hits.length === 0 ? <p className="muted text-sm">{t.counter.searching}</p> : null}

      <div className="flex flex-col gap-2">
        {hits.map((hit) => (
          <button
            key={hit.registrationId}
            type="button"
            className="card card-lift text-left"
            onClick={() => openFamily(hit.code)}
          >
            <div className="flex items-baseline justify-between gap-4">
              <span className="headline" style={{ fontSize: 'var(--font-size-lg)' }}>{hit.guardianName}</span>
              <span className="numeric eyebrow">{formatRegistrationCode(hit.code)}</span>
            </div>
            <div className="text-sm muted mt-1">
              {hit.childNames.join(', ')} · <span className="numeric">{formatForDisplay(hit.guardianPhone)}</span>
            </div>
            {hit.liveSessions > 0 ? (
              <span className="state state-warned mt-2">{t.counter.insideNow(hit.liveSessions)}</span>
            ) : hit.releasedChildren > 0 && hit.releasedChildren === hit.childNames.length ? (
              <span className="state state-checked_out mt-2">{t.counter.releasedNeedsRegistration}</span>
            ) : hit.releasedChildren > 0 ? (
              <span className="state state-checked_out mt-2">
                {t.counter.searchReleased(hit.releasedChildren)}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {query.trim().length >= 2 && !searching && hits.length === 0 ? (
        <div className="notice notice-warn">{t.counter.noMatch}</div>
      ) : null}
    </div>
  );
}
