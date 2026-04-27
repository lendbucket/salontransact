import { randomBytes } from "crypto";

export function generateVerificationToken(): string {
  return randomBytes(32).toString("hex");
}

export const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
