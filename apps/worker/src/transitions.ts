import { db } from '@carnival/db';
import { OVERDUE_GRACE_MINUTES } from '@carnival/shared';

/**
 * The session lifecycle from DATA_MODEL.md, one step per transaction:
 *
 *   active  --warn_at reached, alert claimed + sent--> warned
 *   warned  --ends_at reached-------------------------> expired
 *   expired --ends_at + grace-------------------------> overdue  (pickup queue)
 *
 * Each step is a single conditional UPDATE, so a second worker running the same
 * tick moves nothing twice and the two never disagree about a session's state.
 */

export interface TransitionCounts {
  warned: number;
  expired: number;
  overdue: number;
}

export async function advanceSessions(): Promise<TransitionCounts> {
  const now = new Date();

  // The warning notification is claimed and sent in the step before this one,
  // so by the time a session reaches warn_at here the email has gone out.
  const warned = await db.session.updateMany({
    where: { status: 'active', warnAt: { lte: now } },
    data: { status: 'warned' },
  });

  const expired = await db.session.updateMany({
    where: { status: { in: ['active', 'warned'] }, endsAt: { lte: now } },
    data: { status: 'expired' },
  });

  // PRD s5 [ASSUMPTION]: ends_at + grace (OVERDUE_GRACE_MINUTES). Shared so the
  // status page, the board and the worker all mean the same thing by "overdue".
  const overdue = await db.session.updateMany({
    where: { status: 'expired', endsAt: { lte: new Date(now.getTime() - OVERDUE_GRACE_MINUTES * 60_000) } },
    data: { status: 'overdue' },
  });

  return { warned: warned.count, expired: expired.count, overdue: overdue.count };
}
