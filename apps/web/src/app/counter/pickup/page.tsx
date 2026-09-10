import { redirect } from 'next/navigation';
import { CounterChrome } from '@/components/counter/CounterChrome';
import { PickupQueue } from '@/components/counter/PickupQueue';
import { currentStaff } from '@/server/auth';
import { activeZones, currentEvent } from '@/server/event';
import { pickupQueue } from '@/server/sessions';

export const dynamic = 'force-dynamic';

/**
 * "This queue is the reason to build the system, not a side feature. It should
 * be the clearest screen in the product." PRD s5.
 */
export default async function PickupPage() {
  const staff = await currentStaff();
  if (!staff) redirect('/counter');

  const event = await currentEvent();
  const zones = await activeZones(event.id);
  const zone = zones.find((z) => z.id === staff.zoneId) ?? zones[0]!;
  const rows = await pickupQueue();

  return (
    <CounterChrome zoneName={zone.name} staffRole={staff.role} active="pickup">
      <PickupQueue initialRows={JSON.parse(JSON.stringify(rows))} serverNowIso={new Date().toISOString()} />
    </CounterChrome>
  );
}
