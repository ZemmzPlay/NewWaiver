/**
 * The public status page shows first names only, and the sticker shows a first
 * name plus an initial, because a child's full name on their chest in a hall
 * full of strangers is the same exposure HARDWARE.md refuses for the guardian's
 * mobile number.
 */

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName.trim();
}

/**
 * "Layla A." — what goes on the sticker.
 *
 * Only for Latin names. Arabic has no convention of a single-letter initial,
 * and the first letter of an Arabic surname is very often the alif of the
 * definite article, so "نور المنصوري" would abbreviate to "نور ا." — which
 * reads as a typo rather than an initial. Arabic names get the first name
 * alone; the child code underneath is the identifier either way.
 */
export function stickerName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? fullName.trim();
  const rest = parts[1];
  if (!rest) return first;
  const initial = rest[0]!;
  if (!/[A-Za-z]/.test(initial)) return first;
  return `${first} ${initial.toUpperCase()}.`;
}

/**
 * The greeting line is built in the interface, not here.
 *
 * It used to live in this file as an English template, which meant the counter
 * card greeted an Arabic-speaking family in English no matter which language
 * the console was in. The wording now lives in the dictionary (`counter.greeting`)
 * and the list conjunction with it (`common.joinNames`), because joining names
 * is a language’s business: English takes "and", Arabic takes a waw that
 * attaches to the next word with no space.
 *
 * What is left here is the part that is language-independent.
 */
