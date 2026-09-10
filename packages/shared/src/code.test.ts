import { describe, expect, it } from 'vitest';
import {
  childCode, formatRegistrationCode, mintRegistrationCode, normaliseRegistrationCode, parseChildCode,
} from './code.js';

describe('registration codes', () => {
  it('mints six digits and nothing else', () => {
    for (let i = 0; i < 500; i += 1) {
      expect(mintRegistrationCode()).toMatch(/^\d{6}$/);
    }
  });

  it('draws every digit, so the space is not quietly smaller than it looks', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 400; i += 1) for (const d of mintRegistrationCode()) seen.add(d);
    expect(seen.size).toBe(10);
  });

  it('reads back whatever a staffer typed', () => {
    for (const input of ['482109', '482 109', '482-109', ' 482  109 ', 'R-482109']) {
      expect(normaliseRegistrationCode(input), input).toBe('482109');
    }
  });

  it('rejects the wrong length', () => {
    expect(normaliseRegistrationCode('48210')).toBeNull();
    expect(normaliseRegistrationCode('4821090')).toBeNull();
    expect(normaliseRegistrationCode('')).toBeNull();
  });

  it('groups three and three for saying out loud', () => {
    expect(formatRegistrationCode('482109')).toBe('482 109');
  });

  it('round-trips a child code', () => {
    expect(childCode('482109', 1)).toBe('482109-1');
    expect(parseChildCode('482109-2')).toEqual({ code: '482109', seq: 2 });
    expect(parseChildCode('482 109-2')).toEqual({ code: '482109', seq: 2 });
    expect(parseChildCode('482109')).toBeNull();
  });
});
