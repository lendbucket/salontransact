# Payroc Capability Matrix — Source of Truth

**Last updated:** 2026-04-29 (honest audit after Phase 10.7)

This document is the source of truth for what Payroc actually supports for 
Reyna Pay. It supersedes any feature claim in the engine roadmap or 
elsewhere. Every engine capability MUST trace back to a real Payroc API 
or be honestly labeled as engine-only.

---

## What Payroc IS

- A payment processor + acquirer (registered with card networks)
- Provides: card-present + card-not-present transactions, secure 
  tokenization, recurring billing, batch settlement, dispute management, 
  same-day funding (per ERF setup)
- API: `/v1/payments`, `/v1/payments/{id}/refunds`, `/v1/payments/{id}/capture`, 
  `/v1/payments/{id}/void`, `/v1/disputes`, `/v1/secure-tokens`
- Hosted Fields for PCI-compliant card capture
- Pax A920 Pro device support for card-present (channel: cardPresent)
- Settlement: T+1 standard, T+0 (same day) per merchant ERF config
- Dispute API for chargeback management

## What Payroc IS NOT

- NOT a treasury platform — does not hold balances on our behalf
- NOT a card issuer — does not issue cards to our merchants
- NOT a money transmitter — cannot push funds to arbitrary bank accounts via Visa Direct/Mastercard Send
- NOT an instant-payout provider — same-day funding is the fastest option
- NOT a Banking-as-a-Service platform

## Real Payroc capabilities (confirmed)

| Capability | Confirmed by | Notes |
|---|---|---|
| POST /v1/payments (charge) | Tested in production | Real $56.65 AmEx charge succeeded |
| POST /v1/payments/{id}/refunds | Tested in production | Existing refund flow works |
| POST /v1/payments/{id}/capture | NEEDS VERIFY | Endpoint exists in Payroc docs; need Matt to confirm enabled on House Account |
| POST /v1/payments/{id}/void | NEEDS VERIFY | Same as capture |
| Secure tokenization via Hosted Fields | Tested in UAT | Single-use token -> secureToken exchange (Chris confirmed) |
| Webhook delivery from Payroc | NEEDS VERIFY | We have a webhook receiver but need Matt to confirm Payroc actively pushes events |
| Same-day funding | NEEDS VERIFY (Chris partial transcript) | Set per-merchant via ERF at boarding (not API) |
| Batch close API | NEEDS VERIFY | Need Matt to confirm endpoint + schedule |
| Disputes API | NEEDS VERIFY | We have a /disputes endpoint that pulls from Payroc; verify data shape |
| Customer query by email | CONFIRMED NO (Chris) | Must maintain own email-to-secureTokenId index |
| Real instant payouts (push-to-card) | CONFIRMED NO | Requires Treasury/Issuing partner — out of scope for Reyna Pay |
| Multi-account funding splits | NEEDS VERIFY | Need to ask Chris if Payroc can split settlement to multiple bank accounts |

## Engine capabilities (Reyna Pay's own, no Payroc)

These are real products built on top of our database, NOT Payroc:

- Customer database with LTV, tier, visit frequency
- Stylist attribution + commission tracking
- Booking ledger with auth-hold linkage
- Webhook fanout to consumer endpoints (separate from Payroc-to-us webhooks)
- Idempotency layer (sk_live + Idempotency-Key)
- Audit log
- Velocity controls (5 server-side rules)
- Risk scoring (rule-based, 0-100)
- Pre-charge risk check API
- Chargeback evidence pack auto-builder
- Stylist payout preferences (ledger only — merchant executes payouts)
- API key management
- Multi-location franchise scoping (Phase 10.8)
- Same-day-payout wrapper (calls Payroc same-day funding)
- End-of-day batch close trigger (calls Payroc batch close)

## What we cannot offer

- Real instant payouts (push-to-debit-card via Visa Direct) — no Treasury
- Direct bank-to-bank pushes via RTP/FedNow — no Treasury
- Card issuing for merchants/stylists — no Issuing partner
- Holding merchant funds in escrow — no Treasury
- Splitting funds between multiple bank accounts — depends on Payroc, likely no
- Apple Pay in production — pending cert (Phase 9 close-out)
- Google Pay — pending integration (Phase 9 close-out)

## Open questions for Matt + Chris (next Slack message)

1. Does Payroc support separate auth/capture/void on House Account config?
2. Does Payroc actively push webhooks to us, and if so what events + schema?
3. Same-day funding ERF — what's the exact form + where do I send it?
4. What's the Payroc batch close endpoint + recommended schedule?
5. What's the Payroc disputes API shape — are we pulling correctly?
6. Can Payroc split settlement to multiple merchant bank accounts?

## Treasury / Banking Reality (locked)

**Reyna Pay corporate finance:** Mercury bank account only. No Stripe 
Treasury, no Wise. See SD-002, SD-003 in strategic-decisions.md.

**Real instant payouts (push-to-card):** Not offered. Same-day funding 
via Payroc is the fastest payout option. See SD-005.

**Card issuing for merchants/stylists:** Not offered. No Issuing 
partner. Future exploration only, no commitment.

**Cross-border:** Not offered. US-only operations. Future exploration 
only, no commitment.

**Payroll rails:** Not built. Stripe Treasury and Wise both prohibit 
nested third-party sender use, so neither could serve as ACH 
origination for merchant payroll. When payroll is added (post-Phase 
10/11), the path is embedded provider (Check/Gusto/ADP), not native 
build. See SD-004.
