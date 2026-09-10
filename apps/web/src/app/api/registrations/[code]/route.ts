import { NextResponse } from 'next/server';
import { normaliseRegistrationCode } from '@carnival/shared';
import { requireStaff } from '@/server/auth';
import { familyCard } from '@/server/search';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const { code: raw } = await params;
  const code = normaliseRegistrationCode(raw);
  if (!code) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const card = await familyCard(code);
  if (!card) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(card, { headers: { 'Cache-Control': 'no-store' } });
}
