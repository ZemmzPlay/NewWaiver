import { describe, expect, it, vi } from 'vitest';
import { createLogger } from './log.js';

describe('hard rule 2: no child or guardian data in logs', () => {
  it('redacts anything that looks like a person', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    createLogger('test').info('checked in', {
      sessionId: 'abc', childName: 'Layla', guardianEmail: 'a@b.com', phone: '+971501234567', ageYears: 6,
    });
    const line = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(line.sessionId).toBe('abc');
    expect(line.childName).toBe('[redacted]');
    expect(line.guardianEmail).toBe('[redacted]');
    expect(line.phone).toBe('[redacted]');
    expect(line.ageYears).toBe('[redacted]');
    spy.mockRestore();
  });
});
