/**
 * Email is the alert channel, so PRD s3 asks for three things: an inline format
 * check, a common-typo correction pass, and a confirm-by-retype on the field.
 * The first two live here; the retype lives in the form.
 *
 * A wrong address caught at 14:32 is fixable, caught at 15:27 it isn't.
 */

/** Deliberately stricter than the RFC: no quoted locals, no IP literals, one @. */
const SHAPE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** Domains a guardian at a comic con is overwhelmingly likely to have meant. */
const KNOWN_DOMAINS = [
  'gmail.com', 'googlemail.com', 'hotmail.com', 'outlook.com', 'live.com',
  'yahoo.com', 'icloud.com', 'me.com', 'protonmail.com', 'aol.com',
  'emirates.net.ae', 'eim.ae', 'etisalat.ae', 'du.ae',
];

/** Typos frequent enough to correct by lookup rather than by distance. */
const EXPLICIT_FIXES: Record<string, string> = {
  'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com', 'gmailcom': 'gmail.com', 'gmaill.com': 'gmail.com',
  'gnail.com': 'gmail.com', 'gmail.comm': 'gmail.com', 'gmail.cm': 'gmail.com',
  'hotmial.com': 'hotmail.com', 'hotmil.com': 'hotmail.com', 'hotmai.com': 'hotmail.com',
  'hotmail.co': 'hotmail.com', 'hotmail.con': 'hotmail.com',
  'yaho.com': 'yahoo.com', 'yahooo.com': 'yahoo.com', 'yahoo.co': 'yahoo.com',
  'yhaoo.com': 'yahoo.com', 'yahoo.con': 'yahoo.com',
  'outlook.co': 'outlook.com', 'outloo.com': 'outlook.com', 'outlok.com': 'outlook.com',
  'iclod.com': 'icloud.com', 'icloud.co': 'icloud.com', 'iclould.com': 'icloud.com',
  'live.co': 'live.com', 'hotmall.com': 'hotmail.com',
};

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  let prev = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i += 1) {
    const curr = [i];
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[cols - 1]!;
}

export function normaliseEmail(input: string): string {
  // Trim only. Stripping interior spaces would quietly turn a genuine typo
  // into a valid-looking address we then send the 5-minute warning to.
  return input.trim().toLowerCase();
}

export function isEmailShapeValid(input: string): boolean {
  const value = normaliseEmail(input);
  if (value.length > 254) return false;
  const [local] = value.split('@');
  if (!local || local.length > 64) return false;
  if (value.includes('..')) return false;
  return SHAPE.test(value);
}

/**
 * Returns the address we think they meant, or null when the one they typed
 * looks fine. Never rewrites silently - the UI offers it as "Did you mean".
 */
export function suggestEmailCorrection(input: string): string | null {
  const value = normaliseEmail(input);
  const at = value.lastIndexOf('@');
  if (at < 1) return null;
  const local = value.slice(0, at);
  const typed = value.slice(at + 1);
  if (!typed) return null;
  // `fatima@gmial` is a dropped TLD on top of a transposition. Assume .com
  // for matching, which is what the guardian meant in every observed case.
  const domain = typed.includes('.') ? typed : `${typed}.com`;

  const explicit = EXPLICIT_FIXES[domain];
  if (explicit) return `${local}@${explicit}`;

  if (KNOWN_DOMAINS.includes(domain)) return null;

  let best: { domain: string; distance: number } | null = null;
  for (const candidate of KNOWN_DOMAINS) {
    const distance = levenshtein(domain, candidate);
    if (distance <= 2 && (!best || distance < best.distance)) best = { domain: candidate, distance };
  }
  return best ? `${local}@${best.domain}` : null;
}

export type EmailCheck =
  | { ok: true; value: string; suggestion: string | null }
  | { ok: false; reason: string; suggestion: string | null };

export function checkEmail(input: string): EmailCheck {
  const value = normaliseEmail(input);
  if (!value) return { ok: false, reason: 'Enter an email address.', suggestion: null };
  const suggestion = suggestEmailCorrection(value);
  if (!isEmailShapeValid(value)) {
    return { ok: false, reason: "That doesn't look like an email address.", suggestion };
  }
  return { ok: true, value, suggestion };
}
