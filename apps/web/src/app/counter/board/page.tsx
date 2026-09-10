import { Fragment } from 'react';
import { redirect } from 'next/navigation';
import { dictionary } from '@carnival/shared';
import { CounterChrome } from '@/components/counter/CounterChrome';
import { ZoneBoard } from '@/components/counter/ZoneBoard';
import { currentLocale } from '@/lib/locale-server';
import { currentStaff, isSupervisor } from '@/server/auth';
import { activeZones, currentEvent } from '@/server/event';
import { zoneBoard } from '@/server/sessions';

export const dynamic = 'force-dynamic';

/**
 * Desk staffers see their signed-in zone only. Supervisors and admins see
 * Soft Play (left) and Bouncy Castles (right) with a divider; each side lists
 * that zone’s live children as cards.
 */
export default async function BoardPage() {
  const staff = await currentStaff();
  if (!staff) redirect('/counter');

  const t = dictionary(await currentLocale());
  const event = await currentEvent();
  const zones = await activeZones(event.id);
  const serverNowIso = new Date().toISOString();

  if (isSupervisor(staff)) {
    const boards = await Promise.all(
      zones.map(async (zone) => ({
        zone,
        rows: await zoneBoard(zone.id),
      })),
    );

    return (
      <CounterChrome zoneName={t.counter.allZones} staffRole={staff.role} active="board">
        <div className="board-split">
          {boards.map(({ zone, rows }, index) => (
            <Fragment key={zone.id}>
              {index > 0 ? <div className="board-split-divider" role="presentation" /> : null}
              <section className="board-split-pane" aria-label={zone.name}>
                <ZoneBoard
                  zoneId={zone.id}
                  zoneName={zone.name}
                  supervisionMode={zone.supervisionMode}
                  initialRows={JSON.parse(JSON.stringify(rows))}
                  serverNowIso={serverNowIso}
                  pane
                />
              </section>
            </Fragment>
          ))}
        </div>
      </CounterChrome>
    );
  }

  const zone = zones.find((z) => z.id === staff.zoneId) ?? zones[0]!;
  const rows = await zoneBoard(zone.id);

  return (
    <CounterChrome zoneName={zone.name} staffRole={staff.role} active="board">
      <ZoneBoard
        zoneId={zone.id}
        zoneName={zone.name}
        supervisionMode={zone.supervisionMode}
        initialRows={JSON.parse(JSON.stringify(rows))}
        serverNowIso={serverNowIso}
      />
    </CounterChrome>
  );
}
