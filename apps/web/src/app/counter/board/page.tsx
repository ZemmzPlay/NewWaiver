import { redirect } from 'next/navigation';
import { CounterChrome } from '@/components/counter/CounterChrome';
import { ZoneBoard } from '@/components/counter/ZoneBoard';
import { currentStaff } from '@/server/auth';
import { activeZones, currentEvent } from '@/server/event';
import { zoneBoard } from '@/server/sessions';

export const dynamic = 'force-dynamic';

export default async function BoardPage() {
  const staff = await currentStaff();
  if (!staff) redirect('/counter');

  const event = await currentEvent();
  const zones = await activeZones(event.id);
  const zone = zones.find((z) => z.id === staff.zoneId) ?? zones[0]!;
  const rows = await zoneBoard(zone.id);

  return (
    <CounterChrome zoneName={zone.name} staffRole={staff.role} active="board">
      <ZoneBoard
        zoneId={zone.id}
        zoneName={zone.name}
        supervisionMode={zone.supervisionMode}
        initialRows={JSON.parse(JSON.stringify(rows))}
        serverNowIso={new Date().toISOString()}
      />
    </CounterChrome>
  );
}
