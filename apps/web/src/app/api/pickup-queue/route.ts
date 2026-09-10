import { NextResponse } from 'next/server';
import { requireStaff } from '@/server/auth';
import { pickupQueue } from '@/server/sessions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  return NextResponse.json(
    { rows: await pickupQueue(), serverNowIso: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
