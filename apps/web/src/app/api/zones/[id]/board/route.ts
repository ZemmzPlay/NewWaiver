import { NextResponse } from 'next/server';
import { isSupervisor, requireStaff } from '@/server/auth';
import { zoneBoard } from '@/server/sessions';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let session;
  try {
    session = await requireStaff();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }
  const { id } = await params;
  // A staffer is pinned to one zone for a reason — the board for a zone
  // they aren't signed in at shows other children's names, ages and medical
  // notes, so only a supervisor gets to look at a zone that isn't theirs.
  if (session.zoneId !== id && !isSupervisor(session)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return NextResponse.json(
    { rows: await zoneBoard(id), serverNowIso: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
