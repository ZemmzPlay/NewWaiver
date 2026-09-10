import { redirect } from 'next/navigation';
import { db } from '@carnival/db';
import { code128Svg, dubaiTime, stickerName } from '@carnival/shared';
import { AutoPrint, PrintButton } from '@/components/counter/AutoPrint';
import { currentStaff } from '@/server/auth';

export const dynamic = 'force-dynamic';

/**
 * The browser print fallback. Exact 51 x 25 mm @page sizing so what comes out
 * of an office laser printer matches what the Zebra would have produced.
 *
 * Layout is HARDWARE.md's, to the line:
 *   LAYLA A.          bold, two lines max
 *   IN 14:32   OUT 15:32
 *   BOUNCY CASTLE     R-7K2M-1
 *   [Code128 of the child code]
 *
 * The guardian's mobile number is deliberately absent.
 */
export default async function StickerPage({ searchParams }: { searchParams: Promise<{ s?: string; auto?: string }> }) {
  // Caddy's IP allowlist is the primary defence for this route (it's opened
  // as a bare popup with none of the counter console's chrome), but it
  // shouldn't be the only one — a leaked link or a network misconfiguration
  // is all it would take otherwise for a child's full name and session
  // times to be readable with no auth at all.
  const staff = await currentStaff();
  if (!staff) redirect('/counter');

  const query = await searchParams;
  const ids = (query.s ?? '').split(',').map((id) => id.trim()).filter(Boolean);
  if (!ids.length) return <p style={{ padding: 'var(--space-5)' }}>Nothing to print.</p>;
  // The label itself stays in English and Western digits regardless of the
  // guardian's language: it is read by staff, scanned by a machine, and printed
  // once. A bilingual sticker at 51 x 25 mm would halve the name.

  const sessionRows = await db.session.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      startedAt: true,
      endsAt: true,
      child: { select: { fullName: true, childCode: true } },
      zone: { select: { name: true } },
    },
  });
  const rows = sessionRows.map((row) => ({
    id: row.id,
    startedAt: row.startedAt,
    endsAt: row.endsAt,
    childName: row.child.fullName,
    childCode: row.child.childCode,
    zoneName: row.zone.name,
  }));

  return (
    <div className="sticker-sheet">
      {query.auto === '1' ? <AutoPrint /> : null}
      {rows.map((row) => (
        <div key={row.id} className="sticker">
          <div className="sticker-name">{stickerName(row.childName)}</div>
          <div className="sticker-times numeric">
            <span>IN {dubaiTime(row.startedAt)}</span>
            <span>OUT {dubaiTime(row.endsAt)}</span>
          </div>
          <div className="sticker-meta">
            <span>{row.zoneName}</span>
            <span className="numeric">{row.childCode}</span>
          </div>
          <div
            className="sticker-barcode"
            dangerouslySetInnerHTML={{ __html: code128Svg(row.childCode, { height: 30, moduleWidth: 1 }) }}
          />
        </div>
      ))}
      <div className="no-print" style={{ padding: 'var(--space-5)' }}>
        <PrintButton />
      </div>
    </div>
  );
}
