import 'server-only';
import { db, hashPin, sendLoginCode, verifyPin } from '@carnival/db';
import { createLogger, phoneTail, toE164, type Locale } from '@carnival/shared';
import { currentEvent } from './event.js';

/**
 * "Open my page again."
 *
 * A guardian who lost the link types the mobile number they registered with.
 * The number alone proves nothing — it is written on a sticker, said out loud
 * at a counter, and visible on any staff screen — so it only decides *where* a
 * six-digit code is sent. Possession of that mailbox is what actually opens the
 * page.
 *
 * What comes back is the registration code, and the page it opens is public
 * anyway, so there is no session to issue and nothing to keep. The whole flow
 * exists to recover one number the guardian already owns.
 */

const log = createLogger('guardian-login');

const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** Challenges one guardian may request inside the TTL window. */
const MAX_OUTSTANDING = 3;

function mintOtp(): string {
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  let otp = '';
  for (const byte of bytes) otp += String(byte % 10);
  return otp;
}

/** `f****a@gmail.com` — enough to recognise, not enough to learn. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  if (local.length <= 2) return `${local[0] ?? ''}***@${domain}`;
  return `${local[0]}${'*'.repeat(Math.max(3, local.length - 2))}${local.at(-1)}@${domain}`;
}

export type RequestResult =
  | { ok: true; emailHint: string }
  | { ok: false; reason: 'not_found' | 'too_many' | 'send_failed' };

export async function requestLoginCode(phoneInput: string, locale: Locale, ip?: string): Promise<RequestResult> {
  const event = await currentEvent();
  const e164 = toE164(phoneInput);
  if (!e164) return { ok: false, reason: 'not_found' };

  const tail = phoneTail(e164);
  const guardian = await db.guardian.findFirst({
    where: { eventId: event.id, phoneTail: tail },
    orderBy: { createdAt: 'desc' },
  });

  // Deliberately explicit rather than a silent success. This is a three-day
  // event with a staffed counter twenty metres away: telling someone their
  // number is not on file sends them to a human, where a vague "check your
  // email" would leave them refreshing an empty inbox while a queue builds.
  if (!guardian) {
    log.info('login code requested for unknown number', { eventId: event.id });
    return { ok: false, reason: 'not_found' };
  }

  const count = await db.loginChallenge.count({
    where: { guardianId: guardian.id, consumedAt: null, expiresAt: { gt: new Date() } },
  });
  if (count >= MAX_OUTSTANDING) {
    log.warn('login code rate limited', { guardianId: guardian.id });
    return { ok: false, reason: 'too_many' };
  }

  const registration = await db.registration.findFirst({
    where: { guardianId: guardian.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  if (!registration) return { ok: false, reason: 'not_found' };

  const otp = mintOtp();
  await db.loginChallenge.create({
    data: {
      guardianId: guardian.id,
      codeHash: await hashPin(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MINUTES * 60_000),
      requestedIp: ip ?? null,
    },
  });

  const sent = await sendLoginCode({
    registrationId: registration.id,
    toAddress: guardian.email,
    otp,
    // Their own language, not whichever one the browser happens to be in.
    locale: (guardian.locale === 'ar' ? 'ar' : 'en') as Locale,
  });

  log.info('login code issued', { guardianId: guardian.id, sent });
  if (!sent) return { ok: false, reason: 'send_failed' };
  return { ok: true, emailHint: maskEmail(guardian.email) };
}

export type VerifyResult =
  | { ok: true; code: string }
  | { ok: false; reason: 'bad_code' | 'too_many' | 'not_found' };

export async function verifyLoginCode(phoneInput: string, otp: string): Promise<VerifyResult> {
  const event = await currentEvent();
  const e164 = toE164(phoneInput);
  if (!e164) return { ok: false, reason: 'not_found' };

  const guardian = await db.guardian.findFirst({
    where: { eventId: event.id, phoneTail: phoneTail(e164) },
  });
  if (!guardian) return { ok: false, reason: 'not_found' };

  const challenge = await db.loginChallenge.findFirst({
    where: { guardianId: guardian.id, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!challenge) return { ok: false, reason: 'bad_code' };

  if (challenge.attempts >= MAX_ATTEMPTS) {
    log.warn('login attempts exhausted', { guardianId: guardian.id, challengeId: challenge.id });
    return { ok: false, reason: 'too_many' };
  }

  // Count the attempt before comparing, so a crash between the two costs the
  // attacker a try rather than giving them a free one.
  await db.loginChallenge.update({
    where: { id: challenge.id },
    data: { attempts: { increment: 1 } },
  });

  if (!await verifyPin(otp.replace(/\D/g, ''), challenge.codeHash)) {
    log.info('login code rejected', { guardianId: guardian.id });
    return { ok: false, reason: 'bad_code' };
  }

  await db.loginChallenge.update({
    where: { id: challenge.id },
    data: { consumedAt: new Date() },
  });

  const registration = await db.registration.findFirst({
    where: { guardianId: guardian.id, status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  if (!registration) return { ok: false, reason: 'not_found' };

  await db.auditLog.create({
    data: {
      eventId: event.id,
      actorType: 'guardian',
      actorId: guardian.id,
      action: 'login.code_verified',
      entity: 'registration',
      entityId: registration.id,
      meta: { challengeId: challenge.id },
    },
  });

  log.info('login code accepted', { guardianId: guardian.id, registrationId: registration.id });
  return { ok: true, code: registration.code };
}
