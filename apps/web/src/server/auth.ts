import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { db, verifyPin } from '@carnival/db';
import { createLogger } from '@carnival/shared';

/**
 * Counter auth: a device token in the environment, plus a PIN the staffer types
 * at the start of a shift. The PIN unlocks; the cookie keeps them unlocked for
 * the shift so nobody types a PIN with a queue watching.
 */

const COOKIE = 'carnival_staff';
const SHIFT_HOURS = 12;
const log = createLogger('auth');

export interface StaffSession {
  staffId: string;
  role: 'staffer' | 'pickup' | 'supervisor' | 'admin';
  zoneId: string | null;
  expiresAt: number;
}

function secret(): string {
  const value = process.env.STAFF_DEVICE_TOKEN;
  if (!value || value === 'change-me') {
    throw new Error('STAFF_DEVICE_TOKEN is unset or still the placeholder. The counter console will not open without it.');
  }
  return value;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

function encode(session: StaffSession): string {
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function decode(token: string): StaffSession | null {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString()) as StaffSession;
    return session.expiresAt > Date.now() ? session : null;
  } catch {
    return null;
  }
}

/**
 * Returns the session, or null. Never throws — the caller decides what to show.
 *
 * The cookie's signature is not enough on its own. A shift lasts twelve hours
 * and `npm run db:seed` is the documented way to rotate PINs, so a staffer can
 * still be holding a valid, correctly-signed cookie for a staff row that has
 * been replaced or deactivated. Without this check the next check-in fails on a
 * foreign key and the staffer sees "that did not go through" with no way out.
 * With it, they see the PIN pad, which is a thing they know how to answer.
 *
 * It costs one primary-key lookup per request, and it means deactivating
 * someone takes effect on their next tap rather than at the end of their shift.
 */
export async function currentStaff(): Promise<StaffSession | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  const session = token ? decode(token) : null;
  if (!session) return null;

  const member = await db.staff.findUnique({
    where: { id: session.staffId },
    select: { id: true, role: true, isActive: true },
  });
  if (!member || !member.isActive) {
    log.warn('staff session no longer valid', { staffId: session.staffId });
    return null;
  }

  // The role is read from the row, not from the cookie, so a demotion applies
  // immediately and a forged payload cannot promote itself.
  return { ...session, role: member.role };
}

export async function requireStaff(): Promise<StaffSession> {
  const session = await currentStaff();
  if (!session) throw new Error('UNAUTHORISED');
  return session;
}

/** True for the roles allowed to see across both zones. */
export function isSupervisor(session: StaffSession | null): boolean {
  return session?.role === 'supervisor' || session?.role === 'admin';
}

/**
 * The overview shows every child in the building at once, so it is gated to
 * supervisors. The role is read from the staff row on each request, not from
 * the cookie, so this cannot be reached by editing a payload.
 */
export async function requireSupervisor(): Promise<StaffSession> {
  const session = await requireStaff();
  if (!isSupervisor(session)) throw new Error('FORBIDDEN');
  return session;
}

/**
 * Checks a PIN against every active staff member on the event. PINs are short
 * and few, so this is a scan by design rather than a lookup by identifier —
 * there is no username at a counter.
 *
 * Desk staffers (`staffer` with a default zone) must select that zone on the
 * PIN pad. Admin, pickup and supervisor may use either chip — they are not
 * tied to one desk.
 */
export type PinSignInResult =
  | { status: 'ok'; session: StaffSession }
  | { status: 'bad_pin' }
  | { status: 'wrong_zone'; homeZoneName: string };

export async function signInWithPin(
  eventId: string,
  pin: string,
  zoneId?: string,
): Promise<PinSignInResult> {
  const candidates = await db.staff.findMany({
    where: { eventId, isActive: true },
    include: { defaultZone: { select: { id: true, name: true } } },
  });

  for (const member of candidates) {
    if (!(await verifyPin(pin, member.pinHash))) continue;

    const deskLocked = member.role === 'staffer' && member.defaultZoneId;
    if (deskLocked && zoneId && zoneId !== member.defaultZoneId) {
      log.warn('pin zone mismatch', {
        staffId: member.id,
        selectedZoneId: zoneId,
        homeZoneId: member.defaultZoneId,
      });
      return {
        status: 'wrong_zone',
        homeZoneName: member.defaultZone?.name ?? 'your zone',
      };
    }

    const session: StaffSession = {
      staffId: member.id,
      role: member.role,
      zoneId: zoneId ?? member.defaultZoneId ?? null,
      expiresAt: Date.now() + SHIFT_HOURS * 3_600_000,
    };
    const jar = await cookies();
    jar.set(COOKIE, encode(session), {
      httpOnly: true, sameSite: 'lax', path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SHIFT_HOURS * 3600,
    });
    log.info('staff signed in', { staffId: member.id, role: member.role, zoneId: session.zoneId });
    return { status: 'ok', session };
  }
  log.warn('pin rejected', { eventId });
  return { status: 'bad_pin' };
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

/**
 * A supervisor override needs a supervisor's PIN, checked at the moment of the
 * override rather than inherited from whoever is signed in.
 */
export async function verifySupervisorPin(eventId: string, pin: string): Promise<string | null> {
  const supervisors = await db.staff.findMany({ where: { eventId, isActive: true } });
  for (const member of supervisors) {
    if ((member.role === 'supervisor' || member.role === 'admin') && await verifyPin(pin, member.pinHash)) {
      return member.id;
    }
  }
  return null;
}
