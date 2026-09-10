import { describe, expect, it } from 'vitest';
import { OVERDUE_GRACE_MINUTES, WARN_LEAD_MINUTES, sessionSchedule } from '@carnival/shared';

/**
 * The transitions themselves are single conditional UPDATEs against Postgres,
 * so they are covered by the two-minute lifecycle run in BUILD_PLAN's Thursday
 * gate rather than by a unit test with a fake database. What is worth pinning
 * here is the arithmetic every one of them depends on.
 */
describe('session schedule', () => {
  it('puts the warning five minutes before the end and overdue ten after', () => {
    const start = new Date('2026-09-11T11:00:00Z');
    const schedule = sessionSchedule(start, 15);
    expect((schedule.endsAt.getTime() - start.getTime()) / 60_000).toBe(15);
    expect((schedule.endsAt.getTime() - schedule.warnAt.getTime()) / 60_000).toBe(WARN_LEAD_MINUTES);
    expect((schedule.overdueAt.getTime() - schedule.endsAt.getTime()) / 60_000).toBe(OVERDUE_GRACE_MINUTES);
  });

  it('still warns on a session shorter than the warning lead', () => {
    // A 2-minute test session at rehearsal: warn_at lands before started_at, so
    // the worker sends it on the first tick rather than never.
    const start = new Date('2026-09-11T11:00:00Z');
    const schedule = sessionSchedule(start, 2);
    expect(schedule.warnAt.getTime()).toBeLessThan(start.getTime());
  });
});
