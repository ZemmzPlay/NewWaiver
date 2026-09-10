import 'server-only';
import { db, hashPin, verifyPin } from '@carnival/db';
import { createLogger } from '@carnival/shared';

const log = createLogger('staff-admin');

export type StaffRoleValue = 'staffer' | 'pickup' | 'supervisor' | 'admin';

export interface StaffRow {
  id: string;
  fullName: string;
  role: StaffRoleValue;
  zoneId: string | null;
  zoneName: string | null;
  isActive: boolean;
  createdAt: Date;
}

export async function listStaff(eventId: string): Promise<StaffRow[]> {
  const rows = await db.staff.findMany({
    where: { eventId },
    orderBy: [{ isActive: 'desc' }, { fullName: 'asc' }],
    select: {
      id: true, fullName: true, role: true, isActive: true, createdAt: true,
      defaultZone: { select: { id: true, name: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName,
    role: row.role,
    isActive: row.isActive,
    createdAt: row.createdAt,
    zoneId: row.defaultZone?.id ?? null,
    zoneName: row.defaultZone?.name ?? null,
  }));
}

/**
 * Sign-in scans every *active* staff row for a PIN match and stops at the
 * first hit (see `signInWithPin`), so two active accounts sharing a PIN means
 * one of them silently can never sign in — not an error either of them would
 * see coming. A deactivated account's old PIN is never scanned, so it's free
 * to reuse.
 */
async function pinTaken(eventId: string, pin: string, excludeStaffId?: string): Promise<boolean> {
  const candidates = await db.staff.findMany({
    where: { eventId, isActive: true, ...(excludeStaffId ? { id: { not: excludeStaffId } } : {}) },
    select: { pinHash: true },
  });
  for (const candidate of candidates) {
    if (await verifyPin(pin, candidate.pinHash)) return true;
  }
  return false;
}

export async function createStaffAccount(input: {
  eventId: string;
  fullName: string;
  pin: string;
  role: StaffRoleValue;
  zoneId?: string | null;
}, actorStaffId: string): Promise<StaffRow> {
  if (await pinTaken(input.eventId, input.pin)) throw new Error('PIN_TAKEN');

  const staff = await db.staff.create({
    data: {
      eventId: input.eventId,
      fullName: input.fullName,
      role: input.role,
      pinHash: await hashPin(input.pin),
      defaultZoneId: input.zoneId || null,
      isActive: true,
    },
    include: { defaultZone: { select: { id: true, name: true } } },
  });

  await db.auditLog.create({
    data: {
      eventId: input.eventId, actorType: 'staff', actorId: actorStaffId,
      action: 'staff.created', entity: 'staff', entityId: staff.id,
      meta: { role: input.role, zoneId: input.zoneId ?? null },
    },
  });
  log.info('staff account created', { staffId: staff.id, role: input.role, actorStaffId });

  return {
    id: staff.id, fullName: staff.fullName, role: staff.role, isActive: staff.isActive,
    createdAt: staff.createdAt, zoneId: staff.defaultZone?.id ?? null, zoneName: staff.defaultZone?.name ?? null,
  };
}

export async function resetStaffPin(staffId: string, pin: string, actorStaffId: string): Promise<void> {
  const staff = await db.staff.findUnique({ where: { id: staffId }, select: { eventId: true } });
  if (!staff) throw new Error('STAFF_NOT_FOUND');
  if (await pinTaken(staff.eventId, pin, staffId)) throw new Error('PIN_TAKEN');

  await db.staff.update({ where: { id: staffId }, data: { pinHash: await hashPin(pin) } });
  await db.auditLog.create({
    data: {
      eventId: staff.eventId, actorType: 'staff', actorId: actorStaffId,
      action: 'staff.pin_reset', entity: 'staff', entityId: staffId, meta: {},
    },
  });
  log.info('staff pin reset', { staffId, actorStaffId });
}

/**
 * A leaver needs a way off the roster that isn't "edit seed.ts and hope
 * nobody re-seeds a shift they're mid-way through" — `isActive: false` is
 * already how the rest of the app (sign-in, PIN checks) treats "gone", this
 * just gives it a button. Reactivating is the same toggle in reverse.
 */
export async function setStaffActive(staffId: string, isActive: boolean, actorStaffId: string): Promise<void> {
  const staff = await db.staff.findUnique({ where: { id: staffId }, select: { eventId: true } });
  if (!staff) throw new Error('STAFF_NOT_FOUND');

  await db.staff.update({ where: { id: staffId }, data: { isActive } });
  await db.auditLog.create({
    data: {
      eventId: staff.eventId, actorType: 'staff', actorId: actorStaffId,
      action: isActive ? 'staff.reactivated' : 'staff.deactivated', entity: 'staff', entityId: staffId, meta: {},
    },
  });
  log.info('staff active toggled', { staffId, isActive, actorStaffId });
}
