import { NextResponse } from 'next/server';
import { searchInput } from '@carnival/shared';
import { requireStaff } from '@/server/auth';
import { search } from '@/server/search';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const url = new URL(request.url);
  const parsed = searchInput.safeParse({ q: url.searchParams.get('q') ?? '' });
  if (!parsed.success) return NextResponse.json({ results: [] });

  const results = await search(parsed.data.q);
  return NextResponse.json({ results }, { headers: { 'Cache-Control': 'no-store' } });
}
