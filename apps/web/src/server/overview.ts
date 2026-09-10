import 'server-only';
import { Prisma, db } from '@carnival/db';
import { LIVE_SESSION_STATUSES, OVERDUE_GRACE_MINUTES, PICKUP_ESCALATE_ATTEMPTS, PICKUP_ESCALATE_MINUTES, minutesSince } from '@carnival/shared';
import { currentEvent } from './event.js';
import type { BoardRow } from './sessions.js';

/**
 * The supervisor's view of the whole operation.
 *
 * Every other staff screen is pinned to one zone, which is right for a counter
 * with a queue in front of it — PRD s4 asks for exactly that, and one decision
 * per screen. It does mean nobody could see both zones at once, and the person
 * who most needs to is the supervisor walking between two counters twenty
 * metres apart.
 *
 * Deliberately read-only. It is the one screen likely to be left open on a
 * laptop nobody is standing at, so there is nothing on it that can be leaned on.
 */

const liveStatuses = [...LIVE_SESSION_STATUSES];

export interface ZoneSummary {
  zoneId: string;
  zoneName: string;
  zoneNameAr: string | null;
  supervisionMode: 'accompanied' | 'drop_off';
  capacity: number | null;
  inside: number;
  overdue: number;
  rows: BoardRow[];
}

export interface OverviewTotals {
  registrationsToday: number;
  childrenRegisteredToday: number;
  insideNow: number;
  overdueNow: number;
  checkedOutToday: number;
}

export interface EmailFailure {
  guardianId: string;
  guardianName: string;
  email: string;
  status: 'bounced' | 'complained';
  code: string;
  liveChildren: number;
}

export interface Overview {
  eventName: string;
  serverNowIso: string;
  zones: ZoneSummary[];
  pickup: BoardRow[];
  totals: OverviewTotals;
  emailFailures: EmailFailure[];
}

/** Rows for one zone, or every zone when `zoneId` is omitted. */
async function boardRows(eventId: string, statuses: string[]): Promise<BoardRow[]> {
  const rows = await db.session.findMany({
    where: {
      status: { in: statuses as never[] },
      child: { registration: { eventId } },
    },
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

export async function overview(): Promise<Overview> {
  const event = await currentEvent();

  const zoneRows = await db.zone.findMany({
    where: { eventId: event.id, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  const live = await boardRows(event.id, liveStatuses);

  // "Today" is the local day at the venue, not the last 24 hours — a supervisor
  // at 09:00 on day two wants day two's numbers, not half of day one's. This
  // stays raw SQL: there's no query-builder form of a timezone-bucketed
  // "today" in Prisma.
  const [totalsRow] = await db.$queryRaw<{
    registrations_today: number;
    children_today: number;
    checked_out_today: number;
  }[]>(Prisma.sql`
    select
      (select count(*)::int from registrations r
        where r.event_id = ${event.id}::uuid
          and r.created_at >= date_trunc('day', now() at time zone ${event.timezone}) at time zone ${event.timezone}
      ) as registrations_today,
      (select count(*)::int from children c
        join registrations r on r.id = c.registration_id
        where r.event_id = ${event.id}::uuid
          and c.created_at >= date_trunc('day', now() at time zone ${event.timezone}) at time zone ${event.timezone}
      ) as children_today,
      (select count(*)::int from sessions s
        join children c on c.id = s.child_id
        join registrations r on r.id = c.registration_id
        where r.event_id = ${event.id}::uuid
          and s.status = 'checked_out'
          and s.checked_out_at >= date_trunc('day', now() at time zone ${event.timezone}) at time zone ${event.timezone}
      ) as checked_out_today
  `);

  // A bounced address is the failure the counter can actually fix, so it is
  // surfaced with the family's code rather than as a number.
  const failureGuardians = await db.guardian.findMany({
    where: { eventId: event.id, emailStatus: { in: ['bounced', 'complained'] } },
    orderBy: { fullName: 'asc' },
    select: {
      id: true, fullName: true, email: true, emailStatus: true,
      registrations: {
        select: {
          code: true,
          _count: {
            select: {
              children: { where: { sessions: { some: { status: { in: liveStatuses as never[] } } } } },
            },
          },
        },
      },
    },
  });
  const failureRows = failureGuardians.flatMap((g) =>
    g.registrations.map((r) => ({
      guardianId: g.id,
      guardianName: g.fullName,
      email: g.email,
      status: g.emailStatus as 'bounced' | 'complained',
      code: r.code,
      liveChildren: r._count.children,
    })),
  );

  return {
    eventName: event.name,
    serverNowIso: new Date().toISOString(),
    zones: zoneRows.map((zone) => {
      const rows = live.filter((row) => row.zoneId === zone.id);
      return {
        zoneId: zone.id,
        zoneName: zone.name,
        zoneNameAr: zone.nameAr,
        supervisionMode: zone.supervisionMode,
        capacity: zone.capacity,
        inside: rows.length,
        overdue: rows.filter((row) => row.status === 'overdue').length,
        rows,
      };
    }),
    pickup: live.filter((row) => row.status === 'overdue'),
    totals: {
      registrationsToday: totalsRow?.registrations_today ?? 0,
      childrenRegisteredToday: totalsRow?.children_today ?? 0,
      insideNow: live.length,
      overdueNow: live.filter((row) => row.status === 'overdue').length,
      checkedOutToday: totalsRow?.checked_out_today ?? 0,
    },
    emailFailures: failureRows,
  };
}
