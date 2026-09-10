/**
 * Operational constants. Anything an operator might want to change on the day
 * lives in seed data instead; this file holds only what the code depends on.
 */

/** Alert fires this many minutes before a session ends. PRD s6. */
export const WARN_LEAD_MINUTES = 5;

/** A session becomes `overdue` this long after it ends. PRD s5 [ASSUMPTION]. */
export const OVERDUE_GRACE_MINUTES = 5;

/** Pickup card escalates to red after this many failed attempts. PRD s5. */
export const PICKUP_ESCALATE_ATTEMPTS = 3;

/** ...or after this many minutes in the queue, whichever comes first. */
export const PICKUP_ESCALATE_MINUTES = 30;

/** Worker tick. DATA_MODEL "worker ticks every 20 seconds". */
export const WORKER_TICK_MS = 20_000;

/** Live status page poll interval. DATA_MODEL "polls every 15s". */
export const STATUS_POLL_MS = 15_000;

/** Age chips on the children step. PRD s3 step 4: a single row of 1-14. */
export const AGE_CHIPS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] as const;

/** Statuses that count as a child being inside a zone right now. */
export const LIVE_SESSION_STATUSES = ['active', 'warned', 'expired', 'overdue'] as const;

export const DISPLAY_TIMEZONE = 'Asia/Dubai';
