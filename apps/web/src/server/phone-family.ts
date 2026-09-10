import 'server-only';
import { db } from '@carnival/db';
import { LIVE_SESSION_STATUSES, toE164 } from '@carnival/shared';
import { currentEvent } from './event.js';

const liveStatuses = [...LIVE_SESSION_STATUSES];

/**
 * Privacy-safe phone check for the register form.
 *
 * Returns only whether this mobile already has an *open* family on the current
 * event — never names, codes, zones, or session detail. Same merge key as
 * registration: exact E.164 on the guardian row.
 *
 * "Open" means at least one child who has not finished a visit yet (never
 * started, or currently inside / time finished awaiting pickup). When every
 * child on the number is already released, the family-found modal stays closed
 * so they can register again and add new children without a confusing prompt.
 */
export async function phoneHasActiveFamily(phoneInput: string): Promise<boolean> {
  const e164 = toE164(phoneInput);
  if (!e164) return false;

  const event = await currentEvent();
  const guardian = await db.guardian.findUnique({
    where: { eventId_phoneE164: { eventId: event.id, phoneE164: e164 } },
    select: { id: true },
  });
  if (!guardian) return false;

  const registration = await db.registration.findFirst({
    where: { guardianId: guardian.id, status: 'active' },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  });
  if (!registration) return false;

  const children = await db.child.findMany({
    where: { registrationId: registration.id },
    select: {
      id: true,
      sessions: {
        where: { status: { in: [...liveStatuses, 'checked_out'] } },
        select: { status: true },
      },
    },
  });
  if (children.length === 0) return false;

  return children.some((child) => {
    const hasLive = child.sessions.some((s) => (liveStatuses as readonly string[]).includes(s.status));
    if (hasLive) return true;
    const released = child.sessions.some((s) => s.status === 'checked_out');
    return !released;
  });
}
