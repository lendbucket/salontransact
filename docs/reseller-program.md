# Reseller Program — Roadmap

**Status:** DEFERRED. Build after SalonTransact is live with paying merchants and Phase 9 (boarding flow) is shipped.

**Author:** Robert Reyna
**Captured:** 2026-04-29 (Day 3 of SalonTransact Phase 8.5)

---

## What this is

A referral partner program with branded portals. Other entrepreneurs sign up as "resellers," recruit their own merchants under their brand, and get paid a commission on the processing volume those merchants generate.

**Critical clarification:** This is NOT true white-label payments. It's a referral program with branded UI.

## What this is NOT

- Resellers do **NOT** have their own Payroc relationship
- Resellers do **NOT** have their own merchant services agreement with cardholders
- Resellers are **NOT** the legal merchant services provider
- Resellers do **NOT** carry compliance, dispute, or chargeback liability

All merchants are legally Reyna Pay LLC's merchants under Reyna Pay's single Payroc MID. Resellers are referral partners who happen to have branded marketing tools and portals.

## Why this distinction matters

True white-label payments (where each reseller has their own Payroc sub-master MID) requires:
- Multi-tenant Payroc architecture (months of work, contract amendments)
- PCI compliance segmentation per reseller
- Each reseller responsible for their merchants' disputes/chargebacks
- Each reseller signs their own contract with Payroc
- Real revenue split with Payroc, not just commission accounting

Robert's model avoids all of that. Single MID, single compliance perimeter, just commission accounting on Reyna Pay's end. Much simpler to build, much faster to ship, much less legal exposure.

The tradeoff: merchants must see "Powered by Reyna Pay" somewhere in the experience. Hiding the legal merchant services provider from cardholders is a real compliance risk and a litigation risk if a merchant ever sues. Light white-label only.

## Commercial structure

- Robert (Reyna Pay) earns ~55% of processing margin per transaction (the spread between cardholder fee and Payroc cost)
- Reseller earns 25% of Robert's 55% (i.e., ~13.75% of processing margin) on every transaction their referred merchants generate
- Commission accrues per transaction, paid out monthly via ACH (Mercury) for the first batch of resellers
- Eventually: integrate with Stripe Connect Express or build internal payout flow

## Scope: what we will build

### Light white-label theming (NOT full rebrand)
- Reseller's logo replaces SalonTransact wordmark in:
  - Top nav of merchant portal (when merchant came from this reseller)
  - Email receipts to cardholders
  - PDF processing statements
  - PDF agreement at onboarding
- Reseller's primary color overrides default teal in CSS variables
- Reseller's contact email shown for support
- Subdomain: `{reseller-slug}.reynapay.com` routes to reseller-themed merchant portal
- Optional: custom domain via Vercel API (premium feature, charge for it)

### What we will NOT customize
- Footer always shows "Powered by Reyna Pay LLC" (compliance + legal)
- Email from-address stays `noreply@salontransact.com` or similar — NOT reseller's domain (DKIM/SPF complexity, deliverability risk)
- Merchant agreement signed by merchant is between merchant and Reyna Pay, with reseller's brand visible but Reyna Pay legally identified
- Dispute/chargeback handling stays with Reyna Pay support; resellers don't have authority to make refunds or contest disputes

### Reseller features
- Reseller dashboard: their merchants list, commission accruals (pending vs paid), referral link
- Reseller invite-a-merchant flow (extends existing merchant invite system, scoped to that reseller)
- Reseller cannot see other resellers' merchants
- Reseller analytics: their own revenue, conversion rates from leads to active merchants
- Light CRM: track leads (people they're working but haven't onboarded yet), notes per lead

## Schema additions (sketch — not final)

```prisma
model Reseller {
  id                  String    @id @default(cuid())
  userId              String    @unique  // The reseller's own user account
  businessName        String    // Their company name
  brandName           String    // Display name shown to their merchants
  slug                String    @unique  // URL slug, e.g., "susan-payments"
  logoUrl             String?
  primaryColorHex     String    @default("#017ea7")
  contactEmail        String
  customDomain        String?   @unique
  commissionPercent   Float     @default(25.0)  // % of Reyna Pay's margin paid to this reseller
  status              String    @default("active")
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
  user                User      @relation(...)
  merchants           Merchant[]
  accruals            CommissionAccrual[]
}

model CommissionAccrual {
  id                  String    @id @default(cuid())
  resellerId          String
  transactionId       String
  accrualCents        Int       // Commission earned on this transaction
  status              String    @default("pending")  // pending | paid | reversed
  paidAt              DateTime?
  payoutBatchId       String?   // Groups accruals into a single Mercury ACH transfer
  createdAt           DateTime  @default(now())
  reseller            Reseller @relation(...)
  transaction         Transaction @relation(...)
}
```

Add to existing models:
- `Merchant.resellerId String?` — which reseller acquired this merchant (nullable; direct Reyna Pay merchants stay null)
- `User.role` — extend to include `"reseller"` alongside existing `"merchant"` and `"master portal"`

## Build phases (4 weeks rough estimate)

### Week 1: Schema + commission accounting
- Reseller model, CommissionAccrual model
- Add `resellerId` to Merchant
- Add `"reseller"` role to NextAuth
- Nightly cron: for each succeeded Transaction yesterday, if `merchant.resellerId != null`, create a CommissionAccrual row
- Master tools: list resellers, see their accruals, mark batch as paid

### Week 2: Reseller portal role
- Reseller dashboard at `/reseller` (their merchants, accruals, referral link)
- Reseller invite-a-merchant flow (scoped to their resellerId)
- Reseller cannot access master portal or other resellers' data
- Reseller can see commission balance and history

### Week 3: Branding + custom domains
- Theme system: per-reseller CSS variable overrides
- Subdomain routing via middleware: `{slug}.reynapay.com` → reseller-themed portal
- Custom domain support: store custom domain on Reseller record, Vercel custom domain config
- Branded email templates: replace logo in receipts/invites when merchant has resellerId
- Branded PDF statement (extends Commit 32 builder.ts)

### Week 4: CRM + nice-to-haves
- Lead tracking: resellers track prospects before they convert to merchants
- Notes/tags on leads
- Email templates for reseller→prospect outreach
- Analytics dashboard: revenue, accruals, conversion rates

## Deferred / out of scope

- **Resellers having sub-resellers:** No. Single layer only. Avoids commission cascade complexity.
- **Reseller payout via Stripe Connect:** No, manual ACH via Mercury for first 5-10 resellers. Add Stripe Connect Express only when manual becomes painful.
- **Resellers running their own support:** No, all support flows back to Reyna Pay. Liability concern.
- **Resellers setting their own pricing:** No, all merchants pay the same rates. Only reseller commission percent varies.
- **Reseller-side admin tools:** No, master portal stays Reyna Pay only.
- **Full white-label (no Reyna Pay branding anywhere):** No, "Powered by Reyna Pay" stays for compliance.

## Risks to watch

1. **Compliance risk:** If a reseller-recruited merchant breaks card network rules, Payroc holds Reyna Pay accountable, not the reseller. Need clear reseller agreement with indemnification.
2. **Quality risk:** Resellers might recruit risky merchants (high chargeback rates, prohibited verticals) to maximize their commission. Need underwriting standards that apply equally to direct and reseller-sourced merchants.
3. **Reseller churn:** If a reseller leaves the program, what happens to their merchants? Default: merchants stay with Reyna Pay direct, commission stops accruing.
4. **State licensing:** Reseller marketing themselves as "payments company" might trigger state money transmitter licensing in some states. Resellers should be marketed as referral agents, not payment processors. Legal review before launch.
5. **Tax implications:** Commission payments to resellers are 1099-NEC reportable. Need W-9 collection on reseller signup.

## Prerequisites before this can start

1. SalonTransact live with at least 5-10 paying merchants on Reyna Pay's House Account
2. Phase 9 (boarding flow) shipped — resellers need a working merchant onboarding pipeline to refer into
3. Real demand validated — at least one entrepreneur asking to be a reseller before we build
4. Counsel review of reseller agreement template
5. W-9 collection workflow (can be Mercury or simple form)

## Decision log

- **2026-04-29:** Robert articulated the vision. Initial framing was "white-label" but on analysis it's actually a referral program with branded portals. Distinction matters for architecture and legal.
- **2026-04-29:** Decided to NOT build now. Defer to post-Phase-9. Capture in this doc.

---

*This document captures Robert's strategic vision for monetizing SalonTransact beyond direct merchant acquisition. It is intentionally written before any code is shipped so future-Robert (and future-Claude) have the full architectural reasoning when build time comes.*
