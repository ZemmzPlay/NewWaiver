/**
 * UAE-first phone handling. Stored E.164, searched by last 9 digits
 * (DATA_MODEL: "Phone search normalises input to digits and matches the last 9").
 */

const UAE_CC = '971';

/** Digits only, no plus. */
export function digitsOf(input: string): string {
  return input.replace(/\D/g, '');
}

/**
 * Turns anything a guardian might type into E.164, assuming UAE when no
 * country code is present. Returns null when it cannot be sure.
 *
 * 0501234567 / 501234567 / +971 50 123 4567 / 00971501234567 all land on
 * +971501234567.
 */
export function toE164(input: string, defaultCountry = UAE_CC): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let digits = digitsOf(raw);
  if (!digits) return null;

  if (raw.startsWith('+')) return digits.length >= 8 ? `+${digits}` : null;
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith(defaultCountry) && digits.length > 9) {
    // already carries the country code without a plus
  } else if (digits.startsWith('0')) digits = defaultCountry + digits.slice(1);
  else if (digits.length === 9) digits = defaultCountry + digits;

  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

/** UAE mobiles are +9715XXXXXXXX. Anything else is allowed but not a UAE mobile. */
export function isUaeMobile(e164: string): boolean {
  return /^\+9715\d{8}$/.test(e164);
}

/** The last 9 digits, which is what the search index matches on. */
export function phoneTail(input: string): string {
  const digits = digitsOf(input);
  return digits.slice(-9);
}

/** +971501234567 -> 050 123 4567, for a staffer reading it off a screen. */
export function formatForDisplay(e164: string): string {
  if (isUaeMobile(e164)) {
    const local = `0${e164.slice(4)}`;
    return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
  }
  return e164;
}
