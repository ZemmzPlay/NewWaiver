import { redirect } from 'next/navigation';
import { CounterChrome } from '@/components/counter/CounterChrome';
import { StaffAdmin } from '@/components/counter/StaffAdmin';
import { SupervisorGate } from '@/components/counter/SupervisorGate';
import { currentStaff, isSupervisor } from '@/server/auth';
import { activeZones, currentEvent } from '@/server/event';
import { listStaff } from '@/server/staff.js';

export const dynamic = 'force-dynamic';

/**
 * Create staff accounts and reset PINs. Same gate as the overview screen —
 * anyone who can watch the whole floor can also hand out PIN pad access or
 * take it away.
 */
export default async function AdminPage() {
  const staff = await currentStaff();
  if (!staff) redirect('/counter');

  const event = await currentEvent();
  const zones = await activeZones(event.id);
  const zone = zones.find((z) => z.id === staff.zoneId) ?? zones[0]!;

  if (!isSupervisor(staff)) {
    return (
      <CounterChrome zoneName={zone.name} staffRole={staff.role} active="admin">
        <SupervisorGate />
      </CounterChrome>
    );
  }

  const roster = await listStaff(event.id);

  return (
    <CounterChrome zoneName={zone.name} staffRole={staff.role} active="admin">
      <StaffAdmin initial={JSON.parse(JSON.stringify(roster))} zones={zones.map((z) => ({ id: z.id, name: z.name }))} />
    </CounterChrome>
  );
}
