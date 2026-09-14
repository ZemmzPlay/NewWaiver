import { redirect } from 'next/navigation';
import { CounterChrome } from '@/components/counter/CounterChrome';
import { SupervisorGate } from '@/components/counter/SupervisorGate';
import { UsersTable } from '@/components/counter/UsersTable';
import { currentStaff, isSupervisor } from '@/server/auth';
import { activeZones, currentEvent } from '@/server/event';
import { listRegisteredUsers } from '@/server/users';

export const dynamic = 'force-dynamic';

/**
 * Full registration roster for supervisors and admins. Same gate as overview —
 * this is every family's contact detail for the event.
 */
export default async function UsersPage() {
  const staff = await currentStaff();
  if (!staff) redirect('/counter');

  const event = await currentEvent();
  const zones = await activeZones(event.id);
  const zone = zones.find((z) => z.id === staff.zoneId) ?? zones[0]!;

  if (!isSupervisor(staff)) {
    return (
      <CounterChrome zoneName={zone.name} staffRole={staff.role} active="users">
        <SupervisorGate />
      </CounterChrome>
    );
  }

  const users = await listRegisteredUsers();

  return (
    <CounterChrome zoneName={zone.name} staffRole={staff.role} active="users">
      <UsersTable initial={JSON.parse(JSON.stringify(users))} />
    </CounterChrome>
  );
}
