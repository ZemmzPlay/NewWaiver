import 'server-only';
import { Prisma, cancelPendingForSession, db, scheduleSessionNotifications } from '@carnival/db';
import {
  LIVE_SESSION_STATUSES, OVERDUE_GRACE_MINUTES, PICKUP_ESCALATE_ATTEMPTS,
  PICKUP_ESCALATE_MINUTES, createLogger, minutesSince, sessionSchedule,
} from '@carnival/shared';
import type { startSessionsInput } from '@carnival/shared';
import type { z } from 'zod';
import { currentEvent } from './event.js';

const log = createLogger('sessions');

export type StartSessionsInput = z.infer<typeof startSessionsInput>;

export interface StartedSession {
  sessionId: string;
  childId: string;
  childCode: string;
  childName: string;
  zoneName: string;
  minutes: number;
  startedAt: Date;
  endsAt: Date;
  alreadyExisted: boolean;
}

/**
 * Prisma's `meta.target` on a P2002 is the *column name(s)* the violated
 * unique constraint covers — never the constraint's own name, and that's true
 * whether or not the constraint is declared in schema.prisma (confirmed
 * empirically: a violation of `sessions_one_live_per_child`, which exists
 * only as hand-written migration SQL, still comes back as `["child_id"]`,
 * not the index name). So the two constraints on `sessions` are told apart
 * by column, not by name.
 */
function isUniqueViolationOn(error: unknown, column: string): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') return false;
  const target = error.meta?.target;
  return Array.isArray(target) ? target.includes(column) : String(target ?? '').includes(column);
}

/**
 * Check-in. Hard rule 5: every write carries a client-generated UUID and is
 * safe to replay, so a staffer who taps twice, or a queued write that lands
 * late, produces one session rather than two.
 */
export async function startSessions(
  input: StartSessionsInput,
  staffId: string,
  staffZoneId: string | null,
): Promise<StartedSession[]> {
  const event = await currentEvent();
  const started: StartedSession[] = [];

  if (!staffZoneId) throw new Error('ZONE_REQUIRED');

  const registration = await db.registration.findUnique({
    where: { id: input.registrationId },
    select: { id: true, code: true, guardian: { select: { id: true, email: true } } },
  });
  if (!registration) throw new Error('REGISTRATION_NOT_FOUND');

  for (const entry of input.entries) {
    const pkg = await db.package.findUnique({
      where: { id: entry.packageId },
      select: { id: true, minutes: true, zone: { select: { id: true, name: true, supervisionMode: true } } },
    });
    if (!pkg) throw new Error('UNKNOWN_PACKAGE');
    if (pkg.zone.id !== staffZoneId) throw new Error('WRONG_ZONE');

    const child = await db.child.findUnique({ where: { id: entry.childId } });
    if (!child || child.registrationId !== registration.id) throw new Error('CHILD_NOT_IN_REGISTRATION');

    // One visit per child record. After release (checked_out), they must
    // register again — never start a second clock on the same child.
    const alreadyFinished = await db.session.findFirst({
      where: { childId: child.id, status: 'checked_out' },
      select: { id: true },
    });
    if (alreadyFinished) throw new Error('RECHECK_NOT_ALLOWED');

    const now = new Date();
    const schedule = sessionSchedule(now, pkg.minutes);

    // The replay guard and the one-live-session rule are both database
    // constraints, so the insert is allowed to lose either race. Prisma has no
    // onConflictDoNothing, so the two constraints are told apart by column on
    // the P2002 they raise.
    let session;
    let replay = false;
    try {
      session = await db.session.create({
        data: {
          childId: child.id,
          zoneId: pkg.zone.id,
          packageId: pkg.id,
          minutes: pkg.minutes,
          startedByStaffId: staffId,
          startedAt: schedule.startedAt,
          endsAt: schedule.endsAt,
          warnAt: schedule.warnAt,
          status: 'active',
          stubRef: entry.stubRef || null,
          clientUuid: entry.clientUuid,
        },
      });
    } catch (error) {
      if (isUniqueViolationOn(error, 'client_uuid')) {
        // A replay. Return what the first attempt created so the console can
        // reprint the sticker without starting a second clock.
        const existing = await db.session.findUnique({ where: { clientUuid: entry.clientUuid } });
        if (!existing) throw new Error('CHILD_ALREADY_INSIDE');
        session = existing;
        replay = true;
      } else if (isUniqueViolationOn(error, 'child_id')) {
        throw new Error('CHILD_ALREADY_INSIDE');
      } else {
        throw error;
      }
    }

    if (replay) {
      started.push({
        sessionId: session.id, childId: child.id, childCode: child.childCode,
        childName: child.fullName, zoneName: pkg.zone.name, minutes: session.minutes,
        startedAt: session.startedAt, endsAt: session.endsAt, alreadyExisted: true,
      });
      continue;
    }

    // The session row itself is already committed (its constraints are what
    // make replay/one-live-session safe to lose the race on above), but the
    // notifications + audit log that follow it are not — a crash between
    // them left a live session with no warning or pickup email ever
    // scheduled, and nothing would have noticed. Transactional from here on.
    await db.$transaction(async (tx) => {
      await scheduleSessionNotifications({
        sessionId: session.id,
        registrationId: registration.id,
        toAddress: registration.guardian.email,
        warnAt: session.warnAt,
        endsAt: session.endsAt,
        supervisionMode: pkg.zone.supervisionMode,
      }, tx);

      await tx.auditLog.create({
        data: {
          eventId: event.id, actorType: 'staff', actorId: staffId,
          action: 'session.start', entity: 'session', entityId: session.id,
          meta: { zoneId: pkg.zone.id, minutes: pkg.minutes, stubRef: entry.stubRef || null },
        },
      });
    });

    log.info('session started', {
      sessionId: session.id, childId: child.id, zoneId: pkg.zone.id,
      minutes: pkg.minutes, staffId,
    });

    started.push({
      sessionId: session.id, childId: child.id, childCode: child.childCode,
      childName: child.fullName, zoneName: pkg.zone.name, minutes: session.minutes,
      startedAt: session.startedAt, endsAt: session.endsAt, alreadyExisted: false,
    });
  }

  return started;
}

/* ------------------------------------------------------------------ board */

export interface BoardRow {
  sessionId: string;
  childId: string;
  childName: string;
  childCode: string;
  ageYears: number;
  medicalNotes: string | null;
  zoneId: string;
  zoneName: string;
  supervisionMode: 'accompanied' | 'drop_off';
  guardianName: string;
  guardianPhone: string;
  registrationCode: string;
  status: 'active' | 'warned' | 'expired' | 'overdue' | 'checked_out' | 'cancelled';
  minutes: number;
  startedAt: Date;
  endsAt: Date;
  attemptCount: number;
  escalated: boolean;
}

const liveStatuses = [...LIVE_SESSION_STATUSES];

async function boardQuery(where: Prisma.SessionWhereInput): Promise<BoardRow[]> {
  const rows = await db.session.findMany({
    where,
    select: {
      id: true,
      status: true,
      minutes: true,
      startedAt: true,
      endsAt: true,
      child: {
        select: {
          id: true, fullName: true, childCode: true, ageYears: true, medicalNotes: true,
          registration: { select: { code: true, guardian: { select: { fullName: true, phoneE164: true } } } },
        },
      },
      zone: { select: { id: true, name: true, supervisionMode: true } },
      _count: { select: { pickupAttempts: true } },
    },
    orderBy: { endsAt: 'asc' },
  });

  return rows.map((row) => {
    const attemptCount = row._count.pickupAttempts;
    return {
      sessionId: row.id,
      childId: row.child.id,
      childName: row.child.fullName,
      childCode: row.child.childCode,
      ageYears: row.child.ageYears,
      medicalNotes: row.child.medicalNotes,
      zoneId: row.zone.id,
      zoneName: row.zone.name,
      supervisionMode: row.zone.supervisionMode,
      guardianName: row.child.registration.guardian.fullName,
      guardianPhone: row.child.registration.guardian.phoneE164,
      registrationCode: row.child.registration.code,
      status: row.status,
      minutes: row.minutes,
      startedAt: row.startedAt,
      endsAt: row.endsAt,
      attemptCount,
      escalated:
        row.status === 'overdue' &&
        (attemptCount >= PICKUP_ESCALATE_ATTEMPTS ||
          minutesSince(row.endsAt) >= OVERDUE_GRACE_MINUTES + PICKUP_ESCALATE_MINUTES),
    };
  });
}

export function zoneBoard(zoneId: string) {
  return boardQuery({ zoneId, status: { in: liveStatuses } });
}

/**
 * The Pickup queue. PRD s5: "This queue is the reason to build the system, not
 * a side feature." Everyone overdue, across both zones, longest wait first.
 */
export async function pickupQueue(): Promise<BoardRow[]> {
  const rows = await boardQuery({ status: 'overdue' });
  return rows.sort((a, b) => a.endsAt.getTime() - b.endsAt.getTime());
}

export function sessionsForRegistration(registrationId: string) {
  return boardQuery({
    child: { registrationId },
    status: { in: liveStatuses },
  });
}

/* -------------------------------------------------------------- check-out */

export interface CheckoutInput {
  sessionId: string;
  verifyMethod: 'code' | 'qr' | 'name_match' | 'supervisor_override';
  releasedTo?: string;
  supervisorStaffId?: string;
}

export async function checkOut(input: CheckoutInput, staffId: string) {
  const event = await currentEvent();
  const row = await db.session.findUnique({
    where: { id: input.sessionId },
    select: { id: true, status: true, zoneId: true, zone: { select: { supervisionMode: true } } },
  });
  if (!row) throw new Error('SESSION_NOT_FOUND');
  if (row.status === 'checked_out') return { alreadyCheckedOut: true };

  // Hard rule from the PRD, the waiver and the staff script: no child leaves a
  // zone without their adult. In a drop-off zone that means the returning adult
  // is verified; releasing to anyone else is a supervisor decision.
  if (row.zone.supervisionMode === 'drop_off' && input.verifyMethod === 'name_match' && input.releasedTo) {
    throw new Error('OVERRIDE_REQUIRED');
  }
  if (input.releasedTo && input.verifyMethod !== 'supervisor_override') throw new Error('OVERRIDE_REQUIRED');
  if (input.verifyMethod === 'supervisor_override' && !input.supervisorStaffId) throw new Error('OVERRIDE_REQUIRED');

  // Transactional so a crash between marking the session out and cancelling
  // its pending notifications can't leave a "come pick up your child" email
  // scheduled for a child who has already left.
  await db.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: input.sessionId },
      data: {
        status: 'checked_out',
        checkedOutAt: new Date(),
        checkedOutByStaffId: staffId,
        releasedTo: input.releasedTo || null,
        verifyMethod: input.verifyMethod,
      },
    });

    await cancelPendingForSession(input.sessionId, tx);

    await tx.auditLog.create({
      data: {
        eventId: event.id, actorType: 'staff', actorId: staffId,
        action: input.verifyMethod === 'supervisor_override' ? 'session.checkout_override' : 'session.checkout',
        entity: 'session', entityId: input.sessionId,
        meta: {
          verifyMethod: input.verifyMethod,
          supervisorStaffId: input.supervisorStaffId ?? null,
          releasedToSomeoneElse: Boolean(input.releasedTo),
        },
      },
    });
  });

  log.info('session checked out', {
    sessionId: input.sessionId, staffId, verifyMethod: input.verifyMethod,
  });
  return { alreadyCheckedOut: false };
}

/* --------------------------------------------------------- pickup attempts */

export async function logPickupAttempt(input: {
  sessionId: string;
  method: 'call' | 'whatsapp';
  outcome: 'answered' | 'no_answer' | 'on_the_way';
  note?: string;
}, staffId: string) {
  await db.pickupAttempt.create({
    data: {
      sessionId: input.sessionId, staffId, method: input.method,
      outcome: input.outcome, note: input.note || null,
    },
  });
  log.info('pickup attempt logged', {
    sessionId: input.sessionId, staffId, method: input.method, outcome: input.outcome,
  });
}

export function attemptsForSession(sessionId: string) {
  return db.pickupAttempt.findMany({
    where: { sessionId },
    orderBy: { attemptedAt: 'desc' },
  });
}
