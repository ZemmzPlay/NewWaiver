import { RegisterFlow } from '@/components/register/RegisterFlow';
import { renderWaiverMarkdown } from '@/lib/markdown';
import { currentLocale } from '@/lib/locale-server';
import { activeWaiver, currentEvent, packageTiles } from '@/server/event';

export const dynamic = 'force-dynamic';

/**
 * Steps 2 to 5. Step 1 is the landing page; `?p=` carries the tile they tapped.
 *
 * The waiver is loaded in the language they are reading the page in, and the
 * consent record points at that version — an Arabic signature is evidence
 * against the Arabic text, which is the only version that would stand up.
 */
export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const params = await searchParams;
  const locale = await currentLocale();
  const event = await currentEvent();
  const [tiles, waiver] = await Promise.all([
    packageTiles(event.id),
    activeWaiver(event.id, locale),
  ]);
  const initial = tiles.find((tile) => tile.packageId === params.p)?.packageId ?? null;

  return (
    <RegisterFlow
      tiles={tiles}
      initialPackageId={initial}
      waiver={{
        id: waiver.id,
        title: waiver.title,
        version: waiver.version,
        html: renderWaiverMarkdown(waiver.bodyMd),
      }}
    />
  );
}
