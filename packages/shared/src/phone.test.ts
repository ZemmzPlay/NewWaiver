import { describe, expect, it } from 'vitest';
import { formatForDisplay, isUaeMobile, phoneTail, toE164 } from './phone.js';

describe('UAE-first E.164', () => {
  it('lands every local form on the same number', () => {
    for (const input of ['0501234567', '050 123 4567', '+971 50 123 4567', '00971501234567', '971501234567', '501234567']) {
      expect(toE164(input), input).toBe('+971501234567');
    }
  });

  it('keeps a foreign number the guardian typed with a plus', () => {
    expect(toE164('+96550123456')).toBe('+96550123456');
  });

  it('refuses what it cannot be sure about', () => {
    expect(toE164('')).toBeNull();
    expect(toE164('12345')).toBeNull();
  });

  it('matches search on the last nine digits', () => {
    expect(phoneTail('050 123 4567')).toBe('501234567');
    expect(phoneTail('+971501234567')).toBe('501234567');
  });

  it('shows a staffer the local form', () => {
    expect(isUaeMobile('+971501234567')).toBe(true);
    expect(formatForDisplay('+971501234567')).toBe('050 123 4567');
  });
});
