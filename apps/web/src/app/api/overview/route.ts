import { NextResponse } from 'next/server';
import { requireSupervisor } from '@/server/auth';
import { overview } from '@/server/overview';

export const dynamic = 'force-dynamic';

/** Polled every 10 seconds by the overview screen. */
export async function GET() {
  try {
    await requireSupervisor();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  return NextResponse.json(await overview(), { headers: { 'Cache-Control': 'no-store' } });
}
