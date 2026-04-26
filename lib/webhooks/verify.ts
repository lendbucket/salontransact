import { createHash, timingSafeEqual } from "crypto";

/**
 * Compare the secret from the Payroc-Secret header with our stored secret
 * using a timing-safe equality check.
 *
 * If either string is empty or they have different lengths, returns false
 * without leaking timing info.
 */
export function verifyPayrocSecret(
  receivedSecret: string | null | undefined,
  expectedSecret: string | null | undefined
): boolean {
  if (!receivedSecret || !expectedSecret) return false;
  if (receivedSecret.length !== expectedSecret.length) {
    // Still do a constant-time compare on a hash so timing doesn't reveal length
    const hashA = createHash("sha256").update(receivedSecret).digest();
    const hashB = createHash("sha256").update(expectedSecret).digest();
    timingSafeEqual(hashA, hashB);
    return false;
  }
  return timingSafeEqual(
    Buffer.from(receivedSecret, "utf8"),
    Buffer.from(expectedSecret, "utf8")
  );
}

/**
 * Reject events whose `time` field is more than the given window in the past.
 * Weak protection against replay attacks since Payroc controls the time field,
 * but raises the bar for an attacker replaying intercepted events.
 */
export function isWithinTimeWindow(
  eventTime: string | null | undefined,
  windowMs: number = 10 * 60 * 1000
): boolean {
  if (!eventTime) return false;
  const t = new Date(eventTime).getTime();
  if (!Number.isFinite(t)) return false;
  const now = Date.now();
  return Math.abs(now - t) <= windowMs;
}
