import crypto from "crypto";

/**
 * Generate a 7-day expiration timestamp from now.
 */
export function getInviteExpiresAt(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d;
}

/**
 * Token generation uses Prisma's @default(cuid()) on the field directly.
 * This helper is a fallback if we ever need to regenerate (e.g., resend
 * with rotated token).
 */
export function generateInviteToken(): string {
  return `mi_${crypto.randomBytes(20).toString("hex")}`;
}
