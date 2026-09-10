import { CheckInConsole } from '@/components/counter/CheckInConsole';
import { CounterChrome } from '@/components/counter/CounterChrome';
import { PinPad } from '@/components/counter/PinPad';
import { currentStaff } from '@/server/auth';
import { activeZones, currentEvent } from '@/server/event';

export const dynamic = 'force-dynamic';

/** The counter console is pinned to one zone. The staffer unlocks with a PIN. */
export default async function CounterPage() {
  const event = await currentEvent();
  const zones = await activeZones(event.id);
  const staff = await currentStaff();

  if (!staff) return <PinPad zones={zones.map((zone) => ({ id: zone.id, name: zone.name }))} />;

  const zone = zones.find((z) => z.id === staff.zoneId) ?? zones[0]!;
  const options = zones.map((z) => ({
    id: z.id,
    name: z.name,
    supervisionMode: z.supervisionMode,
    packages: z.packages.map((pkg) => ({ id: pkg.id, minutes: pkg.minutes })),
  }));

  return (
    <CounterChrome
      zoneName={zone.name}
      staffRole={staff.role}
      active="check-in"
    >
      <CheckInConsole
        zone={options.find((z) => z.id === zone.id)!}
        zones={options}
      />
    </CounterChrome>
  );
}
