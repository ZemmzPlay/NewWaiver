import { NextResponse } from 'next/server';
import { normaliseRegistrationCode } from '@carnival/shared';
import { currentLocale } from '@/lib/locale-server';
import { statusForCode } from '@/server/status';

export const dynamic = 'force-dynamic';

/** Polled every 15 seconds by the live status page. */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: raw } = await params;
  const code = normaliseRegistrationCode(raw);
  if (!code) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const payload = await statusForCode(code, await currentLocale());
  if (!payload) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
