'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import {
  checkoutInput, createLogger, pickupAttemptInput, staffLoginInput, startSessionsInput,
} from '@carnival/shared';
import { currentStaff, requireStaff, signInWithPin, signOut, verifySupervisorPin } from '@/server/auth';
import { currentEvent } from '@/server/event';
import { isLockedOut, recordFailure, recordSuccess } from '@/lib/rate-limit';
import { checkOut, logPickupAttempt, startSessions, type StartedSession } from '@/server/sessions';

async function clientKey(prefix: string): Promise<string> {
  const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  return `${prefix}:${ip}`;
}

const log = createLogger('action:counter');

/** Errors reach staff as a plain sentence and a retry, never a stack trace. */
const MESSAGES: Record<string, string> = {
  UNAUTHORISED: 'Your shift session has ended. Enter your PIN again.',
  REGISTRATION_NOT_FOUND: 'That family is no longer on file. Search again.',
  CHILD_NOT_IN_REGISTRATION: 'That child is not on this registration. Search again.',
  UNKNOWN_PACKAGE: 'That zone or length is no longer available. Pick another.',
  WRONG_ZONE: 'That child is registered for a different zone. Check them in at the right counter.',
  ZONE_REQUIRED: 'Choose a zone on the PIN pad before checking anyone in.',
  CHILD_ALREADY_INSIDE: 'That child already has a session running. Check them out first.',
  RECHECK_NOT_ALLOWED: 'That child already finished a session. Register again for another visit.',
  OVERRIDE_REQUIRED: 'Releasing to someone else needs a supervisor PIN.',
  BAD_SUPERVISOR_PIN: 'That is not a supervisor PIN.',
  SESSION_NOT_FOUND: 'That session is no longer on file. Refresh the board.',
};

/**
 * The staffer gets a sentence; the log gets enough to act on.
 *
 * The first cut logged nothing but "counter action failed", which on the day
 * means a staffer saying "it didn't go through" and a supervisor with no way to
 * find out why. Hard rule 2 still applies, so the detail is scrubbed of
 * anything quoted — Postgres puts column *values* in its error messages, and a
 * unique-violation on a phone number would otherwise print the number.
 */
function scrubDetail(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown';
  const detail = error.message
    .replace(/\((?:[^()]*)\)=\([^()]*\)/g, '(…)=(…)')
    .replace(/"[^"]*"/g, (match) => (/^"[a-z_][a-z0-9_]*"$/.test(match) ? match : '"…"'))
    .replace(/'[^']*'/g, "'…'");
  return `${error.name}: ${detail}`.slice(0, 240);
}

function plain(error: unknown): string {
  const key = error instanceof Error ? error.message : '';
  if (MESSAGES[key]) return MESSAGES[key]!;
  log.error('counter action failed', { detail: scrubDetail(error) });
  return 'That did not go through. Try again, and tell a supervisor if it keeps happening.';
}

export type ActionResult<T = undefined> =
  | ({ ok: true } & (T extends undefined ? { data?: undefined } : { data: T }))
  | { ok: false; message: string; error?: 'wrong_zone'; homeZoneName?: string };

export async function signInAction(pin: string, zoneId?: string): Promise<ActionResult> {
  const parsed = staffLoginInput.safeParse({ pin, zoneId });
  if (!parsed.success) return { ok: false, message: 'A PIN is four to eight digits.' };

  const key = await clientKey('pin');
  if (isLockedOut(key)) return { ok: false, message: 'Too many wrong PINs. Wait a minute and try again.' };

  const event = await currentEvent();
  const result = await signInWithPin(event.id, parsed.data.pin, parsed.data.zoneId);
  if (result.status === 'wrong_zone') {
    // Wrong chip, not a wrong PIN — do not burn lockout attempts.
    return {
      ok: false,
      message: `Select ${result.homeZoneName} first, then enter your PIN.`,
      error: 'wrong_zone',
      homeZoneName: result.homeZoneName,
    };
  }
  if (result.status !== 'ok') {
    recordFailure(key);
    return { ok: false, message: 'That PIN was not recognised.' };
  }
  recordSuccess(key);
  return { ok: true } as ActionResult;
}

export async function signOutAction(): Promise<void> {
  await signOut();
}

export async function startCheckInAction(input: unknown): Promise<ActionResult<StartedSession[]>> {
  try {
    const staff = await requireStaff();
    const parsed = startSessionsInput.parse(input);
    const started = await startSessions(parsed, staff.staffId, staff.zoneId);
    revalidatePath('/counter', 'layout');
    return { ok: true, data: started };
  } catch (error) {
    return { ok: false, message: plain(error) };
  }
}

export async function checkOutAction(sessionId: string, input: unknown): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const parsed = checkoutInput.parse(input);

    let supervisorStaffId: string | undefined;
    if (parsed.verifyMethod === 'supervisor_override') {
      const key = await clientKey('supervisor-pin');
      if (isLockedOut(key)) throw new Error('BAD_SUPERVISOR_PIN');
      const event = await currentEvent();
      const found = await verifySupervisorPin(event.id, parsed.supervisorPin!);
      if (!found) { recordFailure(key); throw new Error('BAD_SUPERVISOR_PIN'); }
      recordSuccess(key);
      supervisorStaffId = found;
    }

    await checkOut({
      sessionId,
      verifyMethod: parsed.verifyMethod,
      releasedTo: parsed.releasedTo || undefined,
      supervisorStaffId,
    }, staff.staffId);

    revalidatePath('/counter', 'layout');
    return { ok: true } as ActionResult;
  } catch (error) {
    return { ok: false, message: plain(error) };
  }
}

export async function pickupAttemptAction(sessionId: string, input: unknown): Promise<ActionResult> {
  try {
    const staff = await requireStaff();
    const parsed = pickupAttemptInput.parse(input);
    await logPickupAttempt({
      sessionId, method: parsed.method, outcome: parsed.outcome, note: parsed.note || undefined,
    }, staff.staffId);
    revalidatePath('/counter/pickup');
    return { ok: true } as ActionResult;
  } catch (error) {
    return { ok: false, message: plain(error) };
  }
}

export async function whoAmI() {
  return currentStaff();
}
