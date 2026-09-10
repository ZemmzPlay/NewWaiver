import { NextResponse } from 'next/server';
import { activeWaiver, currentEvent } from '@/server/event';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const locale = new URL(request.url).searchParams.get('locale') ?? 'en';
  const event = await currentEvent();
  try {
    const waiver = await activeWaiver(event.id, locale);
    return NextResponse.json({
      id: waiver.id, locale: waiver.locale, version: waiver.version,
      title: waiver.title, bodyMd: waiver.bodyMd, publishedAt: waiver.publishedAt,
    });
  } catch {
    // Arabic is cut for this event; the route stays so adding a locale is seed
    // data rather than a code change.
    return NextResponse.json({ error: 'no_waiver_for_locale' }, { status: 404 });
  }
}
