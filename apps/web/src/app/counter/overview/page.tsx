import { redirect } from 'next/navigation';
import { CounterChrome } from '@/components/counter/CounterChrome';
import { Overview } from '@/components/counter/Overview';
import { SupervisorGate } from '@/components/counter/SupervisorGate';
import { currentStaff, isSupervisor } from '@/server/auth';
import { activeZones, currentEvent } from '@/server/event';
import { overview } from '@/server/overview';

export const dynamic = 'force-dynamic';

/**
 * The whole floor on one screen. Supervisors and admins only — it shows every
 * child in the building, which is more than a counter staffer needs and more
 * than should sit unattended on a shared laptop.
 */
export default async function OverviewPage() {
  const staff = await currentStaff();
  if (!staff) redirect('/counter');

  const event = await currentEvent();
  const zones = await activeZones(event.id);
  const zone = zones.find((z) => z.id === staff.zoneId) ?? zones[0]!;

  if (!isSupervisor(staff)) {
    return (
      <CounterChrome zoneName={zone.name} staffRole={staff.role} active="overview">
        <SupervisorGate />
      </CounterChrome>
    );
  }

  const data = await overview();

  return (
    <CounterChrome zoneName={zone.name} staffRole={staff.role} active="overview">
      <Overview initial={JSON.parse(JSON.stringify(data))} />
    </CounterChrome>
  );
}
