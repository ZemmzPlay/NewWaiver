import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setChannel } from '@carnival/shared/messaging';
import type { Channel, SendResult } from '@carnival/shared/messaging';
import { db } from './client.js';
import {
  cancelPendingForSession, claimDueNotifications, claimNotification, dispatchClaimed,
  pendingCountForRegistration, reclaimStaleClaims, runDueNotifications,
  scheduleRegistrationEmail, scheduleSessionNotifications,
} from './notifications.js';

/**
 * Integration test against a real Postgres — hard rule 4 ("a double-run never
 * double-sends") is a database claim, not application logic, and the one raw
 * SQL query in this file (`FOR UPDATE SKIP LOCKED`) has no query-builder
 * equivalent to fall back on if it's ever wrong. A mocked client would
 * exercise none of that.
 */

/** A Channel double that records every send and lets a test script the outcome. */
function fakeChannel(script: (() => SendResult) | SendResult): Channel & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    name: 'fake',
    calls,
    async send(message) {
      calls.push(message);
      return typeof script === 'function' ? script() : script;
    },
  };
}

describe('notifications — scheduling, claiming and dispatch', () => {
  let eventId: string;
  let zoneId: string;
  let packageId: string;
  let registrationId: string;
  let childId: string;
  let sessionId: string;

  beforeEach(async () => {
    const event = await db.event.create({
      data: {
        name: `test-notifications-${randomUUID()}`, venue: 'Test venue',
        startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000),
      },
    });
    eventId = event.id;

    const zone = await db.zone.create({ data: { eventId, name: 'Test Zone', supervisionMode: 'drop_off' } });
    zoneId = zone.id;
    const pkg = await db.package.create({ data: { zoneId, label: '15 minutes', minutes: 15 } });
    packageId = pkg.id;

    const guardian = await db.guardian.create({
      data: {
        eventId, fullName: 'Test Guardian', relation: 'mother',
        phoneE164: `+9715${Date.now()}`.slice(0, 13), phoneTail: String(Date.now()).slice(-9),
        email: `test-${randomUUID()}@example.com`, locale: 'en',
      },
    });
    const registration = await db.registration.create({
      data: { eventId, guardianId: guardian.id, code: String(Date.now()).slice(-6) },
    });
    registrationId = registration.id;

    const child = await db.child.create({
      data: {
        registrationId, fullName: 'Test Child', ageYears: 5,
        childCode: `TC-${randomUUID()}`, seq: 1, requestedPackageId: packageId,
      },
    });
    childId = child.id;

    const session = await db.session.create({
      data: {
        childId, zoneId, packageId, minutes: 15, status: 'active',
        startedAt: new Date(), endsAt: new Date(Date.now() + 900_000), warnAt: new Date(Date.now() + 600_000),
        clientUuid: randomUUID(),
      },
    });
    sessionId = session.id;
  });

  afterEach(async () => {
    setChannel(null);
    await db.notification.deleteMany({ where: { registrationId } });
    await db.session.deleteMany({ where: { childId } });
    await db.event.delete({ where: { id: eventId } });
  });

  describe('scheduling', () => {
    it('schedules the registration email due immediately', async () => {
      const row = await scheduleRegistrationEmail(registrationId, 'guardian@example.com');
      expect(row.type).toBe('registration');
      expect(row.status).toBe('scheduled');
      expect(row.scheduledFor.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('schedules only an expiry warning for an accompanied session', async () => {
      await scheduleSessionNotifications({
        sessionId, registrationId, toAddress: 'g@example.com',
        warnAt: new Date(Date.now() + 600_000), endsAt: new Date(Date.now() + 900_000),
        supervisionMode: 'accompanied',
      });
      const rows = await db.notification.findMany({ where: { sessionId } });
      expect(rows.map((r) => r.type).sort()).toEqual(['expiry_warning']);
    });

    it('schedules both an expiry warning and a pickup request for a drop-off session', async () => {
      await scheduleSessionNotifications({
        sessionId, registrationId, toAddress: 'g@example.com',
        warnAt: new Date(Date.now() + 600_000), endsAt: new Date(Date.now() + 900_000),
        supervisionMode: 'drop_off',
      });
      const rows = await db.notification.findMany({ where: { sessionId } });
      expect(rows.map((r) => r.type).sort()).toEqual(['expiry_warning', 'pickup_request']);
    });

    it('cancels only scheduled notifications for a session, not ones already sent', async () => {
      const pending = await db.notification.create({
        data: { sessionId, registrationId, type: 'expiry_warning', toAddress: 'g@example.com', scheduledFor: new Date(), status: 'scheduled' },
      });
      const alreadySent = await db.notification.create({
        data: { sessionId, registrationId, type: 'pickup_request', toAddress: 'g@example.com', scheduledFor: new Date(), status: 'sent' },
      });

      await cancelPendingForSession(sessionId);

      expect((await db.notification.findUnique({ where: { id: pending.id } }))!.status).toBe('cancelled');
      expect((await db.notification.findUnique({ where: { id: alreadySent.id } }))!.status).toBe('sent');
    });
  });

  describe('claiming', () => {
    it('claims only due, scheduled rows — not future ones, not already-claimed ones', async () => {
      const due = await db.notification.create({
        data: { registrationId, type: 'registration', toAddress: 'g@example.com', scheduledFor: new Date(Date.now() - 1000), status: 'scheduled' },
      });
      const future = await db.notification.create({
        data: { registrationId, type: 'registration', toAddress: 'g@example.com', scheduledFor: new Date(Date.now() + 60_000), status: 'scheduled' },
      });
      const alreadyClaimed = await db.notification.create({
        data: { registrationId, type: 'registration', toAddress: 'g@example.com', scheduledFor: new Date(Date.now() - 1000), status: 'claimed', claimedAt: new Date() },
      });

      const claimed = await claimDueNotifications(25);
      const claimedIds = claimed.map((r) => r.id);

      expect(claimedIds).toContain(due.id);
      expect(claimedIds).not.toContain(future.id);
      expect(claimedIds).not.toContain(alreadyClaimed.id);

      const reread = await db.notification.findUnique({ where: { id: due.id } });
      expect(reread!.status).toBe('claimed');
      expect(reread!.attempts).toBe(1);
    });

    it('claimNotification claims a specific scheduled row and returns null for one that is not scheduled', async () => {
      const row = await db.notification.create({
        data: { registrationId, type: 'registration', toAddress: 'g@example.com', scheduledFor: new Date(), status: 'scheduled' },
      });

      const claimed = await claimNotification(row.id);
      expect(claimed?.status).toBe('claimed');

      const secondAttempt = await claimNotification(row.id);
      expect(secondAttempt).toBeNull();
    });

    it('reclaimStaleClaims resets an old claimed row but leaves a fresh one alone', async () => {
      const stale = await db.notification.create({
        data: {
          registrationId, type: 'registration', toAddress: 'g@example.com', scheduledFor: new Date(),
          status: 'claimed', claimedAt: new Date(Date.now() - 10 * 60_000),
        },
      });
      const fresh = await db.notification.create({
        data: {
          registrationId, type: 'registration', toAddress: 'g@example.com', scheduledFor: new Date(),
          status: 'claimed', claimedAt: new Date(),
        },
      });

      const count = await reclaimStaleClaims();
      expect(count).toBeGreaterThanOrEqual(1);

      expect((await db.notification.findUnique({ where: { id: stale.id } }))!.status).toBe('scheduled');
      expect((await db.notification.findUnique({ where: { id: fresh.id } }))!.status).toBe('claimed');
    });
  });

  describe('dispatch', () => {
    it('marks a row sent and records the providerMessageId on success', async () => {
      const channel = fakeChannel({ ok: true, providerMessageId: 'msg-1' });
      setChannel(channel);

      const row = await scheduleRegistrationEmail(registrationId, 'guardian@example.com');
      const claimed = await claimNotification(row.id);
      const outcome = await dispatchClaimed(claimed!);

      expect(outcome).toBe('sent');
      expect(channel.calls).toHaveLength(1);
      const reread = await db.notification.findUnique({ where: { id: row.id } });
      expect(reread!.status).toBe('sent');
      expect(reread!.providerMessageId).toBe('msg-1');
    });

    it('reschedules a retryable failure instead of giving up', async () => {
      setChannel(fakeChannel({ ok: false, error: 'timeout', retryable: true }));

      const row = await scheduleRegistrationEmail(registrationId, 'guardian@example.com');
      const claimed = await claimNotification(row.id);
      const outcome = await dispatchClaimed(claimed!);

      expect(outcome).toBe('retry');
      const reread = await db.notification.findUnique({ where: { id: row.id } });
      expect(reread!.status).toBe('scheduled');
      expect(reread!.error).toBe('timeout');
      expect(reread!.scheduledFor.getTime()).toBeGreaterThan(Date.now());
    });

    it('fails permanently on a non-retryable error', async () => {
      setChannel(fakeChannel({ ok: false, error: 'bad address', retryable: false }));

      const row = await scheduleRegistrationEmail(registrationId, 'guardian@example.com');
      const claimed = await claimNotification(row.id);
      const outcome = await dispatchClaimed(claimed!);

      expect(outcome).toBe('failed');
      expect((await db.notification.findUnique({ where: { id: row.id } }))!.status).toBe('failed');
    });

    it('stops retrying once MAX_ATTEMPTS is exhausted even for a retryable error', async () => {
      setChannel(fakeChannel({ ok: false, error: 'still down', retryable: true }));

      const row = await db.notification.create({
        data: {
          registrationId, type: 'registration', toAddress: 'g@example.com',
          scheduledFor: new Date(), status: 'claimed', claimedAt: new Date(), attempts: 5,
        },
      });
      const outcome = await dispatchClaimed(row);

      expect(outcome).toBe('failed');
    });

    it('never sends for a session that has already been checked out — the exact case a "come pick up" email would be wrong', async () => {
      await db.session.update({ where: { id: sessionId }, data: { status: 'checked_out' } });
      const channel = fakeChannel({ ok: true, providerMessageId: 'should-not-be-called' });
      setChannel(channel);

      const row = await db.notification.create({
        data: { sessionId, registrationId, type: 'expiry_warning', toAddress: 'g@example.com', scheduledFor: new Date(), status: 'claimed', claimedAt: new Date() },
      });
      const outcome = await dispatchClaimed(row);

      expect(outcome).toBe('failed');
      expect(channel.calls).toHaveLength(0);
      expect((await db.notification.findUnique({ where: { id: row.id } }))!.status).toBe('cancelled');
    });
  });

  it('runDueNotifications claims and sends everything due in one pass', async () => {
    const channel = fakeChannel({ ok: true, providerMessageId: 'x' });
    setChannel(channel);
    await scheduleRegistrationEmail(registrationId, 'guardian@example.com');

    const sent = await runDueNotifications();

    expect(sent).toBe(1);
    expect(channel.calls).toHaveLength(1);
  });

  it('pendingCountForRegistration counts due-but-unsent rows', async () => {
    await scheduleRegistrationEmail(registrationId, 'guardian@example.com');
    await db.notification.create({
      data: { registrationId, type: 'expiry_warning', toAddress: 'g@example.com', scheduledFor: new Date(Date.now() + 60_000), status: 'scheduled' },
    });

    const count = await pendingCountForRegistration(registrationId);

    // Only the due row counts — the one scheduled a minute from now hasn't
    // missed its send yet, so it isn't "stuck" from the counter's point of view.
    expect(count).toBe(1);
  });
});
