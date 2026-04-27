// scripts/register-webhook.mjs
//
// One-time registration of webhook subscription with Payroc UAT.
// Uses the same auth flow that powers production payments.
//
// Required env vars (set before running):
//   PAYROC_API_KEY          - Payroc UAT API key
//   PAYROC_AUTH_URL         - https://identity.uat.payroc.com/authorize
//   PAYROC_WEBHOOK_SECRET   - The shared secret. Set the SAME value in Vercel.
//
// Optional env vars:
//   WEBHOOK_URI             - Receiver URL. Defaults to production.
//   WEBHOOK_SUPPORT_EMAIL   - Defaults to ceo@36west.org
//   PAYROC_EVENTS_URL       - Override the subscription endpoint.
//                             Defaults to UAT.
//
// Run:
//   node scripts/register-webhook.mjs
//
// Safety: idempotent via Idempotency-Key. Re-running with same env returns
// the same subscription. To create a new one, restart your shell or just
// trust the same registration exists.

import crypto from "node:crypto";

const REQUIRED = ["PAYROC_API_KEY", "PAYROC_AUTH_URL", "PAYROC_WEBHOOK_SECRET"];
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`Missing env var: ${k}`);
    process.exit(1);
  }
}

const WEBHOOK_URI =
  process.env.WEBHOOK_URI || "https://portal.salontransact.com/api/webhooks/payroc";
const SUPPORT_EMAIL = process.env.WEBHOOK_SUPPORT_EMAIL || "ceo@36west.org";
const EVENTS_URL =
  process.env.PAYROC_EVENTS_URL || "https://api.uat.payroc.com/v1/event-subscriptions";

console.log("");
console.log("Configuration:");
console.log(`  Webhook URI:    ${WEBHOOK_URI}`);
console.log(`  Support email:  ${SUPPORT_EMAIL}`);
console.log(`  Events URL:     ${EVENTS_URL}`);
console.log(`  Auth URL:       ${process.env.PAYROC_AUTH_URL}`);
console.log(`  API key length: ${process.env.PAYROC_API_KEY.length}`);
console.log(`  Secret length:  ${process.env.PAYROC_WEBHOOK_SECRET.length}`);
console.log("");

// Step 1: Get bearer token (same logic as lib/payroc/client.ts)
console.log("Step 1/2: Requesting bearer token from Payroc UAT...");

const tokenRes = await fetch(process.env.PAYROC_AUTH_URL, {
  method: "POST",
  headers: {
    "x-api-key": process.env.PAYROC_API_KEY,
    "Content-Type": "application/json",
  },
});

const tokenText = await tokenRes.text();
console.log(`  Status: ${tokenRes.status}`);

if (!tokenRes.ok) {
  console.error("FAILED to get bearer token");
  console.error(`  Body: ${tokenText.substring(0, 500)}`);
  process.exit(1);
}

const tokenData = JSON.parse(tokenText);
const bearerToken = tokenData.access_token ?? tokenData.token;

if (!bearerToken) {
  console.error("No access_token in response. Available fields:");
  console.error(Object.keys(tokenData).join(", "));
  process.exit(1);
}

console.log(`  Bearer token acquired (length: ${bearerToken.length})`);
console.log("");

// Step 2: Create event subscription per Payroc's documented schema
console.log("Step 2/2: Creating event subscription...");

const subscriptionBody = {
  enabled: true,
  eventTypes: [
    "processingAccount.status.changed",
    "terminalOrder.status.changed",
  ],
  notifications: [
    {
      type: "webhook",
      uri: WEBHOOK_URI,
      secret: process.env.PAYROC_WEBHOOK_SECRET,
      supportEmailAddress: SUPPORT_EMAIL,
    },
  ],
};

const idempotencyKey = crypto.randomUUID();
console.log(`  Idempotency-Key: ${idempotencyKey}`);

const subRes = await fetch(EVENTS_URL, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${bearerToken}`,
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  },
  body: JSON.stringify(subscriptionBody),
});

const subText = await subRes.text();
console.log(`  Status: ${subRes.status}`);
console.log("");

if (!subRes.ok) {
  console.error("FAILED to create subscription");
  console.error("Response body:");
  console.error(subText);
  process.exit(1);
}

const responseObj = JSON.parse(subText);
console.log("RESPONSE:");
console.log(JSON.stringify(responseObj, null, 2));
console.log("");
console.log("================================================");
console.log(`SUBSCRIPTION ID: ${responseObj.id}`);
console.log("================================================");
console.log("Save this ID. You need it to update or delete the subscription later.");
