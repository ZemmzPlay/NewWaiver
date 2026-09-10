import 'server-only';
import { db } from '@carnival/db';
import { LIVE_SESSION_STATUSES } from '@carnival/shared';
import { currentEvent } from './event.js';

const liveStatuses = [...LIVE_SESSION_STATUSES];
const rosterSessionStatuses = [...LIVE_SESSION_STATUSES, 'checked_out'] as const;
const stillPlaying = new Set(['active', 'warned']);
const timeFinished = new Set(['expired', 'overdue']);

export type ChildPresence = 'inside' | 'completed' | 'released' | 'not_in';

export interface RegisteredUserChild {
  id: string;
  fullName: string;
  ageYears: number;
  childCode: string;
  medicalNotes: string | null;
  /**
   * inside = playing (active/warned);
   * completed = allotted time finished (expired/overdue), still awaiting pickup;
   * released = staff checked them out;
   * not_in = no live or completed session on file.
   */
  presence: ChildPresence;
  /** Zone for the current or last session, when known. */
  zoneName: string | null;
  sessionStatus: string | null;
}

export interface RegisteredUserRow {
  registrationId: string;
  code: string;
  registrationStatus: 'active' | 'void';
  registeredAt: Date;
  guardian: {
    id: string;
    fullName: string;
    relation: string;
    relationOther: string | null;
    phoneE164: string;
    email: string;
    emailStatus: 'unknown' | 'delivered' | 'bounced' | 'complained';
    locale: string;
  };
  waiverVersion: number | null;
  children: RegisteredUserChild[];
  liveInside: number;
}

function presenceFor(status: string | null): ChildPresence {
  if (!status) return 'not_in';
  if (stillPlaying.has(status)) return 'inside';
  if (timeFinished.has(status)) return 'completed';
  if (status === 'checked_out') return 'released';
  return 'not_in';
}

/**
 * Every registration for the current event, newest first. Supervisors/admins
 * only — this is the full PII roster for the desk, not a public surface.
 *
 * Staff release → `checked_out` → shown as released.
 * Timer finished → `expired` / `overdue` → shown as completed.
 */
export async function listRegisteredUsers(): Promise<RegisteredUserRow[]> {
  const event = await currentEvent();

  const rows = await db.registration.findMany({
    where: { eventId: event.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      code: true,
      status: true,
      createdAt: true,
      guardian: {
        select: {
          id: true,
          fullName: true,
          relation: true,
          relationOther: true,
          phoneE164: true,
          email: true,
          emailStatus: true,
          locale: true,
        },
      },
      children: {
        orderBy: { seq: 'asc' },
        select: {
          id: true,
          fullName: true,
          ageYears: true,
          childCode: true,
          medicalNotes: true,
          sessions: {
            where: { status: { in: [...rosterSessionStatuses] } },
            orderBy: { startedAt: 'desc' },
            select: {
              status: true,
              zone: { select: { name: true } },
            },
          },
        },
      },
      consents: {
        orderBy: { acceptedAt: 'desc' },
        take: 1,
        select: { waiverVersion: { select: { version: true } } },
      },
    },
  });

  return rows.map((row) => {
    const children: RegisteredUserChild[] = row.children.map((child) => {
      const live = child.sessions.find((s) => (liveStatuses as readonly string[]).includes(s.status));
      const released = child.sessions.find((s) => s.status === 'checked_out');
      const shown = live ?? released ?? null;
      const presence = presenceFor(shown?.status ?? null);

      return {
        id: child.id,
        fullName: child.fullName,
        ageYears: child.ageYears,
        childCode: child.childCode,
        medicalNotes: child.medicalNotes,
        presence,
        zoneName: shown?.zone.name ?? null,
        sessionStatus: shown?.status ?? null,
      };
    });

    return {
      registrationId: row.id,
      code: row.code,
      registrationStatus: row.status,
      registeredAt: row.createdAt,
      guardian: {
        id: row.guardian.id,
        fullName: row.guardian.fullName,
        relation: row.guardian.relation,
        relationOther: row.guardian.relationOther,
        phoneE164: row.guardian.phoneE164,
        email: row.guardian.email,
        emailStatus: row.guardian.emailStatus,
        locale: row.guardian.locale,
      },
      waiverVersion: row.consents[0]?.waiverVersion.version ?? null,
      children,
      liveInside: children.filter((c) => c.presence === 'inside' || c.presence === 'completed').length,
    };
  });
}
