'use client';

import { useState } from 'react';
import { createStaffAction, listStaffAction, resetPinAction, setStaffActiveAction } from '@/app/actions/admin';
import type { StaffRow } from '@/server/staff.js';
import { useLocale } from '../LocaleProvider';

/** Serialised over the wire, so the Date arrives as a string. */
type WireStaff = Omit<StaffRow, 'createdAt'> & { createdAt: string };

const ROLES = ['staffer', 'pickup', 'supervisor', 'admin'] as const;

export function StaffAdmin({ initial, zones }: { initial: WireStaff[]; zones: { id: string; name: string }[] }) {
  const { t } = useLocale();
  const [roster, setRoster] = useState(initial);

  function roleLabel(role: WireStaff['role']): string {
    return {
      staffer: t.counter.roleStaffer, pickup: t.counter.rolePickup,
      supervisor: t.counter.roleSupervisor, admin: t.counter.roleAdmin,
    }[role];
  }

  async function refresh() {
    // A plain page refresh would also work, but this keeps focus/scroll
    // position stable on a screen someone might be mid-edit on.
    const result = await listStaffAction();
    // Server Actions serialise their return value the same way JSON.stringify
    // would — result.data's `createdAt` is typed as Date but arrives as the
    // string it actually is on the wire, same as `initial` from the page.
    if (result.ok) setRoster(result.data as unknown as WireStaff[]);
  }

  return (
    <div className="p-6 max-w-[--container-page] mx-auto flex flex-col gap-6">
      <h1 className="display" style={{ fontSize: 'var(--font-size-3xl)' }}>{t.counter.staffAdminTitle}</h1>

      <CreateStaffForm zones={zones} onCreated={refresh} />

      <div className="flex flex-col gap-3">
        {roster.length === 0 ? (
          <div className="card"><p className="muted">{t.counter.noStaffYet}</p></div>
        ) : null}
        {roster.map((member) => (
          <StaffRowCard key={member.id} member={member} roleLabel={roleLabel(member.role)} onChanged={refresh} />
        ))}
      </div>
    </div>
  );
}

function CreateStaffForm({ zones, onCreated }: { zones: { id: string; name: string }[]; onCreated: () => void }) {
  const { t } = useLocale();
  const [fullName, setFullName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<(typeof ROLES)[number]>('staffer');
  const [zoneId, setZoneId] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSuccess(null);
    const result = await createStaffAction({ fullName, pin, role, zoneId });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    setSuccess(t.counter.accountCreated(result.data.fullName));
    setFullName('');
    setPin('');
    setRole('staffer');
    setZoneId('');
    onCreated();
  }

  return (
    <form className="card card-block flex flex-col gap-4" onSubmit={submit}>
      <h2 className="headline" style={{ fontSize: 'var(--font-size-lg)' }}>{t.counter.addStaff}</h2>

      {error ? <div className="notice notice-danger" role="alert">{error}</div> : null}
      {success ? <div className="notice notice-warn" role="status">{success}</div> : null}

      <div className="field">
        <label className="ui-label" htmlFor="staff-name">{t.counter.fullNameField}</label>
        <input
          id="staff-name" className="field-control" value={fullName}
          onChange={(event) => setFullName(event.target.value)} required minLength={2} maxLength={120}
        />
      </div>

      <div className="field">
        <label className="ui-label" htmlFor="staff-pin">{t.counter.pinField}</label>
        <input
          id="staff-pin" className="field-control numeric" inputMode="numeric" type="password"
          value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
          required pattern="\d{4,8}"
        />
        <span className="field-hint">{t.counter.pinHint}</span>
      </div>

      <div className="field">
        <label className="ui-label" htmlFor="staff-role">{t.counter.roleField}</label>
        <select id="staff-role" className="field-control" value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
          {ROLES.map((value) => (
            <option key={value} value={value}>
              {{ staffer: t.counter.roleStaffer, pickup: t.counter.rolePickup, supervisor: t.counter.roleSupervisor, admin: t.counter.roleAdmin }[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="ui-label" htmlFor="staff-zone">{t.counter.zoneField}</label>
        <select id="staff-zone" className="field-control" value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
          <option value="">{t.counter.noZone}</option>
          {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.name}</option>)}
        </select>
      </div>

      <button type="submit" className="btn btn-primary btn-lg" disabled={busy}>
        {busy ? t.counter.creatingAccount : t.counter.createAccount}
      </button>
    </form>
  );
}

function StaffRowCard({ member, roleLabel, onChanged }: {
  member: WireStaff; roleLabel: string; onChanged: () => void;
}) {
  const { t } = useLocale();
  const [resetting, setResetting] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submitReset(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await resetPinAction({ staffId: member.id, pin: newPin });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    setMessage(t.counter.pinResetDone);
    setNewPin('');
    setResetting(false);
  }

  async function toggleActive() {
    setBusy(true);
    setError(null);
    const result = await setStaffActiveAction({ staffId: member.id, isActive: !member.isActive });
    setBusy(false);
    if (!result.ok) { setError(result.message); return; }
    onChanged();
  }

  return (
    <div className={`card ${member.isActive ? '' : 'opacity-60'}`} style={{ opacity: member.isActive ? 1 : 0.6 }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="headline" style={{ fontSize: 'var(--font-size-md)' }}>{member.fullName}</div>
          <div className="text-sm muted">
            {roleLabel}{member.zoneName ? ` · ${member.zoneName}` : ''} ·{' '}
            <span className={member.isActive ? 'state' : 'state state-overdue'}>
              {member.isActive ? t.counter.activeLabel : t.counter.inactiveLabel}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setResetting((v) => !v)}>
            {t.counter.resetPin}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={toggleActive}>
            {member.isActive ? t.counter.deactivate : t.counter.reactivate}
          </button>
        </div>
      </div>

      {error ? <div className="notice notice-danger mt-3" role="alert">{error}</div> : null}
      {message ? <div className="notice notice-warn mt-3" role="status">{message}</div> : null}

      {resetting ? (
        <form className="flex flex-wrap items-end gap-3 mt-3" onSubmit={submitReset}>
          <div className="field" style={{ maxWidth: '200px' }}>
            <label className="ui-label" htmlFor={`reset-${member.id}`}>{t.counter.newPinField}</label>
            <input
              id={`reset-${member.id}`} className="field-control numeric" inputMode="numeric" type="password"
              value={newPin} onChange={(event) => setNewPin(event.target.value.replace(/\D/g, '').slice(0, 8))}
              required pattern="\d{4,8}"
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{t.counter.confirmResetPin}</button>
        </form>
      ) : null}
    </div>
  );
}
