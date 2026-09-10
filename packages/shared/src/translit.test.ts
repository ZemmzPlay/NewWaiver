import { describe, expect, it } from 'vitest';
import { hasArabic, needsRomanising, romaniseArabic, stickerSafeName } from './translit.js';

const NUR = 'نور';                      // Nur
const SARA = 'سارة';               // Sara
const FATIMA = 'فاطمة';       // Fatima
const MUHAMMAD = 'محمد';           // Muhammad, unvocalised
const MUHAMMAD_VOWELLED = 'مُحَمَّد';
const ALI = 'علي';                      // Ali
const MANSOORI = 'المنصوري';       // Al Mansoori

describe('sticker romanisation', () => {
  it('leaves Latin names exactly as they are', () => {
    expect(stickerSafeName('Layla Al Mansoori')).toBe('Layla Al Mansoori');
    expect(needsRomanising('Layla')).toBe(false);
    // An accented Latin name is still printable on a Zebra.
    expect(needsRomanising('Zoë')).toBe(false);
  });

  it('romanises the long-vowel names it handles well', () => {
    expect(romaniseArabic(NUR)).toBe('Nur');
    expect(romaniseArabic(SARA)).toBe('Sara');
    expect(romaniseArabic(FATIMA)).toBe('Fatma');
  });

  it('romanises the definite article the way an Emirates ID spells it', () => {
    expect(romaniseArabic(NUR + ' ' + MANSOORI)).toBe('Nur Al Mnsuri');
  });

  it('drops diacritics rather than transliterating them', () => {
    expect(romaniseArabic(MUHAMMAD_VOWELLED)).toBe(romaniseArabic(MUHAMMAD));
  });

  it('never returns a character a Zebra cannot set', () => {
    for (const name of [NUR, SARA, FATIMA, MUHAMMAD, ALI]) {
      expect(needsRomanising(stickerSafeName(name)), name).toBe(false);
    }
  });

  it('detects Arabic anywhere in the string', () => {
    expect(hasArabic('Ali ' + ALI)).toBe(true);
    expect(hasArabic('Ali')).toBe(false);
    // Mixed scripts still need romanising, or half the name vanishes.
    expect(needsRomanising('Ali ' + ALI)).toBe(true);
  });
});
