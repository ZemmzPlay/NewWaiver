/**
 * Hard rule 3: UTC in the database, always. Display in Asia/Dubai.
 *
 * Every Date that crosses a boundary is an absolute instant. Nothing in this
 * file constructs a wall-clock time; it only renders one.
 */

import { DISPLAY_TIMEZONE, OVERDUE_GRACE_MINUTES, WARN_LEAD_MINUTES } from './constants.js';

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: false,
});

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  timeZone: DISPLAY_TIMEZONE, day: 'numeric', month: 'short',
  hour: '2-digit', minute: '2-digit', hour12: false,
});

/** 15:32 - the form the sticker and every staff screen uses. */
export function dubaiTime(instant: Date): string {
  return timeFormat.format(instant);
}

/** 11 Sep, 15:32 - for anything that might span a day boundary. */
export function dubaiDateTime(instant: Date): string {
  return dateTimeFormat.format(instant);
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * 60_000);
}

/** The three instants a session is born with. */
export function sessionSchedule(startedAt: Date, minutes: number) {
  const endsAt = addMinutes(startedAt, minutes);
  return {
    startedAt,
    endsAt,
    warnAt: addMinutes(endsAt, -WARN_LEAD_MINUTES),
    overdueAt: addMinutes(endsAt, OVERDUE_GRACE_MINUTES),
  };
}

/** Signed whole minutes from now to `instant`; negative once it has passed. */
export function minutesUntil(instant: Date, now: Date = new Date()): number {
  return Math.round((instant.getTime() - now.getTime()) / 60_000);
}

/** Whole minutes since `instant`, floored at zero. */
export function minutesSince(instant: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - instant.getTime()) / 60_000));
}

/**
 * 4:05 / -2:13 / -1:20:27. The countdown on the status page and the boards.
 *
 * Rolls over to hours past sixty minutes. A session nobody closed overnight was
 * rendering as "-1227:01", which is not a duration anybody can read — and it is
 * exactly the row a supervisor most needs to understand at a glance.
 */
export function formatCountdown(msRemaining: number): string {
  const negative = msRemaining < 0;
  const total = Math.floor(Math.abs(msRemaining) / 1000);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const sign = negative ? '-' : '';
  if (hours > 0) return `${sign}${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return `${sign}${mins}:${String(secs).padStart(2, '0')}`;
}

/**
 * How long a child has been overdue, split into the number and which unit it
 * is in, so the caller can label it in its own language.
 *
 * Under an hour it stays in whole minutes, which is what the pickup queue is
 * counting and what a staffer says on the phone. Past that it becomes h:mm,
 * because "97" tells a supervisor much less than "1:37".
 */
export function overdueParts(minutes: number): { value: string; unit: 'minutes' | 'hours' } {
  if (minutes < 60) return { value: String(minutes), unit: 'minutes' };
  const hours = Math.floor(minutes / 60);
  return { value: `${hours}:${String(minutes % 60).padStart(2, '0')}`, unit: 'hours' };
}

/** "12 min over" / "in 4 min" - for a staffer skimming a queue. */
export function humanRelative(instant: Date, now: Date = new Date()): string {
  const mins = minutesUntil(instant, now);
  if (mins > 1) return `in ${mins} min`;
  if (mins === 1) return 'in 1 min';
  if (mins === 0) return 'now';
  if (mins === -1) return '1 min over';
  return `${Math.abs(mins)} min over`;
}
