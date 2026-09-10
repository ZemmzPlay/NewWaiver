import { describe, expect, it } from 'vitest';
import { dubaiTime, formatCountdown, humanRelative, overdueParts, sessionSchedule } from './time.js';

describe('display in Asia/Dubai, store in UTC', () => {
  it('renders 11:32Z as 15:32 Dubai', () => {
    expect(dubaiTime(new Date('2026-09-11T11:32:00Z'))).toBe('15:32');
  });

  it('derives warn and overdue from the end time', () => {
    const start = new Date('2026-09-11T11:00:00Z');
    const s = sessionSchedule(start, 30);
    expect(s.endsAt.toISOString()).toBe('2026-09-11T11:30:00.000Z');
    expect(s.warnAt.toISOString()).toBe('2026-09-11T11:25:00.000Z');
    expect(s.overdueAt.toISOString()).toBe('2026-09-11T11:35:00.000Z');
  });

  it('counts down and then up', () => {
    expect(formatCountdown(245_000)).toBe('4:05');
    expect(formatCountdown(-133_000)).toBe('-2:13');
  });

  it('rolls over to hours instead of running to four digits of minutes', () => {
    // A session left open overnight used to render as "-1227:01".
    expect(formatCountdown(-73_621_000)).toBe('-20:27:01');
    expect(formatCountdown(3_600_000)).toBe('1:00:00');
    expect(formatCountdown(59_000)).toBe('0:59');
  });

  it('labels an overdue duration in the unit it is actually in', () => {
    expect(overdueParts(0)).toEqual({ value: '0', unit: 'minutes' });
    expect(overdueParts(45)).toEqual({ value: '45', unit: 'minutes' });
    expect(overdueParts(59)).toEqual({ value: '59', unit: 'minutes' });
    expect(overdueParts(60)).toEqual({ value: '1:00', unit: 'hours' });
    expect(overdueParts(97)).toEqual({ value: '1:37', unit: 'hours' });
    expect(overdueParts(1227)).toEqual({ value: '20:27', unit: 'hours' });
  });

  it('reads the way a staffer would say it', () => {
    const now = new Date('2026-09-11T11:00:00Z');
    expect(humanRelative(new Date('2026-09-11T11:04:00Z'), now)).toBe('in 4 min');
    expect(humanRelative(new Date('2026-09-11T10:48:00Z'), now)).toBe('12 min over');
  });
});
