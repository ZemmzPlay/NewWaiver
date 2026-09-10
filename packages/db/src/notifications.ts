/**
 * Scheduling and dispatch for the three emails in PRD s6.
 *
 * Hard rule 4: notifications are idempotent. A row is *claimed* with a
 * conditional update before anything is sent, so two workers — or a worker and
 * a web request racing to send the confirmation — can only ever produce one
 * send. A double-run never double-sends.
 *
 * This lives in the data package rather than in an app because the claim is a
 * database operation, and both apps/web and apps/worker have to perform it
 * exactly the same way.
 */

import type { Notification, Prisma } from '@prisma/client';
import {
  getChannel, expiryWarningEmail, loginCodeEmail, pickupRequestEmail, registrationEmail,
} from '@carnival/shared/messaging';
import {
  createLogger, WARN_LEAD_MINUTES, dubaiTime, firstName, isLocale, minutesUntil,
} from '@carnival/shared';
import type { Locale } from '@carnival/shared';
import { db } from './client.js';

const log = createLogger('notifications');

const MAX_ATTEMPTS = 5;
/** Backoff in minutes by attempt number. Short, because the event is short. */
const BACKOFF_MINUTES = [1, 2, 5, 10, 20];

function templateContext(locale: Locale = 'en') {
  return {
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000',
    eventName: 'Carnival',
    locale,
  };
}

/* ------------------------------------------------------------- scheduling */

/** The confirmation, due immediately. Doubles as the channel test in PRD s3. */
export async function scheduleRegistrationEmail(registrationId: string, toAddress: string) {
  return db.notification.create({
    data: {
      registrationId, type: 'registration', channel: 'email', toAddress, scheduledFor: new Date(),
    },
  });
}

/**
 * Called when a session starts. The warning at `ends_at - 5 min`, and for a
 * drop-off zone the pickup request at `ends_at`, because in an accompanied zone
 * the guardian is standing right there.
 */
export async function scheduleSessionNotifications(input: {
  sessionId: string;
  registrationId: string;
  toAddress: string;
  warnAt: Date;
  endsAt: Date;
  supervisionMode: 'accompanied' | 'drop_off';
}, client: Prisma.TransactionClient = db) {
  const rows: Prisma.NotificationCreateManyInput[] = [{
    sessionId: input.sessionId,
    registrationId: input.registrationId,
    type: 'expiry_warning',
    channel: 'email',
    toAddress: input.toAddress,
    scheduledFor: input.warnAt,
  }];

  if (input.supervisionMode === 'drop_off') {
    rows.push({
      sessionId: input.sessionId,
      registrationId: input.registrationId,
      type: 'pickup_request',
      channel: 'email',
      toAddress: input.toAddress,
      scheduledFor: input.endsAt,
    });
  }

  await client.notification.createMany({ data: rows });
  log.info('session notifications scheduled', { sessionId: input.sessionId, count: rows.length });
}

/** Check-out cancels anything still waiting to go out for that session. */
export async function cancelPendingForSession(sessionId: string, client: Prisma.TransactionClient = db) {
  const cancelled = await client.notification.updateMany({
    where: { sessionId, status: 'scheduled' },
    data: { status: 'cancelled' },
  });
  if (cancelled.count) log.info('pending notifications cancelled', { sessionId, count: cancelled.count });
}

/* ----------------------------------------------------------------- claim */

/** A tick takes milliseconds; nothing legitimate holds a row `claimed` this long. */
const STUCK_CLAIM_MINUTES = 5;

/**
 * If the worker is killed between claiming a row and dispatching it (OOM,
 * `kill -9`, host reboot — anything that skips the graceful-shutdown path in
 * apps/worker/src/index.ts), the row is left at `status = 'claimed'`
 * forever: `claimDueNotifications` only ever looks at `scheduled` rows, so
 * nothing would pick it back up, and the guardian silently never gets that
 * email. Run this once per tick, before claiming, to put stuck rows back in
 * the queue.
 */
export async function reclaimStaleClaims(): Promise<number> {
  const cutoff = new Date(Date.now() - STUCK_CLAIM_MINUTES * 60_000);
  const result = await db.notification.updateMany({
    where: { status: 'claimed', claimedAt: { lt: cutoff } },
    data: { status: 'scheduled' },
  });
  if (result.count) log.warn('reclaimed stale claimed notifications', { count: result.count });
  return result.count;
}

/**
 * The conditional update that makes the whole thing safe. Only rows this call
 * flips from `scheduled` to `claimed` come back, so no other process can pick
 * them up. `skip locked` keeps two workers from queueing behind each other.
 *
 * No query-builder form of `FOR UPDATE SKIP LOCKED` exists in Prisma, so this
 * stays raw SQL — same shape as it was under Drizzle.
 */
export async function claimDueNotifications(limit = 25): Promise<Notification[]> {
  const claimed = await db.$queryRaw<{ id: string }[]>`
    update notifications
       set status = 'claimed', claimed_at = now(), attempts = attempts + 1
     where id in (
       select id from notifications
        where status = 'scheduled' and scheduled_for <= now()
        order by scheduled_for asc
        limit ${limit}
        for update skip locked
     )
    returning id
  `;
  const ids = claimed.map((r) => r.id);
  return ids.length ? db.notification.findMany({ where: { id: { in: ids } } }) : [];
}

/** Claims one specific row, for the send-it-now path on the confirmation. */
export async function claimNotification(id: string): Promise<Notification | null> {
  const result = await db.notification.updateMany({
    where: { id, status: 'scheduled' },
    data: { status: 'claimed', claimedAt: new Date(), attempts: { increment: 1 } },
  });
  if (result.count === 0) return null;
  return db.notification.findUnique({ where: { id } });
}

/* -------------------------------------------------------------- hydration */

async function buildMessage(row: Notification) {
  const registration = await db.registration.findUnique({
    where: { id: row.registrationId },
    select: { code: true, guardian: { select: { fullName: true, locale: true } } },
  });
  if (!registration) return null;

  // Every email goes out in the language the guardian filled the form in.
  const ctx = templateContext(isLocale(registration.guardian.locale) ? registration.guardian.locale : 'en');

  if (row.type === 'registration') {
    const kids = await db.child.findMany({
      where: { registrationId: row.registrationId },
      select: {
        fullName: true,
        requestedPackage: { select: { minutes: true, zone: { select: { name: true, nameAr: true } } } },
      },
      orderBy: { seq: 'asc' },
    });

    return registrationEmail(ctx, {
      code: registration.code,
      guardianFirstName: firstName(registration.guardian.fullName),
      children: kids.map((k) => ({
        firstName: firstName(k.fullName),
        zoneName: (ctx.locale === 'ar' ? k.requestedPackage?.zone.nameAr : null) ?? k.requestedPackage?.zone.name ?? '',
        minutes: k.requestedPackage?.minutes ?? 0,
      })),
    });
  }

  if (!row.sessionId) return null;
  const session = await db.session.findUnique({
    where: { id: row.sessionId },
    select: {
      status: true,
      endsAt: true,
      child: { select: { fullName: true } },
      zone: { select: { name: true, nameAr: true } },
    },
  });
  if (!session) return null;
  // Belt-and-braces: check-out cancels a session's pending notifications in
  // the same transaction, so this shouldn't fire in practice — but a child
  // who has already left is exactly the case where a "come pick up your
  // child" email would be the most confusing thing this system could send.
  if (session.status === 'checked_out' || session.status === 'cancelled') return null;
  const zoneName = (ctx.locale === 'ar' ? session.zone.nameAr : null) ?? session.zone.name;

  if (row.type === 'expiry_warning') {
    return expiryWarningEmail(ctx, {
      code: registration.code,
      childFirstName: firstName(session.child.fullName),
      zoneName,
      // Rounded off the real end time rather than assumed, so a late tick tells
      // the truth instead of promising five minutes that have already gone.
      minutesLeft: Math.max(0, minutesUntil(session.endsAt)) || WARN_LEAD_MINUTES,
      endsAtLocal: dubaiTime(session.endsAt),
    });
  }

  return pickupRequestEmail(ctx, {
    code: registration.code,
    childFirstName: firstName(session.child.fullName),
    zoneName,
  });
}

/* --------------------------------------------------------------- dispatch */

/** Sends a claimed row and records the outcome. Never throws. */
export async function dispatchClaimed(row: Notification): Promise<'sent' | 'failed' | 'retry'> {
  try {
    const content = await buildMessage(row);
    if (!content) {
      await db.notification.update({
        where: { id: row.id },
        data: { status: 'cancelled', error: 'source record gone' },
      });
      return 'failed';
    }

    const result = await getChannel().send({ ...content, to: row.toAddress, reference: row.id });

    if (result.ok) {
      await db.notification.update({
        where: { id: row.id },
        data: { status: 'sent', sentAt: new Date(), providerMessageId: result.providerMessageId, error: null },
      });
      log.info('sent', { notificationId: row.id, type: row.type, sessionId: row.sessionId });
      return 'sent';
    }

    const canRetry = result.retryable && row.attempts < MAX_ATTEMPTS;
    if (canRetry) {
      const wait = BACKOFF_MINUTES[Math.min(row.attempts, BACKOFF_MINUTES.length - 1)]!;
      await db.notification.update({
        where: { id: row.id },
        data: {
          status: 'scheduled',
          claimedAt: null,
          error: result.error,
          scheduledFor: new Date(Date.now() + wait * 60_000),
        },
      });
      log.warn('send failed, will retry', { notificationId: row.id, attempts: row.attempts, waitMinutes: wait });
      return 'retry';
    }

    await db.notification.update({ where: { id: row.id }, data: { status: 'failed', error: result.error } });
    log.error('send failed permanently', { notificationId: row.id, type: row.type });
    return 'failed';
  } catch (error) {
    await db.notification.update({
      where: { id: row.id },
      data: { status: 'failed', error: error instanceof Error ? error.message : String(error) },
    });
    log.error('dispatch threw', { notificationId: row.id });
    return 'failed';
  }
}

/** One pass: claim what is due, send it. Returns how many were sent. */
export async function runDueNotifications(limit = 25): Promise<number> {
  await reclaimStaleClaims();
  const claimed = await claimDueNotifications(limit);
  let sent = 0;
  for (const row of claimed) {
    if (await dispatchClaimed(row) === 'sent') sent += 1;
  }
  return sent;
}

/** Best effort immediate send, used on the confirmation so a bad address
 *  surfaces at the counter before the child goes in. Safe to lose: the worker
 *  picks the row up on its next tick either way. */
export async function sendNow(notificationId: string): Promise<boolean> {
  const claimed = await claimNotification(notificationId);
  if (!claimed) return false;
  return (await dispatchClaimed(claimed)) === 'sent';
}

/**
 * The one-time sign-in code for "open my page again".
 *
 * Sent straight through rather than queued, because it is worthless in twenty
 * seconds and the guardian is standing there waiting for it. A notifications
 * row is still written so the SendGrid bounce webhook has something to attach
 * to and so a staffer can see that the code was sent — but the code itself is
 * never stored, here or anywhere: only its hash, on `login_challenges`.
 */
export async function sendLoginCode(input: {
  registrationId: string;
  toAddress: string;
  otp: string;
  locale: Locale;
}): Promise<boolean> {
  const row = await db.notification.create({
    data: {
      registrationId: input.registrationId,
      type: 'login_code',
      channel: 'email',
      toAddress: input.toAddress,
      scheduledFor: new Date(),
      status: 'claimed',
      claimedAt: new Date(),
      attempts: 1,
    },
  });

  const content = loginCodeEmail(templateContext(input.locale), { otp: input.otp });
  const result = await getChannel().send({ ...content, to: input.toAddress, reference: row.id });

  await db.notification.update({
    where: { id: row.id },
    data: result.ok
      ? { status: 'sent', sentAt: new Date(), providerMessageId: result.providerMessageId }
      : { status: 'failed', error: result.error },
  });

  log.info('login code dispatched', { notificationId: row.id, ok: result.ok });
  return result.ok;
}

/** Rows still waiting, for the counter's "email hasn't landed yet" warning. */
export async function pendingCountForRegistration(registrationId: string): Promise<number> {
  return db.notification.count({
    where: {
      registrationId,
      status: { in: ['scheduled', 'claimed'] },
      sentAt: null,
      scheduledFor: { lte: new Date() },
    },
  });
}
