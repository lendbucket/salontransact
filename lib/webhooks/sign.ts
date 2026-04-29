import crypto from "crypto";

export interface SignedWebhook {
  signatureHeader: string;
  timestamp: number;
}

export function signWebhookPayload(secret: string, rawBody: string): SignedWebhook {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedString = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac("sha256", secret).update(signedString).digest("hex");
  return {
    signatureHeader: `t=${timestamp},v1=${hmac}`,
    timestamp,
  };
}
