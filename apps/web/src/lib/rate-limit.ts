/**
 * A staff PIN is 4-8 digits with no lockout — a small search space, scriptable
 * from anyone who can reach the counter console. This is the lockout.
 *
 * In-memory, keyed by IP: a single web process is enough for one venue
 * counter — no shared cache needed, and a restart clearing it is an
 * acceptable, rare edge rather than a gap.
 */

interface Bucket { failures: number; lockedUntil: number }
const buckets = new Map<string, Bucket>();

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000;

export function isLockedOut(key: string): boolean {
  const bucket = buckets.get(key);
  return bucket !== undefined && bucket.lockedUntil > Date.now();
}

export function recordFailure(key: string): void {
  const bucket = buckets.get(key) ?? { failures: 0, lockedUntil: 0 };
  bucket.failures += 1;
  if (bucket.failures >= MAX_ATTEMPTS) {
    bucket.lockedUntil = Date.now() + LOCKOUT_MS;
    bucket.failures = 0;
  }
  buckets.set(key, bucket);
}

export function recordSuccess(key: string): void {
  buckets.delete(key);
}
