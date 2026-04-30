# Strategic Decisions Log

**Purpose:** Capture every major architectural decision and the reasoning 
behind it. Read this BEFORE proposing changes that affect provider choice, 
infrastructure dependencies, or product scope. Decisions here are locked 
unless explicitly revisited in a new strategic session.

---

## SD-001: Payroc as sole payment processor

**Date locked:** 2026-04-29
**Reaffirmed:** 2026-04-30
**Status:** ACTIVE

**Decision:** Reyna Pay uses Payroc exclusively for card-present and 
card-not-present payment processing. No Stripe Connect, no other acquirer.

**Reasoning:**
- Payroc cert work (Phase 9) is 80% complete (Robert + Matt + Chris)
- Pax A920 Pro device already deployed to Salon Envy locations
- Salon vertical fit is strong on Payroc
- Adding a second acquirer doubles reconciliation, compliance, and 
  outage risk
- Migrating to Stripe Connect would invalidate ~3 weeks of cert work

**Revisit triggers:** Payroc cert process fails or stalls > 3 months, 
Payroc raises pricing > 50%, Payroc terminates relationship, business 
expands to verticals where Payroc is structurally weak.

---

## SD-002: No Stripe Treasury for any purpose

**Date locked:** 2026-04-30
**Status:** ACTIVE

**Decision:** Reyna Pay will not use Stripe Treasury — neither for 
corporate finance nor for merchant-facing instant payouts.

**Reasoning:**
- Per yesterday's analysis (SD-005), real instant payouts require 
  Treasury or equivalent BaaS, but adding Stripe Treasury creates 
  structural Stripe dependency that goes against SD-001
- Mercury account (already approved for Reyna Pay LLC) handles 
  corporate finance needs
- "Just use Treasury for our own corp" is a slippery slope toward 
  deeper Stripe lock-in
- Stripe Treasury terms explicitly prohibit nested third-party 
  sender use, which closes the door on using it as payroll rails 
  anyway (SD-004)

**Revisit triggers:** Mercury becomes inadequate for corporate finance 
needs, treasury-tier features become essential to a specific product, 
strategic pivot toward Stripe ecosystem.

---

## SD-003: No Wise for treasury/operations

**Date locked:** 2026-04-30
**Status:** ACTIVE

**Decision:** Reyna Pay will not use Wise Business as a banking or 
treasury provider.

**Reasoning:**
- Wise is a money services business focused on cross-border, not a 
  Banking-as-a-Service platform
- Wise terms don't permit third-party-sender use cases (same as Stripe)
- Mercury is sufficient for current US-domestic operations
- No current cross-border merchant volume to justify the integration

**Revisit triggers:** International merchant expansion (RestaurantTransact 
or other vertical going global), specific cross-border product need.

---

## SD-004: Payroll deferred to post-Phase-10/11

**Date locked:** 2026-04-30
**Status:** DEFERRED

**Decision:** Payroll is NOT on the 2026 roadmap. Revisit when Phase 10 
(engine completion) and Phase 11 (Kasse) close.

**Reasoning:**
- Building payroll from scratch requires NACHA Third-Party Sender 
  registration (~6-12 months paperwork), ODFI banking relationship 
  (separate from Stripe/Wise/Mercury), tax filing infrastructure for 
  IRS + 50 states, bonding ($100K-500K), E&O insurance, tax notice 
  handling team, ~$150K-200K Year 1 hard costs
- Embedded options (Check, Gusto Embedded, ADP Embedded) handle all 
  compliance + filings + ODFI for ~$6-15 per employee per month wholesale
- Vagaro (closest competitor in salon vertical) chose Gusto Embedded; 
  Square Payroll is essentially wrapped Gusto; Toast embeds. Pattern 
  matches.
- Stripe Treasury / Wise CANNOT serve as the NACHA-compliant payroll 
  rails — both prohibit nested-third-party-sender use in their terms
- Adding payroll now means context-switching across 4 major surfaces 
  (engine, Kasse, payroll, Phase 9 cert), reducing focus
- Real bottleneck right now is Phase 9 production cert + Phase 10 
  engine completion + Phase 11 Kasse build

**When to revisit:**
- Phase 10 complete (engine v1 surface fully shipped)
- Phase 11 complete (Kasse v1 in production)
- First merchant live on production Payroc
- Real merchant feedback confirms payroll integration is highest 
  marginal feature ask

**When revisited, options to consider:**
- (A) Embed Check or Gusto, wrap in salon-specific UI (8-12 weeks)
- (B) Embed first, build native replacement over 18-24 months in 
  parallel (Square / Toast pattern)
- (C) Defer indefinitely if other features prove higher-ROI

**Building from scratch immediately is NOT considered viable** given 
NACHA/IRS/state-agency complexity + asymmetric risk (one missed 
federal deposit = 100% Trust Fund Recovery Penalty). Robert reviewed 
the analysis on 2026-04-30 and agreed to defer.

---

## SD-005: No real instant payouts (push-to-card)

**Date locked:** 2026-04-29
**Reaffirmed:** 2026-04-30
**Status:** ACTIVE

**Decision:** Reyna Pay does not offer real instant payouts (Stripe 
Instant-style push-to-debit-card). Same-day funding via Payroc is the 
fastest available payout option.

**Reasoning:**
- Real instant payouts require Treasury partner + Visa Direct 
  certification + reserve capital + state money transmitter analysis
- Treasury option (SD-002) closed
- Same-day funding via Payroc is real and shippable (Phase 10.9 
  descoped to wrap Payroc same-day funding, not build push-to-card)

**Revisit triggers:** Reyna Pay achieves scale where treasury 
infrastructure becomes economically justified (~$50M+ annual 
processing volume), Treasury partner relationship opens (separate 
from Stripe), product strategy shifts.

---

## SD-006: Verticalized engine + best-of-breed embedded providers

**Date locked:** 2026-04-29
**Reaffirmed:** 2026-04-30
**Status:** ACTIVE

**Decision:** Reyna Pay engine is the proprietary core. External 
providers handle commodity infrastructure (acquiring, payroll-future, 
treasury-future, etc.). Engine is replaceable-provider-agnostic where 
possible.

**Reasoning:**
- Pattern matches Shopify (Stripe + others), Toast (Marqeta + others), 
  Square (Wells Fargo + others)
- Engine outlasts any single provider relationship
- Vertical specialization is the moat, not infrastructure ownership
- Lower capital requirements + faster time-to-market

**Application examples:**
- Payroc = current acquirer (provider; replaceable in theory)
- Mercury = current bank (provider; replaceable in theory)
- Gusto/Check/ADP = future payroll (provider; chosen on revisit)
- Engine code = proprietary (the moat)

---

## SD-007: AI-agent-friendly API surface

**Date locked:** 2026-04-30
**Status:** ACTIVE — implementation in Phase 10.13

**Decision:** The Reyna Pay v1 API will be designed and documented to 
enable AI agents (Claude Code, Cursor, ChatGPT operators, custom 
voice receptionist agents in Kasse) to integrate without human 
hand-holding.

**Reasoning:**
- Stripe Sessions 2026 announcements made clear AI agents will be 
  significant economic actors
- Even if Reyna Pay doesn't build agent-specific products, the 
  engine MUST be agent-friendly for downstream consumers (Kasse 
  voice receptionist, future RestaurantTransact, third-party POS 
  integrations)
- Implementation cost is small (good docs, good error messages, 
  idempotency, clean OpenAPI spec)
- Locks in long-term API durability

**Application:**
- Phase 10.13 IMPLEMENTATION KIT specifically references AI agent 
  integration
- OpenAPI 3.1 spec auto-generated for machine-readable contract
- Master integration prompt explicitly written for Claude Code / Cursor 
  consumption
- Vertical quick-starts include "AI agent flows" section

---

## SD-008: Stripe Projects + Stripe MCP usable as internal dev tools only

**Date locked:** 2026-04-30
**Status:** ACTIVE — informal use only

**Decision:** Stripe Projects (CLI for provisioning external services) 
and Stripe MCP (Model Context Protocol server for Stripe APIs) may be 
used internally by Robert + Claude Code as developer productivity 
tools. They are NOT customer-facing infrastructure and do NOT bind 
Reyna Pay to Stripe ecosystem dependency.

**Reasoning:**
- Useful for provisioning Vercel + Supabase + Resend etc. via CLI
- Useful when Reyna Pay's own corporate finance has a Stripe-account 
  task
- No customer-facing exposure, no merchant data flowing through
- Trivial to stop using if needed

**Application:**
- Use Stripe Projects CLI when starting new Reyna Pay sub-projects 
  (Kasse repo, future verticals)
- Use Stripe MCP when interacting with the existing approved Stripe 
  Connect account for corporate finance tasks
- Do NOT integrate either into the SalonTransact engine or merchant-
  facing flows

---

## SD-009: Phase ordering protected

**Date locked:** 2026-04-30
**Status:** ACTIVE

**Decision:** Strategic recalibration sessions cannot inject new Phase 
work into already-committed Phase 10 / 11 / 9 scope. New strategic 
ideas land in the "future phases" section with a target revisit date, 
NOT inline with active work.

**Reasoning:**
- Yesterday's session shipped 40+ commits; today's session has shipped 
  zero. That's appropriate (strategy days don't ship), but it must be 
  one day, not many.
- Risk of constant scope inflation if every Stripe announcement / 
  industry news cycle reshuffles the roadmap
- Phase 10 is 80% done; finishing it is dramatically higher ROI than 
  starting any new direction

**Application:**
- Payroll = post-Phase 10/11 (not interleaved)
- Future verticals (RestaurantTransact, etc.) = Phase 13+
- Reseller program = Phase 14+ (already deferred)
- Treasury / instant payouts / Stripe products = revisit triggers, 
  not active phases

---

## SD-010: Hosted Fields SDK version pinned to whatever Payroc confirms

**Date locked:** 2026-04-30
**Status:** ACTIVE — version-pin policy

**Decision:** Do NOT upgrade the Payroc Hosted Fields SDK
(`lib/payroc/hosted-fields.ts`) without explicit confirmation from
Payroc that the new version is compatible with our processing
terminal config. Stay on the version Payroc confirms works for
terminal `6535001` until Matt or Chris explicitly approves an
upgrade path.

**Reasoning:**

- On 2026-04-27, commit `6d06f75` upgraded SDK from `1.6.0.172429`
  → `1.7.0.261457` to pick up the `destroy()` method documented at
  https://docs.payroc.com/guides/take-payments/hosted-fields/extend-your-integration/close-a-session
- The `destroy()` method works, BUT 1.7.0.261457 sends a different
  request shape to `testpayments.worldnettps.com/.../single-use-tokens`
  — specifically `content-length: 0` (empty body POST).
- Our terminal config was provisioned against the older SDK request
  shape. Result: gateway returns 400 "Missing required field" on
  every tokenization attempt.
- Real production charge from earlier (the $56.65 AmEx) was processed
  on 1.6.0 and worked fine. The 1.7.0 upgrade silently broke UAT
  tokenization without any error in our build pipeline.
- Slack message sent to Chris/Matt 2026-04-30 with cURL evidence
  asking what 1.7.0 expects from the terminal side.

**Application:**

- Before any Hosted Fields SDK version bump, post the proposed
  version + integrity hash to Payroc in Slack and wait for written
  confirmation that terminal `6535001` (UAT) and the production
  terminal config support that version.
- If a documented SDK feature requires a version bump (e.g.
  `destroy()` requires 1.7.0+), get terminal-config approval
  BEFORE merging the bump.
- Pin the SDK version in `lib/payroc/hosted-fields.ts` with the
  exact integrity hash. Do not use floating versions or "latest".
- Treat any "Unsupported property" or `400 Missing required field`
  console errors as cert blockers. Investigate before shipping.

**Revisit triggers:**

- Payroc explicitly recommends an upgrade path for our terminal
- Payroc deprecates the version we're pinned to
- A Hosted Fields feature we genuinely need requires a newer SDK
  AND Payroc has confirmed terminal support

---

## How to use this document

When proposing a change that touches infrastructure providers, product 
scope, or major architectural direction:

1. Read the relevant SD entries above
2. Identify which decision your proposal would change
3. Check the "Revisit triggers" section
4. If a trigger has not occurred, the decision stands
5. If you genuinely believe the decision should change, schedule a 
   strategic recalibration session — DO NOT relitigate during 
   day-to-day shipping

This document is the source of truth. The engine roadmap implements 
these decisions. The capability matrix documents what each decision 
means in practice.
