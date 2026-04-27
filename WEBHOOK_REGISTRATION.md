# Payroc Webhook Registration

## Active Subscriptions

### Subscription 3776 (UAT)

- **ID:** 3776
- **Environment:** UAT (`api.uat.payroc.com`)
- **Registered:** 2026-04-27
- **Receiver URL:** `https://portal.salontransact.com/api/webhooks/payroc`
- **Support email:** ceo@36west.org
- **Event types:**
  - `processingAccount.status.changed`
  - `terminalOrder.status.changed`

### Secret

The `Payroc-Secret` header value is stored in Vercel as `PAYROC_WEBHOOK_SECRET`. The receiver at `app/api/webhooks/payroc/route.ts` validates it using `crypto.timingSafeEqual`.

Do **not** commit the secret to the repo. If rotated, update both:
1. Vercel env var `PAYROC_WEBHOOK_SECRET`
2. Payroc subscription (update via API or delete + recreate)

## Managing Subscriptions

### List subscriptions

```bash
# Using the Node.js auth flow:
curl -H "Authorization: Bearer $TOKEN" https://api.uat.payroc.com/v1/event-subscriptions
```

### Delete subscription

```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" https://api.uat.payroc.com/v1/event-subscriptions/3776
```

### Register a new subscription

```bash
npx dotenv-cli -e .env.local -- npm run register-webhook
```

See `scripts/register-webhook.mjs` for details.

## Production

No production webhook subscription has been registered yet. When ready:

1. Set `PAYROC_EVENTS_URL=https://api.payroc.com/v1/event-subscriptions`
2. Set `PAYROC_AUTH_URL=https://identity.payroc.com/authorize`
3. Use the production `PAYROC_API_KEY`
4. Run `npm run register-webhook`
5. Record the subscription ID in this file
