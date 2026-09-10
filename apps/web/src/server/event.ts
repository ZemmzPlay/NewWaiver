import 'server-only';
import { db } from '@carnival/db';
import type { Package, WaiverVersion, Zone } from '@carnival/db';

/**
 * BUILD_PLAN cuts admin CRUD, so there is exactly one event and it comes from
 * the seed. Everything reads it through here.
 */

export interface ZoneWithPackages extends Zone {
  packages: Package[];
}

export async function currentEvent() {
  const event = await db.event.findFirst({ orderBy: { startsAt: 'asc' } });
  if (!event) throw new Error('No event seeded. Run npm run db:seed.');
  return event;
}

export async function activeZones(eventId: string): Promise<ZoneWithPackages[]> {
  return db.zone.findMany({
    where: { eventId, isActive: true },
    orderBy: { sortOrder: 'asc' },
    include: { packages: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
  });
}

/** The tiles on the landing page, flattened: one per zone x duration. */
export interface PackageTile {
  packageId: string;
  zoneId: string;
  zoneName: string;
  zoneNameAr: string | null;
  supervisionMode: 'accompanied' | 'drop_off';
  minutes: number;
  label: string;
}

export async function packageTiles(eventId: string): Promise<PackageTile[]> {
  const zoneRows = await activeZones(eventId);
  return zoneRows.flatMap((zone) =>
    zone.packages.map((pkg) => ({
      packageId: pkg.id,
      zoneId: zone.id,
      zoneName: zone.name,
      zoneNameAr: zone.nameAr,
      supervisionMode: zone.supervisionMode,
      minutes: pkg.minutes,
      label: pkg.label,
    })),
  );
}

/** Hard rule 7: the active version is the newest published one, never edited. */
export async function activeWaiver(eventId: string, locale = 'en'): Promise<WaiverVersion> {
  const waiver = await db.waiverVersion.findFirst({
    where: { eventId, locale, isActive: true },
    orderBy: { version: 'asc' },
  });
  if (!waiver) throw new Error(`No published waiver for locale ${locale}. Run npm run db:seed.`);
  return waiver;
}

export async function zoneById(zoneId: string): Promise<ZoneWithPackages | null> {
  return db.zone.findUnique({
    where: { id: zoneId },
    include: { packages: { where: { isActive: true }, orderBy: { sortOrder: 'asc' } } },
  });
}
