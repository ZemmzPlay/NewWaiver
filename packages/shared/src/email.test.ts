import { describe, expect, it } from 'vitest';
import { checkEmail, isEmailShapeValid, suggestEmailCorrection } from './email.js';

describe('email shape', () => {
  it('accepts ordinary addresses', () => {
    expect(isEmailShapeValid('fatima@gmail.com')).toBe(true);
    expect(isEmailShapeValid('  Fatima.A+carnival@Outlook.com ')).toBe(true);
  });

  it('rejects the shapes that reach us as typos', () => {
    for (const bad of ['fatima', 'fatima@', '@gmail.com', 'fatima@gmail', 'a@b..com', 'a b@gmail.com']) {
      expect(isEmailShapeValid(bad), bad).toBe(false);
    }
  });
});

describe('typo correction', () => {
  it('fixes the three named in the PRD', () => {
    expect(suggestEmailCorrection('a@gmial.com')).toBe('a@gmail.com');
    expect(suggestEmailCorrection('a@hotmial.com')).toBe('a@hotmail.com');
    expect(suggestEmailCorrection('a@yaho.com')).toBe('a@yahoo.com');
  });

  it('catches near misses by distance', () => {
    expect(suggestEmailCorrection('a@gmail.cmo')).toBe('a@gmail.com');
    expect(suggestEmailCorrection('a@icloud.cm')).toBe('a@icloud.com');
  });

  it('leaves correct and unknown-but-plausible domains alone', () => {
    expect(suggestEmailCorrection('a@gmail.com')).toBeNull();
    expect(suggestEmailCorrection('a@zawaya.me')).toBeNull();
  });

  it('still suggests when the shape is broken', () => {
    const result = checkEmail('fatima@gmial');
    expect(result.ok).toBe(false);
    expect(result.suggestion).toBe('fatima@gmail.com');
  });
});
