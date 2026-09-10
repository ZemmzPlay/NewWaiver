import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '@carnival/db';
import { startSessions } from './sessions.js';

/**
 * Integration test against a real Postgres. This exists because of a bug
 * that unit tests with a mocked client would never have caught: the P2002
 * conflict handling in `startSessions` matched Prisma's `error.meta.target`
 * against the wrong strings (constraint names) for months of "it typechecks"
 * confidence, when Prisma actually reports *column* names — confirmed only
 * by triggering a real violation against a real database. `packages/db/src/
 * sessions.ts`'s replay guard and one-live-per-child rule are both load-
 * bearing correctness guarantees (hard rule 5), so they get a test that can
 * only pass by actually exercising Postgres's unique-violation error shape,
 * not by asserting against an assumption of it.
 *
 * Needs DATABASE_URL pointing at a real, migrated Postgres.
 */
describe('startSessions — replay and one-live-per-child conflict handling', () => {
  let eventId: string;
  let registrationId: string;
  let childId: string;
  let packageId: string;
  let staffId: string;

  beforeAll(async () => {
    const event = await db.event.create({
      data: {
        name: `test-event-${randomUUID()}`,
        venue: 'Test venue',
        // Earliest startsAt wins in currentEvent(), so this makes itself the
        // active event for the duration of the test without touching seed data.
        startsAt: new Date('2000-01-01T00:00:00Z'),
        endsAt: new Date('2000-01-02T00:00:00Z'),
      },
    });
    eventId = event.id;

    const zone = await db.zone.create({
      data: { eventId, name: 'Test Zone', supervisionMode: 'accompanied' },
    });
    const pkg = await db.package.create({
      data: { zoneId: zone.id, label: '15 minutes', minutes: 15 },
    });
    packageId = pkg.id;

    const guardian = await db.guardian.create({
      data: {
        eventId, fullName: 'Test Guardian', relation: 'mother',
        phoneE164: `+9715${Date.now()}`.slice(0, 13), phoneTail: String(Date.now()).slice(-9),
        email: `test-${randomUUID()}@example.com`,
      },
    });
    const registration = await db.registration.create({
      data: { eventId, guardianId: guardian.id, code: String(Date.now()).slice(-6) },
    });
    registrationId = registration.id;

    const child = await db.child.create({
      data: {
        registrationId, fullName: 'Test Child', ageYears: 5,
        childCode: `TC-${randomUUID()}`, seq: 1,
      },
    });
    childId = child.id;

    const staff = await db.staff.create({
      data: { eventId, fullName: 'Test Staff', pinHash: 'unused', role: 'staffer' },
    });
    staffId = staff.id;
  });

  afterAll(async () => {
    // sessions.zone_id is ON DELETE RESTRICT (a session must always be able
    // to say which zone it happened in, even after the event is archived),
    // so the sessions this test created have to go before the event cascade
    // can reach zones/packages/guardian/registration/child/staff.
    await db.session.deleteMany({ where: { childId } });
    await db.event.delete({ where: { id: eventId } });
    await db.$disconnect();
  });

  it('replays a duplicate clientUuid instead of throwing, returning the same session', async () => {
    const clientUuid = randomUUID();
    const first = await startSessions(
      { registrationId, entries: [{ childId, packageId, clientUuid }] },
      staffId,
    );
    expect(first[0]!.alreadyExisted).toBe(false);

    const second = await startSessions(
      { registrationId, entries: [{ childId, packageId, clientUuid }] },
      staffId,
    );
    expect(second[0]!.alreadyExisted).toBe(true);
    expect(second[0]!.sessionId).toBe(first[0]!.sessionId);

    const sessions = await db.session.findMany({ where: { childId } });
    expect(sessions).toHaveLength(1);
  });

  it('throws CHILD_ALREADY_INSIDE for a genuinely new check-in while one is already live', async () => {
    // The previous test already left this child with a live session.
    await expect(
      startSessions({ registrationId, entries: [{ childId, packageId, clientUuid: randomUUID() }] }, staffId),
    ).rejects.toThrow('CHILD_ALREADY_INSIDE');
  });
});
