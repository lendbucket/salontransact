import crypto from "crypto";

/**
 * Generate a secure webhook signing secret.
 *
 * Format: whsec_<32 hex chars>
 *
 * The secret is used by the receiver to verify HMAC-SHA256 signatures on
 * webhook payloads. The signature is sent in the X-SalonTransact-Signature
 * header on outbound webhook requests.
 */
export function generateWebhookSecret(): string {
  const randomHex = crypto.randomBytes(16).toString("hex");
  return `whsec_${randomHex}`;
}
