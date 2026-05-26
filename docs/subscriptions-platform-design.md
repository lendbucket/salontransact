# Subscriptions Platform — V1 Design Document

**Status:** Draft v1.1 (revised for merchant-configured tax rates, proration on cancel, multiple subscriptions per customer)
**Author:** Drafted in collaboration with Claude
**Last updated:** May 26, 2026
**Repo:** lendbucket/salontransact
**Owner:** Robert Reyna (Reyna Tech LLC)

---

## Table of contents

1. Purpose and scope
2. Non-goals and V2 backlog
3. Glossary
4. Data model
5. Subscription lifecycle state machine
6. Billing engine architecture
7. Three sales channels
8. Customer self-serve portal
9. Dunning policy
10. Tax integration (TaxJar)
11. Webhook architecture
12. Email templates and notifications
13. Compliance posture
14. Security and PCI considerations
15. Observability and operations
16. Phased build plan
17. Risk register
18. Open questions

---

## 1. Purpose and scope

SalonTransact V1 launches subscription billing as a first-class product. The target customer is any merchant on the SalonTransact platform that wants to bill recurring revenue from their customers — salon memberships, recurring service packages, retainer arrangements, monthly maintenance subscriptions, security monitoring subscriptions (Halstead Security, Permit Crew franchise dues), or anything else where a card is charged on a schedule against a saved card on file.

V1 must support every billing pattern a typical SMB subscription business needs, but must not try to be Stripe Billing. Stripe Billing took 800 engineers a decade and has feature surface that V1 explicitly excludes (see Section 2).

V1 ships as a real, production-grade platform. No shortcuts. No "we'll fix it later" technical debt in load-bearing places. Code quality bar is the same as the existing payment engine: protected files identified, Claude Code prompts that show diffs before writing, GitHub verification of every push, automated PR reviewer reads before merge, smoke tests after deploy.

**V1 must handle:**
- Subscription plans defined per merchant (each salon creates own products at own prices)
- Billing intervals: weekly, monthly, annual
- Flexible anchor days (customer signs up on the 15th, bills on the 15th of each cycle)
- Free trials with payment method required up front, auto-bill at trial end
- Three sales channels: master portal admin creating subscriptions on behalf of merchants, salon staff creating subscriptions for walk-in customers, customers self-serve signing up via a public link
- Automated dunning when payments fail (retry schedule, customer email notifications, eventual subscription pause)
- Self-serve customer portal where customers can update payment method, view billing history, pause subscription, cancel subscription
- Sales tax calculated using per-merchant configured rates; merchant handles remittance
- Webhook event delivery so merchants can integrate with their own tools
- Email receipts, dunning notices, renewal reminders, cancellation confirmations via existing SendGrid setup on reynapay.com
- State-specific auto-renewal compliance disclosures (California ARL, Texas, NY, IL, OR, others)
- Cancel-anytime UX with no friction beyond what's legally required to verify intent

Target timeline: 6-8 weeks of focused work in 4 phased PR sequences. Each phase is independently shippable and adds material customer value.

---

## 2. Non-goals and V2 backlog

These features are explicitly **not** in V1. They are real product features and we want them eventually — but V2 ships after V1 is stable in production with real subscribers.

**V2 deferred features:**

- Coupons and discount codes (single-use, multi-use, percent-off, fixed-amount, expiration, applies-to-first-payment-only vs forever, stackable, tax interaction edge cases)
- Proration on plan changes (mid-cycle upgrades and downgrades, including the dozens of edge cases Stripe has refined over 10 years)
- Gift subscriptions (buyer-not-recipient flows, gift codes, delivery mechanism, expiration of unclaimed gifts, accounting treatment)
- Usage-based billing (metering, aggregation, tiered pricing rules, invoice line items)
- Multi-currency support
- Bundle/package products (e.g., "subscribe to A and B together at a discount")
- Customizable invoice PDFs with merchant branding
- Customer-facing tax exemption certificates
- A multi-language customer portal
- Apple Pay / Google Pay as recurring methods (Payroc HF tokens are the V1 vehicle)
- Bank/ACH-funded subscriptions (waiting for ACH UI to ship)

If a salon owner asks "can I give my new members 50% off their first month?" the answer in V1 is "not yet, coming in V2." We resist the urge to one-off feature requests during the V1 build because each one delays launch and adds bug surface.

---

## 3. Glossary

**Subscription** — A persistent agreement to charge a customer on a recurring schedule against a saved payment method.

**Plan** — A merchant-defined product template (name, description, price, interval, tax category, trial config). Plans are templates; subscriptions are instances.

**Cycle** — One billing period within a subscription (one month for monthly plans, one year for annual, etc.). Each cycle has a start, an end, and may have an invoice tied to it.

**Anchor day** — The day of the cycle the subscription bills on. For monthly: a number 1-28 (we cap at 28 to avoid month-end ambiguity). For weekly: day of week. For annual: month + day.

**Mandate** — The legal record of customer consent to be charged on a recurring basis. Captured at signup. Required by card network rules for recurring transactions.

**Dunning** — The process of attempting to recover a failed payment through retries and customer outreach.

**Past-due** — A subscription state where the current cycle's payment has failed at least once but retries have not yet exhausted.

**Paused** — A subscription state where no charges fire but the subscription is preserved for reactivation. Distinct from cancelled.

**Cancelled** — A terminal subscription state. No further charges. Cannot be reactivated; customer must sign up for a new subscription.

**Trial** — A defined period at the start of a subscription during which no charges fire. Customer's payment method is captured and validated up front. At trial end, the first real charge fires automatically.

---

## 4. Data model

The data model is the most important decision in the whole platform. Get it wrong and we tear out and rebuild later at high cost. Get it right and we extend without pain.

### 4.1 Core tables

Prisma schema. All tables use Prisma cuid IDs as primary keys (consistent with existing codebase). All money is stored as integers in cents (no floats, ever). All timestamps are stored as UTC ISO 8601.

```prisma
model SubscriptionPlan {
  id              String   @id @default(cuid())
  merchantId      String
  merchant        Merchant @relation(fields: [merchantId], references: [id])

  // Plan definition
  name            String   // "Salon Envy Premium Membership"
  description     String?
  status          PlanStatus  // active, archived

  // Pricing
  amountCents     Int      // price per cycle in cents
  currency        String   @default("USD")
  taxable         Boolean  @default(true)  // false = no tax added regardless of merchant settings

  // Billing cadence
  interval        BillingInterval  // WEEKLY, MONTHLY, ANNUAL
  intervalCount   Int      @default(1)  // e.g. 3 + MONTHLY = quarterly billing

  // Trial configuration
  trialDays       Int?     // null = no trial; otherwise days from signup to first charge

  // Display
  publicSignupEnabled Boolean @default(false)  // visible on public signup pages?
  publicSignupSlug    String? @unique          // /subscribe/{slug} signup URL

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  subscriptions   Subscription[]

  @@index([merchantId, status])
}

enum PlanStatus {
  active
  archived
}

enum BillingInterval {
  WEEKLY
  MONTHLY
  ANNUAL
}

model Subscription {
  id              String   @id @default(cuid())
  merchantId      String
  merchant        Merchant @relation(fields: [merchantId], references: [id])

  // Links
  planId          String
  plan            SubscriptionPlan @relation(fields: [planId], references: [id])
  customerId      String
  customer        Customer @relation(fields: [customerId], references: [id])
  savedCardId     String
  savedCard       SavedPaymentMethod @relation(fields: [savedCardId], references: [id])

  // Lifecycle state (see state machine in Section 5)
  status          SubscriptionStatus

  // Anchoring
  anchorDay       Int      // for WEEKLY: 0-6 (Sun-Sat); for MONTHLY: 1-28; for ANNUAL: 1-365 (day of year)
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  nextBillingDate    DateTime?  // null when paused or cancelled

  // Trial
  trialEnd        DateTime?  // null if no trial or trial ended

  // Cancellation
  cancelAt        DateTime?  // scheduled cancellation (end of current period)
  canceledAt      DateTime?  // actual cancellation timestamp
  cancellationReason String?  // free-text from customer or admin

  // Failure tracking
  failedPaymentCount Int   @default(0)  // resets on successful charge
  lastFailureAt   DateTime?

  // Channel of origin (audit)
  source          SubscriptionSource  // master_portal, stylist, customer_signup

  // Mandate (recurring consent record)
  mandateAcceptedAt DateTime
  mandateText       String  // the exact text the customer agreed to
  mandateIpAddress  String?  // captured at signup
  mandateUserAgent  String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  invoices        SubscriptionInvoice[]
  events          SubscriptionEvent[]

  @@index([merchantId, status])
  @@index([nextBillingDate, status])  // critical for billing engine query
  @@index([customerId])
}

enum SubscriptionStatus {
  trialing       // in trial period, no charges yet
  active         // billing normally
  past_due       // last charge failed, in dunning
  paused         // intentionally paused, no charges firing
  canceled       // terminal state
  incomplete     // signup started but payment method not validated
  incomplete_expired  // signup abandoned, cleanup target
}

enum SubscriptionSource {
  master_portal
  stylist
  customer_signup
}

model SubscriptionInvoice {
  id              String   @id @default(cuid())
  subscriptionId  String
  subscription    Subscription @relation(fields: [subscriptionId], references: [id])
  merchantId      String   // denormalized for query speed

  // What's being billed
  periodStart     DateTime
  periodEnd       DateTime
  subtotalCents   Int      // before tax
  taxCents        Int
  totalCents      Int      // subtotal + tax

  // Tax details (merchant-configured rate captured at invoice creation)
  taxRateAtBilling      Int?     // basis points (e.g. 825 = 8.25%); null if no tax applied
  taxJurisdictionAtBilling String?  // jurisdiction label at billing time, for audit

  // Payment status
  status          InvoiceStatus
  paymentId       String?  // links to Payroc payment row when paid
  paidAt          DateTime?

  // Failure tracking
  attemptCount    Int      @default(0)
  lastAttemptAt   DateTime?
  nextAttemptAt   DateTime?
  failureReason   String?  // Payroc decline message from last attempt

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([subscriptionId])
  @@index([status, nextAttemptAt])  // for dunning engine query
  @@index([merchantId, createdAt])
}

enum InvoiceStatus {
  pending     // created but not yet attempted
  paid        // succeeded
  failed_retrying  // failed, will retry per dunning policy
  failed_terminal  // all retries exhausted
  refunded
  voided
}

model SubscriptionEvent {
  // Audit log for everything that happens to a subscription
  id              String   @id @default(cuid())
  subscriptionId  String
  subscription    Subscription @relation(fields: [subscriptionId], references: [id])

  eventType       String   // see enumeration below
  actor           String   // who/what triggered it (userId, "system:cron", "customer:self")
  data            Json     // event-specific payload

  createdAt       DateTime @default(now())

  @@index([subscriptionId, createdAt])
}

// Event type enumeration (strings, not enum, for flexibility):
// - subscription.created
// - subscription.trial_started
// - subscription.trial_ended
// - subscription.activated
// - subscription.billed_attempt
// - subscription.billed_success
// - subscription.billed_failed
// - subscription.dunning_email_sent
// - subscription.payment_method_updated
// - subscription.paused
// - subscription.resumed
// - subscription.cancellation_scheduled
// - subscription.canceled
// - subscription.reactivation_attempted (always rejected in V1)
// - subscription.plan_changed (V2, not in V1)
```

### 4.2 Why these tables and not others

**Why a separate SubscriptionInvoice table?** Because each cycle's billing is independent. Cycle 3 succeeding doesn't make cycle 2's failure go away. We need to track each cycle's payment history separately for tax reporting, customer history display, and dunning state.

**Why a separate SubscriptionEvent table?** Because the lifecycle of a subscription is the most important auditable thing in the system. When a customer disputes "you charged me wrong" or "I cancelled and you kept billing," the event log is the source of truth. Store every state transition with timestamp, actor, and full payload.

**Why is `mandateText` stored verbatim?** Card networks (Visa, Mastercard) require merchants to be able to produce the exact wording the customer agreed to when they consented to recurring charges. If the signup page wording changes over time, old subscriptions are still bound by the wording at their signup time. Storing the exact mandate text per subscription is a compliance requirement.

**Why no separate Customer.subscriptions array? Why are we storing customerId on each subscription?** Prisma generates a typed array automatically via the relation. The customerId column is the actual database storage; the array is convenience syntax.

**Why no `paymentMethodId` field separately from `savedCardId`?** SavedPaymentMethod already exists in the codebase. We reuse it. A subscription is bound to one saved card. If the customer wants to change the card, they update the savedCardId, which writes a SubscriptionEvent for audit.

### 4.3 Migration plan

A single Prisma migration creates all four new tables. Existing tables (Merchant, Customer, SavedPaymentMethod) get reverse relations added but no breaking changes. Migration is forward-only; no rollback path planned because rollback after subscriptions exist would mean deleting customer billing history.

Migration name: `add_subscriptions_platform_v1`

---

## 5. Subscription lifecycle state machine

A subscription is always in exactly one state. Transitions are well-defined. Illegal transitions are rejected at the application layer with explicit error messages.

### 5.1 States

- **incomplete** — Signup started, payment method not yet validated. Created when a customer-self-serve signup is in progress. Auto-expires to `incomplete_expired` after 24 hours.
- **trialing** — In trial period. No charges firing. Customer can cancel without charge.
- **active** — Billing normally on schedule.
- **past_due** — Current period's invoice failed at least one attempt. Dunning sequence active.
- **paused** — No charges firing. Customer or merchant can resume. Distinct from cancelled.
- **canceled** — Terminal. No further charges. Customer must sign up fresh to resume.
- **incomplete_expired** — Terminal. Abandoned signup cleaned up. No charges ever fired.

### 5.2 Transitions

```
incomplete --[payment_method_validated]--> trialing (if trial) or active (if no trial)
incomplete --[24h_elapsed]--> incomplete_expired

trialing --[trial_end_charge_succeeds]--> active
trialing --[trial_end_charge_fails]--> past_due
trialing --[customer_cancels]--> canceled
trialing --[admin_cancels]--> canceled

active --[charge_succeeds_next_cycle]--> active (stays active, advances period)
active --[charge_fails]--> past_due
active --[customer_pauses]--> paused
active --[customer_cancels_at_period_end]--> active (until period end, then -> canceled)
active --[customer_cancels_immediately]--> canceled
active --[admin_pauses]--> paused
active --[admin_cancels]--> canceled

past_due --[retry_succeeds]--> active
past_due --[all_retries_exhausted]--> paused (V1 policy; configurable in V2)
past_due --[customer_updates_card_and_charge_succeeds]--> active
past_due --[customer_cancels]--> canceled

paused --[customer_resumes]--> active (next billing date = today + interval)
paused --[admin_resumes]--> active
paused --[customer_cancels]--> canceled
paused --[never_resumed_after_90_days]--> canceled (V1 policy; auto-cleanup)

canceled --[anything]--> rejected; must create new subscription
incomplete_expired --[anything]--> rejected; must create new signup
```

### 5.3 State machine implementation

A single TypeScript module `lib/subscriptions/state-machine.ts` owns all state transition logic. Every transition goes through one function:

```typescript
async function transition(
  subscriptionId: string,
  fromState: SubscriptionStatus,
  toState: SubscriptionStatus,
  actor: string,
  data: Record<string, unknown>
): Promise<{ success: boolean; error?: string }>
```

The function:
1. Reads the subscription with row lock (Prisma `select` with `FOR UPDATE`)
2. Verifies current state matches expected `fromState` (prevents race conditions)
3. Verifies `toState` is a legal transition from `fromState` (lookup table)
4. Updates subscription row with new state and any side-effect fields (e.g., `canceledAt`)
5. Writes a `SubscriptionEvent` row with full audit trail
6. Returns success or descriptive error

All other code that needs to change subscription state calls this function. No raw `prisma.subscription.update({ status: ... })` calls anywhere else in the codebase. Linting rule + code review enforces this.

---

## 6. Billing engine architecture

The billing engine is the heart of the platform. It runs on Vercel Cron (you've confirmed Cron is available on your plan). Failures here lose real revenue, so reliability is the top design priority.

### 6.1 Cron schedule

Three separate cron jobs, each with a distinct responsibility:

**`billing-engine-tick`** — runs every hour, on the hour. Finds subscriptions where `nextBillingDate <= now()` and `status IN (trialing, active)` and fires their charges. Handles trial-end conversion and active-cycle renewals.

**`dunning-engine-tick`** — runs every 4 hours. Finds invoices in `failed_retrying` status where `nextAttemptAt <= now()` and retries them per the dunning policy.

**`cleanup-engine-tick`** — runs once daily at 3am Central. Handles `incomplete` subscriptions older than 24 hours, `paused` subscriptions older than 90 days, and other housekeeping.

All three jobs share a common pattern:
1. Query for due work
2. For each row, acquire a row-level lock (`FOR UPDATE`)
3. Re-verify due state (defensive against double-fires)
4. Execute the action (charge, retry, cleanup)
5. Write audit event
6. Commit transaction

### 6.2 Idempotency

Every charge attempt must be idempotent. Two cron invocations firing the same subscription's charge must result in one charge, not two.

Implementation: every charge call to Payroc uses a deterministic idempotency key derived from the invoice:

```
idempotency_key = `subscription_invoice_${invoiceId}_attempt_${attemptCount}`
```

Payroc's API supports idempotency keys natively (we already use them in the existing checkout route). Same key = same response, no duplicate charge.

The application-layer flow also enforces this:
1. When billing-engine-tick decides to charge an invoice, it first updates the invoice row with `attemptCount = attemptCount + 1, lastAttemptAt = now()` in a transaction
2. The Payroc API call uses the new attemptCount in the idempotency key
3. If Vercel kills the cron job mid-charge and a second instance picks up the work, the second instance sees attemptCount incremented and uses a new key
4. Payroc's idempotency layer ensures the first charge doesn't double-fire even if both keys hit the API

### 6.3 Failure modes and recovery

**Cron job dies mid-execution.** Database transaction rolls back if it died before commit. Already-charged invoices stay paid (Payroc is the source of truth for "did we actually charge"). Next cron tick picks up the work.

**Vercel Cron silently fails to run.** Catastrophic. We mitigate by:
- Alerting if no billing-engine-tick has run in the last 90 minutes (cron runs hourly; 90 min = miss detected)
- Daily reconciliation report that lists all subscriptions where nextBillingDate is in the past and status is not paused/canceled
- Manual "fire missed billing" admin tool that can be triggered from master portal

**Payroc API is down.** Charges return network errors. Invoices stay in `failed_retrying` with exponential backoff (retry in 15min, 1hr, 4hr, 12hr, 24hr). If Payroc is down for >48h we have a bigger problem; manual intervention required.

**Tax calculation cannot fail in V1.** Merchant-configured rates are pulled from the local database at invoice creation time. No external API dependency. This is a meaningful simplification compared to a third-party tax service integration.

### 6.4 Concurrency safety

Multiple cron invocations could theoretically run simultaneously if a job runs longer than its interval. Defense:
- Row-level locks during the dispatch loop prevent two jobs from charging the same subscription
- Each cron job has a global lock acquired at the start (Postgres advisory lock `pg_try_advisory_lock(hashtext('billing-engine-tick'))`). If the lock is held, the second invocation exits immediately.

### 6.5 Performance targets

At 500 subscribers and average monthly billing, the billing engine processes ~17 charges per day (500/30). At 5,000 subscribers (V1 stretch goal), ~167 per day. Either case is trivially handled by an hourly cron tick with no performance pressure.

At 50,000 subscribers and above, we'd revisit the architecture (likely move to a queue-based system with multiple workers). Not a V1 concern.

---

## 7. Three sales channels

Subscriptions can be created through three distinct paths. Each has different UX, different authentication, different consent capture.

### 7.1 Master portal admin channel

Robert (or another master portal admin) creates a subscription on behalf of a merchant for a specific customer.

UI path: `/master/subscriptions/new`
1. Select merchant from dropdown
2. Select customer (or create new)
3. Select plan (must belong to selected merchant)
4. Select saved card (must belong to selected customer)
5. Confirm trial duration if any
6. Confirm anchor day
7. Capture mandate text confirmation (admin attests on behalf)
8. Submit

This channel is the most permissive (admin can override defaults) and the highest-trust (admin is internal). Used for migrating existing recurring customers off other systems, manual operational fixes, and onboarding salon owners' first few subscribers as proof.

### 7.2 Stylist-at-chair channel

A stylist at the salon enrolls a customer in a subscription at the time of service.

UI path: `/merchant/subscriptions/new` (within the merchant-facing portal, accessible to logged-in salon staff)
1. Search for or create customer
2. Select plan (only plans from current merchant)
3. Capture card if customer doesn't have one on file (uses existing Hosted Fields flow with Save Card pre-checked)
4. Display mandate text
5. Customer initials on a touchscreen / staff confirms verbal consent
6. Submit

This channel is the most common in salon contexts. Speed matters. UX should support "I'm done with your service, want to sign up for our membership?" in <90 seconds.

### 7.3 Customer self-serve signup channel

Customer signs up themselves via a public link the merchant shares.

URL: `/subscribe/{merchant-plan-slug}` (the `publicSignupSlug` on the Plan)
1. Public page shows plan name, price, billing interval, trial details, mandate text
2. Customer enters name, email, phone
3. Customer enters card via Hosted Fields (always saves card)
4. Mandate consent captured via checkbox: "I agree to be charged $X every [interval] until I cancel"
5. Signup creates an `incomplete` subscription
6. Payment method validation runs (Payroc card validation call, no charge)
7. On success: subscription transitions to `trialing` (if trial) or `active` (no trial), first invoice generated
8. Confirmation email sent
9. Customer redirected to thank-you page with link to self-serve portal

This channel must be highly polished. It's the primary acquisition surface. Mobile-first, fast, single-page, no distractions. Conversion rate matters.

### 7.4 Channel-specific compliance

The customer-self-serve channel is the most regulated. State auto-renewal laws (California, Texas, Oregon, others) specify that consent must be conspicuous, the cancellation method must be disclosed, the renewal price must be shown clearly, and the customer must receive an email confirmation immediately. The signup page UI must meet these requirements explicitly.

The master portal and stylist channels have weaker requirements because they're not direct-to-consumer purchases, but we still capture mandate text and consent timestamp for every subscription.

---

## 8. Customer self-serve portal

Customers can manage their subscriptions without contacting the salon.

### 8.1 Authentication

Magic-link authentication keyed to email address. Customer requests a login link at `/portal/login`, enters email, receives a one-time URL valid for 15 minutes. Clicking the link sets a session cookie valid for 30 days.

No passwords in V1. Reduces support burden (no password resets) and friction.

### 8.2 Portal features

URL: `/portal/subscriptions`
- List all active subscriptions for this customer (across all merchants — a customer might be subscribed to multiple salons)
- For each subscription, show: plan name, merchant name, price, next billing date, payment method on file
- Action buttons: Update payment method, Pause, Cancel, View history

URL: `/portal/subscriptions/{id}/update-payment`
- Hosted Fields page to enter new card
- Replaces savedCardId on subscription
- Writes audit event

URL: `/portal/subscriptions/{id}/pause`
- Confirmation modal explaining what pause means
- Captures "pause reason" (optional dropdown: temporarily unable to use service, traveling, financial, other)
- Transitions subscription to `paused`

URL: `/portal/subscriptions/{id}/cancel`
- Cancellation confirmation flow
- Captures cancellation reason (required dropdown to inform churn analysis: too expensive, not using, switched providers, dissatisfied, other)
- Choice: cancel immediately (no further charges, no refund of current cycle) OR cancel at end of current cycle (continues until period end)
- V1 defaults to "cancel at end of current cycle" because that's friendlier
- Transitions subscription per choice

URL: `/portal/subscriptions/{id}/history`
- Lists all invoices with dates, amounts, statuses
- Download invoice as PDF (V1: simple template; V2: customizable per merchant)

### 8.3 No reactivation in V1

A canceled subscription cannot be reactivated in V1. Customer must sign up fresh. Rationale: simpler state machine, fewer edge cases, easier to reason about. V2 may add reactivation if customer demand is real.

---

## 9. Dunning policy

When a charge fails, dunning kicks in. Goal is to recover the payment without alienating the customer.

### 9.1 Retry schedule

Invoice attempt 1 fails → retry in 3 days
Invoice attempt 2 fails → retry in 5 days
Invoice attempt 3 fails → retry in 7 days
Invoice attempt 4 fails → mark invoice as `failed_terminal`, transition subscription to `paused`

Total dunning window: 15 days. After 15 days, subscription is paused (not cancelled) so the customer can come back and resume if they want.

The retry schedule is hardcoded in V1. V2 may allow merchant-configurable schedules.

### 9.2 Customer communication

**On first failure:**
- Email: "We couldn't charge your card for your [plan name] subscription. We'll try again in 3 days. To update your payment method, click here."

**On second failure (5 days after first):**
- Email: "We're still having trouble charging your card. We'll try one more time in 5 days. Update your payment method to keep your subscription active."

**On third failure (7 days after second):**
- Email: "This is our final attempt to charge your card. If we can't process it in 7 days, your subscription will be paused. Update your card now to avoid interruption."

**On terminal failure (subscription paused):**
- Email: "Your subscription has been paused because we couldn't charge your card. Your spot is held for 90 days. Reactivate anytime by updating your payment method."

All emails go via SendGrid with branded templates. Reply-to header is the merchant's support email (we'll need merchants to provide this; default to a generic SalonTransact support address).

### 9.3 Merchant notification

For each customer entering dunning, fire a webhook event to the merchant. They can choose to act on it (call the customer, offer a discount, etc.).

V1 does not include in-portal merchant notifications about dunning. V2 may add a "Customers needing attention" dashboard widget.

### 9.4 Smart retries (V2, not V1)

Stripe's dunning ML model predicts the best time of day, day of week, etc. for retry success. V1 uses the fixed schedule above. V2 may incorporate smarter retries if data justifies it.

---

## 10. Tax handling — merchant-configured rates

V1 ships with merchant-configured tax rates rather than a third-party tax calculation service (TaxJar, Avalara, Stripe Tax). Each merchant sets their own sales tax rate in their portal, and the billing engine applies that rate to every invoice. Merchant is responsible for filing returns.

Rationale for this choice over TaxJar:
- TaxJar Starter is $39/month for 200 transactions. At V1 target volume (500 subscribers × 12 cycles/year = 6,000 transactions/year + non-subscription transactions), V1 outgrows Starter quickly and hits the $99+/month higher tier.
- Most V1 merchants (salons) operate in a single state with a single local tax rate. Automated multi-jurisdictional calculation provides no value at this scale.
- The cost saved ($40-100/month) is real margin for a bootstrapped business.

V1.5 / V2 will integrate a tax service when (a) merchants operate across state lines, (b) subscription volume justifies the per-transaction cost, or (c) audit risk from manual rate configuration becomes operationally painful.

### 10.1 Per-merchant tax configuration

Each merchant configures their tax settings in their portal:
- `taxRateBasisPoints` — sales tax rate in basis points (e.g., 825 = 8.25%). Stored as integer to avoid floating-point math.
- `taxJurisdiction` — free-text label of the jurisdiction the rate applies to (e.g., "Corpus Christi, TX"). For merchant reference and audit only; not used in calculation.
- `taxEnabled` — boolean. If false, no tax is added to invoices.

These three fields live on the existing Merchant model. Migration adds them with sensible defaults (taxEnabled false, taxRateBasisPoints 0, taxJurisdiction null) so existing merchants are not affected.

### 10.2 Per-plan tax category override

Future-proofing for when a single merchant sells both taxable and non-taxable products (e.g., salon services taxed at one rate, retail product sales taxed differently). V1 doesn't need this so we keep the schema simple:
- `SubscriptionPlan.taxable` boolean (default true). When false, tax is not added to invoices for that plan regardless of merchant settings.

### 10.3 Calculation flow

When the billing engine fires a charge for an invoice:

1. Compute subtotal (plan amount × interval count, in cents)
2. If subscription's customer is tax-exempt OR plan is non-taxable OR merchant taxEnabled is false → taxCents = 0
3. Else → taxCents = round(subtotal × merchant.taxRateBasisPoints / 10000)
4. Store taxCents and total (subtotal + taxCents) on SubscriptionInvoice
5. Charge total via Payroc

Rate is computed at invoice creation time, not at charge time, so retries use the same tax amount the customer originally agreed to.

### 10.4 Tax-exempt customers

V1: `Customer.taxExempt` boolean flag. Admin sets it manually after reviewing certificate provided by customer out-of-band (email, upload, etc.). When set, tax is 0 on all invoices for that customer.

V2 adds: certificate upload UI, multi-state exemption tracking, automated TaxJar exemption_type passthrough when the tax service is integrated.

### 10.5 Reporting and remittance

V1 surfaces a per-merchant tax report in the merchant portal:
- For any date range, show total taxable subtotal, total tax collected, broken down by jurisdiction label
- Merchant uses this to file returns with their state

V1 does NOT auto-remit tax. Merchant is responsible for filing and paying. We document this clearly in the merchant onboarding flow.

### 10.6 Audit data on each invoice

Each invoice stores:
- `taxRateAtBilling` — the rate that was applied (in basis points). Captured at invoice creation so the rate can't drift if merchant later changes their tax settings.
- `taxJurisdictionAtBilling` — the jurisdiction label at the time of billing
- `subtotalCents`, `taxCents`, `totalCents`

This audit trail proves what rate was applied to which charge, which matters for tax filing and for chargeback disputes.

---

## 11. Webhook architecture

Merchants can subscribe to webhook events to integrate with their own systems.

### 11.1 Event types

All `SubscriptionEvent` types are eligible for webhook delivery. Additionally:
- `invoice.created`
- `invoice.paid`
- `invoice.failed`
- `invoice.refunded`

### 11.2 Webhook configuration

Each merchant configures their webhook endpoints in their portal:
- One or more endpoint URLs
- Subscribed event types per endpoint
- HMAC secret for signing webhook payloads

### 11.3 Delivery

Webhook delivery is asynchronous and retried. A separate cron job `webhook-delivery-tick` runs every 5 minutes and dispatches queued webhooks.

Each delivery attempt:
1. POSTs the event payload to the endpoint URL
2. Includes `X-SalonTransact-Signature` header with HMAC-SHA256 of the body using the merchant's secret
3. Expects 2xx response within 10 seconds
4. On non-2xx or timeout, retries on exponential backoff: 1 min, 5 min, 30 min, 2 hr, 6 hr, 24 hr
5. After 24 hours of failures, mark webhook delivery as `failed` and surface in merchant portal

V1 supports up to 100 webhook events per merchant per day in queue. V2 may add higher limits and dead-letter queues.

### 11.4 Webhook payload format

```json
{
  "id": "evt_cuid",
  "type": "subscription.activated",
  "createdAt": "2026-06-01T14:23:00Z",
  "data": {
    "subscriptionId": "sub_cuid",
    "merchantId": "mer_cuid",
    "customerId": "cus_cuid",
    "planId": "plan_cuid",
    "amount": 7900,
    "currency": "USD",
    "status": "active"
  }
}
```

---

## 12. Email templates and notifications

Email is critical to dunning and customer experience. Templates go in SendGrid.

### 12.1 Template list

**Customer-facing:**
- `subscription_welcome` — sent immediately after signup
- `subscription_trial_ending_3_days` — sent 3 days before trial ends
- `subscription_charged` — receipt for each successful charge
- `subscription_payment_failed_attempt_1` — first failure
- `subscription_payment_failed_attempt_2` — second failure
- `subscription_payment_failed_attempt_3` — final attempt warning
- `subscription_paused_payment_failed` — after dunning exhausted
- `subscription_paused_by_customer` — customer initiated pause
- `subscription_resumed` — resumed after pause
- `subscription_canceled` — confirmation of cancellation
- `subscription_card_expiring_soon` — card expires in 30 days
- `subscription_login_link` — magic link for portal access

**Merchant-facing:**
- `merchant_subscription_failed_terminal` — alert when a customer's subscription is paused due to failed payment
- `merchant_weekly_summary` — weekly recap of new subs, churn, MRR (V1 simple version)

### 12.2 Template variables

All templates support standard variables:
- Customer name, email
- Merchant name, address, support email, support phone
- Subscription plan name, price, interval
- Next billing date
- Self-serve portal URL
- Specific call-to-action URLs (update payment, cancel, etc.)

### 12.3 Reynapay.com sending domain

Emails send from `notifications@reynapay.com` (your existing domain with DKIM/SPF/DMARC already configured). Reply-to is the merchant's support email if configured, else `support@reynapay.com`.

---

## 13. Compliance posture

Subscription billing is regulated. V1 must be compliant out of the gate.

### 13.1 Card network rules

Visa, Mastercard, and Amex all require:
- Cardholder must explicitly consent to recurring charges (mandate)
- Mandate text must be unambiguous about price, interval, and how to cancel
- Customer must receive email confirmation immediately after signup
- Receipt for each charge
- Easy cancellation mechanism
- Customer can dispute charges through their bank

V1 captures and stores `mandateAcceptedAt`, `mandateText`, `mandateIpAddress`, `mandateUserAgent` per subscription. The exact mandate text varies by channel:

**Customer self-serve:** Must be displayed prominently on the signup page, customer must check a box to confirm.

**Stylist at chair:** Customer signs or initials on a touchscreen. Mandate text shown on screen.

**Master portal admin:** Admin attests on behalf, with a record of which admin and when.

### 13.2 State auto-renewal laws

The following states have specific auto-renewal disclosure laws. V1 must comply with all of them because Salon Envy operates across multiple states and the strictest applies:

**California (most strict):** Pre-renewal notice required for any subscription with auto-renewal. Cancellation method must be disclosed at signup. Same method used for signup must be available for cancellation (if signed up online, can cancel online).

**Texas:** Notice required for auto-renewing contracts of $50/year or more.

**New York:** Similar to California, with specific disclosure requirements.

**Illinois, Oregon, North Carolina, Florida, Connecticut, Vermont, Tennessee, Hawaii:** Various flavors of auto-renewal disclosure requirements.

V1 ships with a single compliance posture that meets the California standard. This is overkill for Texas but satisfies all states simultaneously.

Specific implementation:
- Signup page must display: price, interval, that subscription auto-renews, how to cancel, link to cancellation policy
- Email confirmation must include all of the above
- 7-14 days before annual renewals, automated email reminder is sent
- Cancellation must be available through the same channel as signup (web → web cancellation must be one-click after authentication)

### 13.3 GDPR / CCPA considerations

V1 customer self-serve portal supports:
- Data export (customer can download all their subscription data)
- Account deletion (customer can request deletion; subscription data is anonymized but retained per accounting requirements)

### 13.4 PCI scope

V1 does not increase PCI scope. All cards continue to be tokenized via Payroc Hosted Fields. SalonTransact stores secureTokenIds, not card data.

---

## 14. Security and PCI considerations

### 14.1 Customer self-serve portal authentication

Magic-link auth has known security tradeoffs:
- Pros: no passwords to manage, no password reset flow, lower friction
- Cons: email account takeover = subscription account takeover, link expiration is the only defense against shared/leaked links

V1 mitigations:
- Links expire after 15 minutes
- Single-use (link is invalidated after first click)
- Rate limiting on login link requests (max 3 per hour per email)
- Audit log of every login

### 14.2 API authentication for the billing engine

Cron-triggered endpoints (`/api/cron/billing-engine`, `/api/cron/dunning-engine`, `/api/cron/cleanup-engine`) are authenticated via a shared secret in the `Authorization` header:

```
Authorization: Bearer ${process.env.CRON_SECRET}
```

Vercel Cron supports this natively. The secret is set in env vars and rotated quarterly.

### 14.3 Webhook signing

Outbound webhooks are signed with HMAC-SHA256 using a per-merchant secret. Merchants verify signatures on their end to confirm the webhook came from SalonTransact and wasn't tampered with.

### 14.4 Mandate audit trail

Every state transition captures the IP address and user agent of the actor (where applicable). This is critical for chargeback disputes — when a customer disputes a recurring charge, we must be able to produce evidence of their original consent.

---

## 15. Observability and operations

### 15.1 Logging

All subscription engine operations log structured events to Vercel logs:
- Cron job start/end with duration
- Each charge attempt with subscription ID, invoice ID, amount, result
- Each tax calculation with merchant rate, jurisdiction, subtotal, computed tax
- Each webhook delivery with endpoint, status, response time

### 15.2 Metrics

V1 dashboard (in master portal):
- Total MRR (sum of active subscriptions normalized to monthly)
- Subscriber count by status
- Churn rate (cancellations / starting count, monthly)
- Failed payment rate (failed invoices / total invoices, monthly)
- Trial conversion rate (active subscriptions / completed trials)

### 15.3 Alerts

V1 critical alerts (page Robert):
- Billing engine hasn't run in 90 minutes
- Dunning engine hasn't run in 5 hours
- Tax calculation errors > 10% of invoices in the last hour (shouldn't happen with merchant-rate calc, but defensive)
- Payroc API failure rate > 10% in the last hour
- More than 5% of active subscriptions transitioned to `past_due` in the last hour (possible systemic problem)

V1 warning alerts (email):
- Webhook delivery success rate < 90% for any merchant
- Card expiration emails not sending

### 15.4 Operational runbook

A separate document `docs/subscriptions-runbook.md` (written during Phase 1) covers:
- How to manually fire a billing engine tick
- How to manually retry a failed invoice
- How to refund a subscription charge
- How to pause/cancel a subscription via SQL (last resort)
- How to investigate "customer says they were charged but didn't subscribe"
- How to investigate "customer says they cancelled but were charged again"

---

## 16. Phased build plan

V1 ships in 4 phases. Each phase is independently shippable to production. After each phase, we pause for a week of real-world testing before starting the next.

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Master portal can create subscriptions against existing saved cards. Manual billing trigger from admin UI. No automated cron yet.

**Deliverables:**
- Prisma migration creating all new tables
- `lib/subscriptions/state-machine.ts` with full state machine
- `lib/subscriptions/billing.ts` with `chargeInvoice` function
- `lib/subscriptions/tax.ts` with merchant-rate tax calculation
- `/api/subscriptions` CRUD endpoints
- `/api/subscriptions/[id]/charge-now` admin-only manual trigger
- `/master/subscriptions/new` admin UI to create subscriptions
- `/master/subscriptions` list view
- `/master/subscriptions/[id]` detail view with billing history
- Email: `subscription_welcome`, `subscription_charged`, `subscription_payment_failed_attempt_1`
- Webhook delivery for `subscription.created`, `invoice.paid`, `invoice.failed`

**Out of scope for Phase 1:**
- Automated cron-based billing
- Stylist-at-chair UI
- Customer self-serve signup
- Customer self-serve portal
- Trial support (subscriptions go directly to active)
- Dunning beyond first failure email

**Exit criteria:**
- Robert can create a subscription for himself, manually charge it monthly via admin UI for 4 consecutive months, see correct tax calculated via TaxJar, receive email receipts each time.

### Phase 2: Automation (Weeks 3-4)

**Goal:** Billing engine runs on cron. Trial support. Multi-attempt dunning.

**Deliverables:**
- `/api/cron/billing-engine-tick` endpoint with full charge logic
- `/api/cron/dunning-engine-tick` endpoint with retry logic
- Trial support (`trialing` state, trial-end conversion)
- All dunning email templates
- Card expiration warning emails
- `vercel.json` cron schedule configuration
- Alerting for missed cron runs

**Exit criteria:**
- Subscription created on day 1 with 7-day trial auto-charges on day 8
- Subscription with bad card goes through full 4-attempt dunning, ends paused
- Cron job runs reliably for 7 consecutive days without intervention

### Phase 3: Customer flows (Weeks 5-6)

**Goal:** Customers can sign up themselves. Customers can manage their subscriptions self-serve. Stylist UI ships.

**Deliverables:**
- `/subscribe/[slug]` public signup page with full state compliance disclosures
- `/portal/login` magic-link auth
- `/portal/subscriptions` customer dashboard
- `/portal/subscriptions/[id]/update-payment`
- `/portal/subscriptions/[id]/pause`
- `/portal/subscriptions/[id]/cancel`
- `/portal/subscriptions/[id]/history` with invoice PDF download
- `/merchant/subscriptions/new` stylist-at-chair UI
- Plan management UI at `/merchant/plans`
- Mandate text capture per channel

**Exit criteria:**
- Customer can sign up via public link, receive welcome email, log into portal, update payment method, pause, resume, cancel
- Salon staff can enroll a walk-in customer in <90 seconds from the merchant portal

### Phase 4: Polish and launch (Weeks 7-8)

**Goal:** Production-ready for 500 subscribers.

**Deliverables:**
- MRR dashboard in master portal
- Churn analytics
- Trial conversion analytics
- Merchant webhook configuration UI
- Operational runbook
- Load testing at 1,000 simulated subscribers (10x V1 target for headroom)
- Security audit pass: SQL injection, XSS, CSRF, authentication boundary tests
- Compliance review: California ARL checklist, mandate capture validation, email template legal review
- Public launch announcement

**Exit criteria:**
- 50 internal test subscribers running for 2 weeks without intervention
- Load test passes with no failures at 1,000 simulated subscribers
- Compliance checklist passes
- Public launch

---

## 17. Risk register

Risks that could derail V1, prioritized by impact × probability.

### High impact, high probability

**Billing engine bug double-charges customers.** Mitigation: idempotency keys on every Payroc call. Test with simulated double-fires in CI. Manual reconciliation report run weekly during launch.

**Merchant configures wrong tax rate.** With merchant-configured rates, merchants can set incorrect rates by mistake or ignorance. Mitigation: at minimum, the rate config UI shows a "common rates by state" reference table. Long-term mitigation: V2 integrates a tax service. Until then, this is a known limitation merchants must accept when onboarding.

**Customer claims they didn't authorize a recurring charge (chargeback).** Mitigation: full mandate capture per Section 13.1. Audit log of every state transition. Confidence we can produce consent evidence on demand.

### High impact, medium probability

**Vercel Cron silently stops running.** Mitigation: alert on missing tick. Manual fire button. Daily reconciliation report.

**Payroc terminal config doesn't support recurring transactions properly.** Mitigation: confirm with Matt during Phase 1 that terminal 173347015 supports `recurring` initiation flag and `standingInstructions` field. Test thoroughly in Phase 2.

**State compliance violation triggers regulatory action.** Mitigation: California ARL is the strict standard. Build to that. Legal review of email templates and signup page before launch.

### Medium impact, medium probability

**SendGrid deliverability degrades.** Mitigation: reynapay.com SPF/DKIM/DMARC already configured. Monitor sender reputation. Have backup transactional email provider (Postmark, Mailgun) in mind.

**Customer self-serve portal magic-link auth abused.** Mitigation: rate limiting, link expiration, single-use links. Audit log of every login.

### Low impact, high probability

**Edge case in proration when customer's anchor day doesn't exist in a month (e.g., signed up Jan 31, what about Feb).** Mitigation: cap anchor days at 28 in V1. Solved by data model design.

**Stylist accidentally enrolls wrong customer or wrong plan.** Mitigation: confirmation screen before final submit. Admin can void within 24 hours from master portal.

### Watching list (low priority but worth tracking)

- Card updater service (Visa/Mastercard automatic card update on reissue) — not in V1, but customers with expired cards generate dunning load. V2 candidate.
- International payment methods — not in V1. US-only launch.
- Native mobile app — not in V1. Web responsive only.

---

## 18. Open questions

These need answers before or during Phase 1.

1. **What's the exact mandate text we'll use?** Needs legal review. Sample: "By subscribing, you agree to be charged $[amount] every [interval] until you cancel. You can cancel anytime at [portal URL]. We'll send you a reminder 7 days before each charge." Need real legal review of this wording.

2. **What default tax rates do we suggest to merchants during onboarding?** A "common rates by state" reference table would help merchants set their rate correctly without guessing. Worth populating before V1 onboards multiple merchants. Source: state department of revenue websites, or a one-time CSV import from a tax data provider.

3. **Cancellation refund policy (ANSWERED).** Customer receives a prorated refund of the unused portion of the current cycle when they cancel. Calculated as: refund = subtotal × (days_remaining_in_cycle / total_days_in_cycle). Tax on the refunded portion is also refunded. Refund issued automatically to the original payment method via Payroc refund API. Customer can still cancel at end of cycle (no refund needed) as an option in the UI.

4. **What happens on payment method update for a past-due subscription?** V1 plan: retry the failed invoice immediately. Confirm.

5. **Should we expose a stylist-facing dashboard of their subscribers?** Useful for the stylist channel — "these are the customers I've enrolled, here's my MRR contribution." Out of V1 scope but worth flagging for V2.

6. **Multiple subscriptions per customer per merchant (ANSWERED).** Allowed. Each subscription is independent — independent billing, independent cancellation, independent payment method on file (though the customer may use the same saved card for all). A customer at Salon Envy can subscribe to Membership AND Color Club simultaneously.

7. **Tax-exempt customers (nonprofits, resellers): how is exemption certified?** V1 plan: customer uploads cert, admin manually approves, sets `taxExempt` flag. V2 candidate for automation.

8. **What's the launch announcement strategy?** Out of engineering scope but needs business planning before public launch.

---

## Appendix A: Reference architectures considered

We looked at how Stripe Billing, Recurly, Chargebee, Paddle, and Lemon Squeezy structure their data models and chose the patterns that best fit our needs:

- **Plan / Subscription / Invoice as separate entities:** Standard across all major billing platforms. We follow.
- **Event log table:** Stripe's approach. We adopt.
- **Mandate stored verbalim per subscription:** Required by card networks. All platforms do this.
- **State machine with explicit transitions:** Recurly's documented approach is the cleanest. We adopt with modifications.

We deliberately diverge from Stripe Billing on:
- Customer self-serve portal: ours is simpler. No team features, no role management, no multi-account.
- Tax: V1 uses merchant-configured rates rather than an external service. V2+ adds Stripe Tax or TaxJar based on volume justification.
- Webhook delivery: ours is simpler. No webhook UI testing tools in V1.

---

## Appendix B: Open-source libraries we'll use

- **SendGrid Node.js SDK** (`@sendgrid/mail`) — already in use
- **node-cron** (no — use Vercel Cron natively)
- **luxon** or **date-fns** for date math (calculating next billing dates, anchor day logic, time zone handling)
- **zod** for runtime validation of webhook payloads, API requests (already in codebase)

No new heavyweight dependencies. Subscription platform is mostly application code on top of existing primitives (Prisma, Payroc, SendGrid).

---

## Appendix C: Naming conventions

- File paths use kebab-case: `subscriptions-engine.ts`, not `subscriptionsEngine.ts`
- API routes follow REST conventions: `GET /api/subscriptions`, `POST /api/subscriptions`, `PATCH /api/subscriptions/:id`
- Event types use dot notation: `subscription.created`, `invoice.paid`
- Database columns use camelCase (Prisma convention)
- Enums use SCREAMING_SNAKE_CASE for values (`MONTHLY`, `WEEKLY`)

---

## Appendix D: Revision history

**v1.0 (May 22, 2026)** — Initial draft. Designed around TaxJar tax service integration. Cancellation refund policy unconfirmed. Multiple subscriptions per customer unconfirmed.

**v1.1 (May 26, 2026)** — Three substantive changes after stakeholder review:
1. Tax strategy changed from TaxJar API integration to merchant-configured rates (cost savings of $40-100/month, simpler architecture, defers third-party service to V2 when volume justifies). All TaxJar references replaced. Data model updated: SubscriptionInvoice stores taxRateAtBilling and taxJurisdictionAtBilling instead of taxJarOrderId and taxBreakdown.
2. Cancellation refund policy answered: prorated refund of unused portion of current cycle, calculated by days remaining vs total days in cycle.
3. Multiple subscriptions per customer per merchant confirmed allowed.

---

**End of design document v1.1**

Push back on anything you disagree with. The data model and state machine are the most load-bearing decisions; everything else can flex.
