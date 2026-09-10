/**
 * Seed: one event, two zones, their packages, waiver v1, and staff PINs.
 *
 * BUILD_PLAN cuts admin CRUD, so this file *is* the admin surface. Changing a
 * duration or adding a tile is an edit here plus `npm run db:seed`, not a
 * deploy. The seed is idempotent: re-running it updates what exists and
 * inserts what does not. It never touches a waiver version that is already
 * published.
 */

import './env.js';
import { db } from './client.js';
import { hashPin } from './pin.js';
import { WAIVER_AR_V1_BODY, WAIVER_AR_V1_TITLE } from './waiver-ar-v1.js';
import { WAIVER_EN_V1_BODY, WAIVER_EN_V1_TITLE } from './waiver-en-v1.js';

const EVENT = {
  name: 'Middle East Film & Comic Con',
  venue: 'ADNEC, Abu Dhabi',
  // Stored UTC. 11 Sep 2026, 10:00-22:00 Dubai (UTC+4) across three days.
  startsAt: new Date('2026-09-11T06:00:00Z'),
  endsAt: new Date('2026-09-13T18:00:00Z'),
  timezone: 'Asia/Dubai',
};

const ZONES = [
  {
    name: 'Soft Play',
    nameAr: 'اللعب الآمن',
    supervisionMode: 'drop_off' as const,
    capacity: 40,
    // [OPEN] PRD s2 - age limits per zone were never supplied, so nothing gates.
    minAge: null,
    maxAge: null,
    sortOrder: 1,
    durations: [15, 30, 60],
  },
  {
    name: 'Bouncy Castles',
    nameAr: 'القلاع النطاطة',
    supervisionMode: 'drop_off' as const,
    capacity: 30,
    minAge: null,
    maxAge: null,
    sortOrder: 2,
    durations: [15, 30],
  },
];

/**
 * Day-one PINs. These are seed values and every one of them is in the repo, so
 * rotate them before the event by editing this list and re-seeding.
 */
const STAFF = [
  { fullName: 'Counter 1 — Soft Play', role: 'staffer' as const, pin: '1111', zone: 'Soft Play' },
  { fullName: 'Counter 2 — Bouncy Castles', role: 'staffer' as const, pin: '2222', zone: 'Bouncy Castles' },
  { fullName: 'Pickup marshal', role: 'pickup' as const, pin: '3333', zone: null },
  // Admin, not supervisor: it's a superset (/counter/overview plus
  // /counter/admin), and something has to be the first account able to
  // create every other one — nobody bootstraps their own admin access.
  { fullName: 'Admin', role: 'admin' as const, pin: '9999', zone: null },
];

async function main() {
  const existingEvent = await db.event.findFirst({ where: { name: EVENT.name } });
  const eventRow = existingEvent
    ? await db.event.update({ where: { id: existingEvent.id }, data: EVENT })
    : await db.event.create({ data: EVENT });
  console.log(`event: ${eventRow.name} (${eventRow.id})`);

  const zoneIds = new Map<string, string>();
  for (const zone of ZONES) {
    const { durations, ...fields } = zone;
    const existing = await db.zone.findFirst({ where: { eventId: eventRow.id, name: zone.name } });
    const row = existing
      ? await db.zone.update({ where: { id: existing.id }, data: fields })
      : await db.zone.create({ data: { ...fields, eventId: eventRow.id } });
    zoneIds.set(zone.name, row.id);

    // Tiles are rows. A duration that disappears from the list is deactivated
    // rather than deleted, because sessions point at it.
    const existingPackages = await db.package.findMany({ where: { zoneId: row.id } });
    for (const pkg of existingPackages) {
      if (!durations.includes(pkg.minutes)) {
        await db.package.update({ where: { id: pkg.id }, data: { isActive: false } });
      }
    }
    for (const [index, minutes] of durations.entries()) {
      const label = `${minutes} minutes`;
      const found = existingPackages.find((p) => p.minutes === minutes);
      if (found) {
        await db.package.update({
          where: { id: found.id },
          data: { label, sortOrder: index + 1, isActive: true },
        });
      } else {
        await db.package.create({ data: { zoneId: row.id, label, minutes, sortOrder: index + 1 } });
      }
    }
    console.log(`zone: ${row.name} (${zone.supervisionMode}) — ${durations.join('/')} min`);
  }

  // Hard rule 7: publishing inserts, never updates. If v1 exists in a locale we
  // leave it exactly as it is, even if the text in this repo has since changed.
  //
  // The two locales are separate published versions, and a consent record points
  // at the one the guardian actually read — so an Arabic signature is evidence
  // against the Arabic text, which is the only thing that would stand up.
  const WAIVERS = [
    { locale: 'en', title: WAIVER_EN_V1_TITLE, body: WAIVER_EN_V1_BODY },
    { locale: 'ar', title: WAIVER_AR_V1_TITLE, body: WAIVER_AR_V1_BODY },
  ];

  for (const waiver of WAIVERS) {
    const existing = await db.waiverVersion.findFirst({
      where: { eventId: eventRow.id, locale: waiver.locale },
      orderBy: { version: 'asc' },
    });
    if (existing) {
      console.log(`waiver ${waiver.locale}: v${existing.version} already published, left untouched`);
      continue;
    }
    const row = await db.waiverVersion.create({
      data: {
        eventId: eventRow.id, locale: waiver.locale, version: 1,
        title: waiver.title, bodyMd: waiver.body, isActive: true,
      },
    });
    console.log(`waiver ${waiver.locale}: v${row.version} published (${row.id})`);
  }

  for (const member of STAFF) {
    const existing = await db.staff.findFirst({ where: { eventId: eventRow.id, fullName: member.fullName } });
    const values = {
      fullName: member.fullName,
      role: member.role,
      pinHash: await hashPin(member.pin),
      defaultZoneId: member.zone ? zoneIds.get(member.zone)! : null,
      isActive: true,
    };
    if (existing) await db.staff.update({ where: { id: existing.id }, data: values });
    else await db.staff.create({ data: { ...values, eventId: eventRow.id } });
    console.log(`staff: ${member.fullName} (${member.role})`);
  }

  console.log('\nseed complete.');
  console.log('PINs are seed values and live in packages/db/src/seed.ts — rotate before the event.');
}

await main();
await db.$disconnect();
