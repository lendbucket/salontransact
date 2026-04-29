import crypto from "crypto";
import type { CardEntryTokenPayload } from "./types";

function getSigningSecret(): string {
  const secret = process.env.CARD_ENTRY_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("CARD_ENTRY_SIGNING_SECRET env var must be set to a random 32+ char string");
  }
  return secret;
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Buffer {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

export function signCardEntryToken(payload: CardEntryTokenPayload): string {
  const payloadJson = JSON.stringify(payload);
  const payloadB64 = base64UrlEncode(Buffer.from(payloadJson, "utf8"));
  const secret = getSigningSecret();
  const signature = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  const sigB64 = base64UrlEncode(signature);
  return `${payloadB64}.${sigB64}`;
}

export function verifyCardEntryToken(signedToken: string): CardEntryTokenPayload | null {
  const parts = signedToken.split(".");
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;

  let secret: string;
  try { secret = getSigningSecret(); } catch { return null; }

  const expectedSig = crypto.createHmac("sha256", secret).update(payloadB64).digest();
  let providedSig: Buffer;
  try { providedSig = base64UrlDecode(sigB64); } catch { return null; }

  if (providedSig.length !== expectedSig.length) return null;
  if (!crypto.timingSafeEqual(providedSig, expectedSig)) return null;

  let payload: CardEntryTokenPayload;
  try {
    const json = base64UrlDecode(payloadB64).toString("utf8");
    payload = JSON.parse(json);
  } catch { return null; }

  if (payload.v !== 1) return null;
  if (typeof payload.tid !== "string" || payload.tid.length === 0) return null;
  if (typeof payload.mid !== "string" || payload.mid.length === 0) return null;
  if (typeof payload.exp !== "number") return null;

  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec >= payload.exp) return null;

  return payload;
}
