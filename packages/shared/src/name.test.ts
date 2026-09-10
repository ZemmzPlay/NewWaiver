import { describe, expect, it } from 'vitest';
import { firstName, stickerName } from './name.js';

describe('names', () => {
  it('takes the first name for the public page', () => {
    expect(firstName('Layla Al Mansoori')).toBe('Layla');
    expect(firstName('  Omar ')).toBe('Omar');
  });

  it('puts a first name and an initial on the sticker', () => {
    expect(stickerName('Layla Al Mansoori')).toBe('Layla A.');
    expect(stickerName('Omar')).toBe('Omar');
    // Arabic gets the first name alone — an isolated alif is not an initial.
    expect(stickerName('نور المنصوري')).toBe('نور');
  });

});
