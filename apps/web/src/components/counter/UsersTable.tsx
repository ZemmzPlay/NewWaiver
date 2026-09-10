'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  dubaiDateTime,
  formatForDisplay,
  formatRegistrationCode,
} from '@carnival/shared';
import type { RegisteredUserChild, RegisteredUserRow } from '@/server/users';
import { useLocale } from '../LocaleProvider';

type WireUser = Omit<RegisteredUserRow, 'registeredAt'> & { registeredAt: string };

/**
 * Admin roster of every registration. Filter is local — the list is for the
 * desk, glanceable, and does not need a live poll.
 */
export function UsersTable({ initial }: { initial: WireUser[] }) {
  const { t } = useLocale();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initial;
    const digits = q.replace(/\D/g, '');
    return initial.filter((row) => {
      const hay = [
        row.guardian.fullName,
        row.guardian.email,
        row.guardian.phoneE164,
        row.code,
        ...row.children.map((c) => c.fullName),
        ...row.children.map((c) => c.childCode),
      ].join(' ').toLowerCase();
      if (hay.includes(q)) return true;
      if (digits.length >= 3 && row.guardian.phoneE164.replace(/\D/g, '').includes(digits)) return true;
      return false;
    });
  }, [initial, query]);

  return (
    <div className="p-6 max-w-[--container-page] mx-auto flex flex-col gap-5">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="display" style={{ fontSize: 'var(--font-size-3xl)' }}>{t.counter.usersTitle}</h1>
          <p className="mt-2 text-sm muted">{t.counter.usersHelp}</p>
        </div>
        <span className="eyebrow">{t.counter.usersCount(filtered.length, initial.length)}</span>
      </div>

      <div className="field max-w-[420px]">
        <label className="ui-label" htmlFor="users-q">{t.counter.usersFilter}</label>
        <input
          id="users-q"
          className="field-control"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t.counter.usersFilterPlaceholder}
          autoComplete="off"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <p className="muted">{initial.length === 0 ? t.counter.usersEmpty : t.counter.usersNoMatch}</p>
        </div>
      ) : (
        <div className="card overflow-x-auto" style={{ padding: 0 }}>
          <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: '960px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border-subtle)', background: 'var(--surface-muted)' }}>
                <Th>{t.common.code}</Th>
                <Th>{t.counter.usersGuardian}</Th>
                <Th>{t.common.mobile}</Th>
                <Th>{t.common.email}</Th>
                <Th>{t.counter.relation}</Th>
                <Th>{t.counter.usersChildren}</Th>
                <Th>{t.counter.usersInside}</Th>
                <Th>{t.counter.usersWaiver}</Th>
                <Th>{t.counter.usersRegisteredAt}</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.registrationId} style={{ borderBottom: '1px solid var(--border-subtle)', verticalAlign: 'top' }}>
                  <Td>
                    <strong className="numeric">{formatRegistrationCode(row.code)}</strong>
                    {row.registrationStatus === 'void' ? (
                      <div className="mt-1"><span className="state state-cancelled">{t.counter.usersVoid}</span></div>
                    ) : null}
                  </Td>
                  <Td>
                    <div className="font-semibold" style={{ color: 'var(--carnival-indigo)' }}>{row.guardian.fullName}</div>
                    <div className="text-2xs muted mt-1 uppercase">{row.guardian.locale}</div>
                  </Td>
                  <Td>
                    <span className="numeric">{formatForDisplay(row.guardian.phoneE164)}</span>
                  </Td>
                  <Td>
                    <span className="latin" style={{ overflowWrap: 'anywhere' }}>{row.guardian.email}</span>
                    {row.guardian.emailStatus === 'bounced' || row.guardian.emailStatus === 'complained' ? (
                      <div className="mt-1">
                        <span className="state state-overdue">{t.counter.emailStatus(row.guardian.emailStatus)}</span>
                      </div>
                    ) : null}
                  </Td>
                  <Td>
                    {t.guardianStep.relations[row.guardian.relation as keyof typeof t.guardianStep.relations]
                      ?? row.guardian.relation}
                    {row.guardian.relationOther ? (
                      <div className="text-2xs muted mt-1">{row.guardian.relationOther}</div>
                    ) : null}
                  </Td>
                  <Td>
                    <ChildrenCell children={row.children} />
                  </Td>
                  <Td>
                    <span className="numeric">{row.liveInside}</span>
                    <span className="muted"> / {row.children.length}</span>
                  </Td>
                  <Td>
                    {row.waiverVersion != null ? (
                      <span className="state state-active">{t.counter.waiverSigned(row.waiverVersion)}</span>
                    ) : (
                      <span className="state state-overdue">{t.counter.noWaiver}</span>
                    )}
                  </Td>
                  <Td>
                    <span className="numeric">{dubaiDateTime(new Date(row.registeredAt))}</span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChildrenCell({ children }: { children: RegisteredUserChild[] }) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);

  if (children.length === 0) return <span className="muted">—</span>;

  if (children.length === 1) {
    return <ChildDetail child={children[0]!} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="btn btn-secondary btn-sm self-start"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        {t.counter.usersChildrenToggle(children.length)}
      </button>
      {open ? (
        <ul className="flex flex-col gap-3">
          {children.map((child) => (
            <li key={child.id}>
              <ChildDetail child={child} />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function ChildDetail({ child }: { child: RegisteredUserChild }) {
  const { t } = useLocale();
  const first = child.fullName.split(' ')[0]!;

  return (
    <div>
      <span className="font-semibold">{child.fullName}</span>
      <span className="muted"> · {t.counter.age(child.ageYears)}</span>
      <div className="text-2xs numeric muted">{child.childCode}</div>
      {child.medicalNotes ? (
        <div className="text-2xs mt-1" style={{ color: 'var(--text-danger)' }}>
          {child.medicalNotes}
        </div>
      ) : null}
      <div className="mt-1">
        {child.presence === 'inside' && child.zoneName ? (
          <span className="state state-active">{t.counter.childIn(first, child.zoneName)}</span>
        ) : child.presence === 'completed' ? (
          <span className="state state-expired">{t.counter.childCompleted(first)}</span>
        ) : child.presence === 'released' ? (
          <span className="state state-checked_out">{t.counter.childReleased(first)}</span>
        ) : (
          <span className="state state-warned">{t.counter.childNotIn(first)}</span>
        )}
      </div>
    </div>
  );
}

function Th({ children }: { children: ReactNode }) {
  return (
    <th
      className="eyebrow text-start"
      style={{ padding: 'var(--space-3) var(--space-4)', whiteSpace: 'nowrap' }}
    >
      {children}
    </th>
  );
}

function Td({ children }: { children: ReactNode }) {
  return (
    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
      {children}
    </td>
  );
}
