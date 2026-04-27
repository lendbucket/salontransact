# Payroc Webhook Subscriptions

This document tracks active webhook subscriptions registered with Payroc.

## UAT Environment

| Field | Value |
|---|---|
| Subscription ID | `3776` |
| Status | `registered` |
| Registered | 2026-04-27 |
| Endpoint | `https://api.uat.payroc.com/v1/event-subscriptions` |
| Receiver URI | `https://portal.salontransact.com/api/webhooks/payroc` |
| Support email | `ceo@36west.org` |
| Event types | `processingAccount.status.changed`, `terminalOrder.status.changed` |

### Managing this subscription

- **Update:** `PATCH https://api.uat.payroc.com/v1/event-subscriptions/3776`
- **Delete:** `DELETE https://api.uat.payroc.com/v1/event-subscriptions/3776`
- **Retrieve:** `GET https://api.uat.payroc.com/v1/event-subscriptions/3776`

Both calls need a fresh bearer token (auth via `PAYROC_API_KEY` against `https://identity.uat.payroc.com/authorize`).

## Production Environment

Not yet registered. After UAT certification (per Solution Design phase 1.3), register an equivalent subscription against `https://api.payroc.com/v1/event-subscriptions` with a fresh secret.

## Re-registering

Use `scripts/register-webhook.mjs` for Node-based registration (the working path). The PowerShell version `register-webhook.ps1` exists but auth doesn't work from PowerShell on this machine for unknown reasons.

## Webhook secret rotation

The secret stored in Vercel as `PAYROC_WEBHOOK_SECRET` (Sensitive scope) is what Payroc sends in the `payroc-secret` header on every event. Rotating means: generate new secret, update both Vercel and Payroc subscription via PATCH.
