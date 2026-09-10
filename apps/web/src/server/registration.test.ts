import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@carnival/db';
import { register, registrationByCode } from './registration.js';

/**
 * Integration test against a real Postgres. `register()` is the one place in
 * the app that writes a guardian, a registration, N children, a consent and
 * an audit-log row together inside `$transaction` — and the retry-on-code-
 * collision path lives on the same `error.meta.target` column-name matching
 * that was silently broken for the sessions.ts constraints (see
 * sessions.test.ts) until it was checked against a real violation.
 */
describe('register', () => {
  let eventId: string;
  let packageId: string;
  let waiverVersionId: string;

  beforeEach(async () => {
    const event = await db.event.create({
      data: {
        name: `test-registration-${randomUUID()}`, venue: 'Test venue',
        // Earliest startsAt wins in currentEvent() — see sessions.test.ts for why.
        startsAt: new Date('2000-01-01T00:00:00Z'), endsAt: new Date('2000-01-02T00:00:00Z'),
      },
    });
    eventId = event.id;

    const zone = await db.zone.create({ data: { eventId, name: 'Test Zone', supervisionMode: 'accompanied' } });
    const pkg = await db.package.create({ data: { zoneId: zone.id, label: '15 minutes', minutes: 15 } });
    packageId = pkg.id;

    const waiver = await db.waiverVersion.create({
      data: { eventId, locale: 'en', version: 1, title: 'Test waiver', bodyMd: 'Terms.', isActive: true },
    });
    waiverVersionId = waiver.id;
  });

  afterEach(async () => {
    // consents.waiver_version_id is ON DELETE RESTRICT (an acceptance record
    // must always be able to say which text was accepted), so registrations
    // — which cascade to their consents — have to go before the event
    // cascade can reach waiver_versions. Getting this order wrong doesn't
    // just fail cleanly: it leaves the event behind, and because every test
    // in this file uses the same earliest-wins startsAt trick, a stray event
    // silently corrupts every later test's currentEvent() resolution too.
    await db.registration.deleteMany({ where: { eventId } });
    await db.event.delete({ where: { id: eventId } });
  });

  function validInput(overrides: { phone?: string; email?: string } = {}) {
    return {
      guardian: {
        fullName: 'Test Guardian',
        relation: 'mother' as const,
        phone: overrides.phone ?? `050${String(Date.now()).slice(-7)}`,
        email: overrides.email ?? `test-${randomUUID()}@example.com`,
        locale: 'en' as const,
      },
      children: [{ fullName: 'Test Child', ageYears: 5, packageId }],
      consent: { waiverVersionId, agreed: true as const, typedName: 'Test Guardian' },
      marketingConsent: true,
      clientUuid: randomUUID(),
    };
  }

  it('creates a guardian, registration, child, consent and audit-log row, and returns a code', async () => {
    const result = await register(validInput(), {});

    expect(result.merged).toBe(false);
    expect(result.code).toMatch(/^\d{6}$/);

    const registration = await db.registration.findUnique({
      where: { id: result.registrationId },
      include: { children: true, consents: true, guardian: true },
    });
    expect(registration).not.toBeNull();
    expect(registration!.children).toHaveLength(1);
    expect(registration!.consents).toHaveLength(1);
    expect(registration!.consents[0]!.waiverVersionId).toBe(waiverVersionId);
    expect(registration!.guardian.fullName).toBe('Test Guardian');

    const audit = await db.auditLog.findFirst({ where: { entity: 'registration', entityId: result.registrationId } });
    expect(audit?.action).toBe('registration.created');
  });

  it('merges a second registration from the same phone number into the existing family', async () => {
    const phone = `050${String(Date.now()).slice(-7)}`;
    const first = await register(validInput({ phone }), {});
    const second = await register(validInput({ phone }), {});

    expect(second.merged).toBe(true);
    expect(second.registrationId).toBe(first.registrationId);
    expect(second.code).toBe(first.code);

    const children = await db.child.findMany({ where: { registrationId: first.registrationId }, orderBy: { seq: 'asc' } });
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.seq)).toEqual([1, 2]);

    const audit = await db.auditLog.findFirst({
      where: { entity: 'registration', entityId: first.registrationId, action: 'registration.children_added' },
    });
    expect(audit).not.toBeNull();
  });

  it('rejects a consent pointing at a waiver version that is not the currently active one', async () => {
    const input = validInput();
    input.consent.waiverVersionId = randomUUID();

    await expect(register(input, {})).rejects.toThrow('WAIVER_SUPERSEDED');
  });

  it('rejects a packageId that does not belong to an active package', async () => {
    const input = validInput();
    input.children[0]!.packageId = randomUUID();

    await expect(register(input, {})).rejects.toThrow('UNKNOWN_PACKAGE');
  });

  it('assigns each child in one submission a distinct, sequential child code', async () => {
    const input = validInput();
    input.children.push({ fullName: 'Second Child', ageYears: 7, packageId });

    const result = await register(input, {});

    const children = await db.child.findMany({ where: { registrationId: result.registrationId }, orderBy: { seq: 'asc' } });
    expect(children).toHaveLength(2);
    expect(children[0]!.childCode).toBe(`${result.code}-1`);
    expect(children[1]!.childCode).toBe(`${result.code}-2`);
  });
});

describe('registrationByCode', () => {
  let eventId: string;
  let registrationId: string;
  let code: string;

  beforeEach(async () => {
    const event = await db.event.create({
      data: {
        name: `test-lookup-${randomUUID()}`, venue: 'Test venue',
        startsAt: new Date('2000-01-01T00:00:00Z'), endsAt: new Date('2000-01-02T00:00:00Z'),
      },
    });
    eventId = event.id;
    const guardian = await db.guardian.create({
      data: {
        eventId, fullName: 'Lookup Guardian', relation: 'father',
        phoneE164: `+9715${Date.now()}`.slice(0, 13), phoneTail: String(Date.now()).slice(-9),
        email: `lookup-${randomUUID()}@example.com`,
      },
    });
    code = String(Date.now()).slice(-6);
    const registration = await db.registration.create({ data: { eventId, guardianId: guardian.id, code } });
    registrationId = registration.id;
    await db.child.create({ data: { registrationId, fullName: 'Lookup Child', ageYears: 4, childCode: `${code}-1`, seq: 1 } });
  });

  afterEach(async () => {
    await db.event.delete({ where: { id: eventId } });
  });

  it('returns the registration, guardian and children for a known code', async () => {
    const result = await registrationByCode(code);
    expect(result).not.toBeNull();
    expect(result!.registration.id).toBe(registrationId);
    expect(result!.guardian?.fullName).toBe('Lookup Guardian');
    expect(result!.children).toHaveLength(1);
  });

  it('returns null for a code nobody has', async () => {
    expect(await registrationByCode('000000')).toBeNull();
  });
});
