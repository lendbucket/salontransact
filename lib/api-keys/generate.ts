import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * Generate a new API key with secure random bytes and bcrypt hash.
 *
 * Key format: sk_live_<32 hex chars>  (40 chars total)
 * Prefix:     first 12 chars of the key (sk_live_ + first 4 hex chars)
 * Hash:       bcrypt of the full key (cost=10)
 *
 * The full key is returned ONCE to be shown to the user, then discarded.
 * The hash is stored in DB for verification when a client authenticates.
 */
export async function generateApiKey(): Promise<{
  fullKey: string;
  keyPrefix: string;
  keyHash: string;
}> {
  // 16 random bytes -> 32 hex chars
  const randomHex = crypto.randomBytes(16).toString("hex");
  const fullKey = `sk_live_${randomHex}`;
  const keyPrefix = fullKey.slice(0, 12);
  const keyHash = await bcrypt.hash(fullKey, 10);
  return { fullKey, keyPrefix, keyHash };
}
