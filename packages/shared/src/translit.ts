/**
 * Best-effort Arabic to Latin romanisation, for the thermal sticker only.
 *
 * WHY THIS EXISTS
 *
 * A Zebra prints ZPL, and ZPL's built-in fonts are Latin. There is no Arabic
 * glyph set on the printer, and even with a downloaded TTF, ZPL has no complex
 * text shaping - Arabic letters would print in isolated forms, unjoined and in
 * the wrong order. A sticker with an Arabic name on it comes out blank or as a
 * row of boxes. The registration form is bilingual, so a good share of children
 * will have Arabic names: this is not an edge case.
 *
 * WHAT THIS IS NOT
 *
 * It is not a good romanisation. Arabic writes long vowels and omits short
 * ones, so an unvocalised name loses the sounds a reader supplies from
 * knowledge: Muhammad is written m-h-m-d and comes out "Mhmd". Names built on
 * long vowels survive well; names built on short ones do not.
 *
 * That is acceptable for what the sticker is for. HARDWARE.md is clear that it
 * exists for identification and a printed pickup time, and the authoritative
 * identifier on it is the child code, which is digits. The romanised name is so
 * a staffer can call something out; the code is what they type in. The counter
 * screen and the live status page always show the real name in the real script.
 *
 * THE PROPER FIX, when there is time: render the name to a monochrome bitmap
 * server-side with a shaping-capable text stack and send it as a ^GFA graphic.
 * That prints the actual Arabic. It needs a rasteriser this build has no room
 * for, and it is listed in the README as an open item.
 */

/** Long vowels and consonants. Short-vowel diacritics are dropped, not mapped. */
const MAP: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ٱ': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'j', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'dh', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'u', 'ي': 'i', 'ى': 'a', 'ة': 'a',
  'ء': '', 'ؤ': 'u', 'ئ': 'i',
  'پ': 'p', 'چ': 'ch', 'ژ': 'zh', 'ک': 'k', 'گ': 'g', 'ی': 'i',
};

/** Harakat, tanwin, shadda, sukun and tatweel. */
const DIACRITICS = /[ً-ْٰـۖ-ۭ]/g;

/** Arabic, Arabic Supplement, Extended-A and the presentation forms. */
const ARABIC = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;

export function hasArabic(value: string): boolean {
  return ARABIC.test(value);
}

/** True when the string contains anything a Latin thermal font cannot print. */
export function needsRomanising(value: string): boolean {
  // Latin-1 plus Latin Extended-A covers every accented name a Zebra can set.
  return /[^ -ɏ]/.test(value);
}

function romaniseWord(word: string): string {
  // The definite article is written alif-lam and romanises to a standalone
  // "Al", which is how these names are spelt in Latin on every Emirates ID in
  // the hall: "Al Mansoori", not "Almnsuri".
  const article = word.startsWith('ال') && word.length > 2;
  const body = article ? word.slice(2) : word;

  let out = '';
  for (const char of body) out += MAP[char] ?? (ARABIC.test(char) ? '' : char);
  const cased = out ? out[0]!.toUpperCase() + out.slice(1) : '';
  return article ? (cased ? `Al ${cased}` : 'Al') : cased;
}

export function romaniseArabic(value: string): string {
  return value
    .replace(DIACRITICS, '')
    .split(/\s+/)
    .map(romaniseWord)
    .filter(Boolean)
    .join(' ')
    .trim();
}

/**
 * What goes on a thermal label. Latin names pass through untouched; anything
 * else is romanised. If romanising leaves nothing, the caller gets an empty
 * string and should fall back to the child code, which is always printable.
 */
export function stickerSafeName(value: string): string {
  return needsRomanising(value) ? romaniseArabic(value) : value;
}
