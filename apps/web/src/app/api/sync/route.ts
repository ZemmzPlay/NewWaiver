import { NextResponse } from 'next/server';
import { createLogger, syncInput } from '@carnival/shared';
import { requireStaff } from '@/server/auth';
import { startSessions } from '@/server/sessions';

export const dynamic = 'force-dynamic';

const log = createLogger('api:sync');

/**
 * Batched replay.
 *
 * The offline PWA and its sync queue are cut for this event (BUILD_PLAN), but
 * every session write already carries a client-generated UUID and is safe to
 * replay, so this endpoint exists and works. If a counter ever queues writes —
 * by hand, from a log, or from the PWA when it is built — this is where they
 * come back in, and the unique index on client_uuid makes a double replay a
 * no-op rather than a second session.
 */
export async function POST(request: Request) {
  let staffId: string;
  try {
    staffId = (await requireStaff()).staffId;
  } catch {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const parsed = syncInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const applied: string[] = [];
  const failed: { registrationId: string; reason: string }[] = [];

  for (const batch of parsed.data.sessions) {
    try {
      const started = await startSessions(batch, staffId);
      applied.push(...started.map((session) => session.sessionId));
    } catch (error) {
      failed.push({
        registrationId: batch.registrationId,
        reason: error instanceof Error ? error.message : 'unknown',
      });
    }
  }

  log.info('sync applied', { staffId, applied: applied.length, failed: failed.length });
  return NextResponse.json({ applied, failed });
}
