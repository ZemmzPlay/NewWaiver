import 'server-only';
import { db } from '@carnival/db';
import { LIVE_SESSION_STATUSES, firstName, type Locale } from '@carnival/shared';

/**
 * The public live status page. No auth, safe to leave open on a phone, and it
 * shows first names only — this URL is one screenshot away from being public.
 *
 * PRD s6 calls this the closest thing to push that ships by Friday.
 */

export interface StatusChild {
  firstName: string;
  childCode: string;
  zoneName: string | null;
  status: 'not_started' | 'active' | 'warned' | 'expired' | 'overdue' | 'checked_out';
  /** Absolute instant, so the browser can count down without trusting its clock. */
  endsAtIso: string | null;
  minutes: number | null;
  supervisionMode: 'accompanied' | 'drop_off' | null;
}

export interface StatusPayload {
  code: string;
  guardianFirstName: string;
  serverNowIso: string;
  children: StatusChild[];
}

export async function statusForCode(code: string, locale: Locale = 'en'): Promise<StatusPayload | null> {
  const row = await db.registration.findUnique({
    where: { code },
    select: { id: true, code: true, guardian: { select: { fullName: true } } },
  });
  if (!row) return null;

  const kids = await db.child.findMany({
    where: { registrationId: row.id },
    orderBy: { seq: 'asc' },
  });

  const childIds = kids.map((kid) => kid.id);
  const live = childIds.length
    ? await db.session.findMany({
        where: {
          childId: { in: childIds },
          status: { in: [...LIVE_SESSION_STATUSES, 'checked_out'] },
        },
        select: {
          childId: true, status: true, endsAt: true, minutes: true, startedAt: true,
          zone: { select: { name: true, nameAr: true, supervisionMode: true } },
        },
        orderBy: { startedAt: 'desc' },
      })
    : [];

  return {
    code: row.code,
    guardianFirstName: firstName(row.guardian.fullName),
    serverNowIso: new Date().toISOString(),
    children: kids.map((kid) => {
      const session = live.find((s) => s.childId === kid.id);
      if (!session) {
        return {
          firstName: firstName(kid.fullName), childCode: kid.childCode,
          zoneName: null, status: 'not_started' as const,
          endsAtIso: null, minutes: null, supervisionMode: null,
        };
      }
      return {
        firstName: firstName(kid.fullName),
        childCode: kid.childCode,
        zoneName: (locale === 'ar' ? session.zone.nameAr : null) ?? session.zone.name,
        status: session.status as StatusChild['status'],
        endsAtIso: session.endsAt.toISOString(),
        minutes: session.minutes,
        supervisionMode: session.zone.supervisionMode,
      };
    }),
  };
}
