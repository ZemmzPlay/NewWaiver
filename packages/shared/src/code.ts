/**
 * Registration codes.
 *
 * These were Crockford base32 (`R-7K2M`). They are now **six digits, grouped
 * three and three**: `482 109`.
 *
 * The reason is the hall. ADNEC on a comic con weekend is loud, and the people
 * saying this code to each other are a Filipino staffer, an Egyptian parent and
 * a British child in the space of one minute. Letters are where that breaks:
 * "M" and "N", "F" and "S", "K" and "Q" survive almost no accent plus 85 dB of
 * crowd. Digits do not have that problem — every one of them is a distinct word
 * in every accent, they are the one thing everybody already recites over a bad
 * phone line, and they type on a numeric keypad without a keyboard.
 *
 * Six digits is a million codes, which is far more than a three-day event needs
 * and keeps the retry loop in `registration.ts` from ever spinning.
 */

const CODE_LENGTH = 6;

/**
 * Web Crypto rather than node:crypto, because this module is imported by client
 * components through the package barrel and webpack cannot bundle a `node:`
 * scheme. Rejection sampling keeps the digits uniform: 250 is the largest
 * multiple of 10 below 256, so any byte at or above it is redrawn.
 */
export function mintRegistrationCode(): string {
  let body = '';
  while (body.length < CODE_LENGTH) {
    const bytes = new Uint8Array(CODE_LENGTH);
    globalThis.crypto.getRandomValues(bytes);
    for (const byte of bytes) {
      if (byte >= 250 || body.length === CODE_LENGTH) continue;
      body += String(byte % 10);
    }
  }
  return body;
}

/**
 * Normalises whatever a staffer or guardian typed into the canonical form.
 *
 * Accepts `482109`, `482 109`, `482-109`, and — because the codes used to have
 * one and people will have written it down — a leading `R-`.
 */
export function normaliseRegistrationCode(input: string): string | null {
  const digits = input.replace(/\D/g, '');
  return digits.length === CODE_LENGTH ? digits : null;
}

/** `482 109` — how it is shown on screen, said aloud, and printed. */
export function formatRegistrationCode(code: string): string {
  const digits = code.replace(/\D/g, '');
  if (digits.length !== CODE_LENGTH) return code;
  return `${digits.slice(0, 3)} ${digits.slice(3)}`;
}

/** `child_code` = `{registration.code}-{seq}`. DATA_MODEL, children. */
export function childCode(registrationCode: string, seq: number): string {
  return `${registrationCode}-${seq}`;
}

/** Splits `482109-1` back into its parts. Returns null for anything else. */
export function parseChildCode(input: string): { code: string; seq: number } | null {
  const match = input.trim().match(/^[Rr]?-?\s*(\d{3}\s?\d{3})\s*-\s*(\d{1,2})$/);
  if (!match) return null;
  const code = normaliseRegistrationCode(match[1]!);
  if (!code) return null;
  return { code, seq: Number(match[2]) };
}
