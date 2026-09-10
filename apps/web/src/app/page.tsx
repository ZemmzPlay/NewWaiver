import { LandingHero } from '@/components/LandingHero';
import { PackageGrid } from '@/components/PackageGrid';
import { PublicChrome } from '@/components/PublicChrome';
import { currentEvent, packageTiles } from '@/server/event';

export const dynamic = 'force-dynamic';

/** Step 1 — pick a package. The landing page is the package grid. */
export default async function LandingPage() {
  const event = await currentEvent();
  const tiles = await packageTiles(event.id);

  return (
    <PublicChrome step={{ current: 1, total: 5, key: 'package' }}>
      <LandingHero />
      <PackageGrid tiles={tiles} hrefBase="/register?p=" />
    </PublicChrome>
  );
}
