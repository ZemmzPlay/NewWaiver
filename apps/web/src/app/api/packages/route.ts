import { NextResponse } from 'next/server';
import { currentEvent, packageTiles } from '@/server/event';

export const dynamic = 'force-dynamic';

/** The zone tiles for the landing grid. Public; no personal data. */
export async function GET() {
  const event = await currentEvent();
  return NextResponse.json({ packages: await packageTiles(event.id) });
}
