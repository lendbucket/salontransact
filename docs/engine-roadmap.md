# Reyna Pay Engine — Master Roadmap

**Status:** Active reference document. Updated as phases ship.

**Last updated:** 2026-04-29 (Phase 10.7 complete: velocity controls, risk scoring, pre-charge risk check, evidence pack builder, chargeback alerting cron)

---

## The vision

Reyna Pay is the **payment processing engine** that powers multiple branded products — both Robert's own brands and external reseller brands — under a single Payroc relationship and a single codebase.

```
                    REYNA PAY ENGINE
              (one codebase, one Payroc MID, one compliance perimeter)
                            |
        ┌───────────────────┼───────────────────────┬──────────────────┐
        |                   |                       |                  |
   Robert's Brand:    Robert's Brand:         Robert's Brand:    External Reseller:
   SalonTransact      RestaurantTransact      BookstoreTransact  "Susan's Payments"
   ├ salons.com       ├ restaurants.com       ├ books.com        ├ susans.reynapay.com
   ├ Kasse POS        ├ ResTablet POS         ├ ?                ├ Uses SalonTransact
   ├ Salon booking    ├ Reservations          ├ Inventory        |  brand or own
   └ Vertical         └ Vertical              └ Vertical         └ Earns commission
     features           features                features
```

**Robert's brands** switch via a dropdown next to the profile icon — single click, brand context changes, merchants/branding/dashboards swap. Like switching Slack workspaces.

**External resellers** are accounts within the engine with limited scope — they see only their own merchants, their own commissions, their own branded portal.

Both run on the same multi-tenant engine. Same code. Same Payroc relationship. Different brand contexts.

---

## Why this architecture matters

Most payment processors are horizontal: Stripe, Square, Adyen serve everyone. They can't justify deep vertical features for any one industry because they'd alienate the others.

Reyna Pay's bet: **go vertical, but do it across multiple verticals using the same engine.** SalonTransact crushes salons. RestaurantTransact crushes restaurants. Each vertical gets specialized features that horizontal players can't economically build, and each leverages the same underlying infrastructure.

The engine is the moat. The brands are the go-to-market.

---

## Current state (end of Day 3, 2026-04-29)

Shipped:
- Phase 8 ✅: Master portal foundation, applications, contracts, API keys, webhooks, notifications, reporting, audit
- Phase 8.5 ✅: Mobile foundation, customer search index, disputes polish, audit filters + CSV, receipt regeneration, processing statements, defensive UUID logging
- Phase 9 prep ✅: Boarding state machine (approved → submitted_to_payroc → active)

In flight:
- Awaiting full Matt/Chris call transcript (only minutes 0:22–3:16 + closing received so far)
- Awaiting Matt's reply with idempotency UUID specifics
- Test cert questions expected from Payroc tomorrow night

Single-brand SalonTransact with one Payroc relationship. NOT yet multi-tenant. NOT yet ready for RestaurantTransact or external resellers.

---

## Phase 9 — Merchant boarding (CURRENT, blocked on transcript)

**Goal:** First paying merchants on Reyna Pay's House Account.

Per Chris #7 (Payroc Boarding API is early beta, NOT GA), Phase 9 uses ERF/manual submission, not API integration.

### Unblock items
1. Full Matt/Chris call transcript (covers minutes 3:16 → 17:30)
2. Matt's reply with specific idempotency UUIDs and transaction IDs
3. Hosted Fields missing parent div field name (from Matt's email)
4. Production cert questions (expected tomorrow night)

### Build scope (after unblock)
- ERF generation: web form OR PDF that captures all required Payroc fields, signed and submitted by master
- "Submit ERF to Payroc" button → fires email to Reyna Pay's Payroc rep with ERF attached
- Email parsing: when Payroc sends back the cert letter with the MID, master clicks "Mark Active" and enters the MID (already built in Phase 9 prep)
- Merchant notification flow: when merchant transitions to "active," they get a "you can now process payments" email with login link
- Cert workflow: production cert via abridged Matt-runs-scripts approach (per memory)
- Apple Pay production cert workflow (UAT cert already needs sandbox; production cert is consumer Apple device per Chris)

### Exit criteria
- 1+ merchant successfully boarded end-to-end (application → approved → submitted_to_payroc → active → first live transaction)
- Documented runbook for boarding subsequent merchants

---

## Phase 10 — Engine v1 API build-out (47 commits, 6–8 weeks)

**Goal:** Build out SalonTransact's v1 API surface so Kasse and third-party POS systems can build rich integrations. API-first: every capability ships as a `/api/v1/*` endpoint. Merchant portal stays thin (payment ops only).

## Phase 10 Master Commit List — HONEST AUDIT

### Phase 10.1 — Chargeback monitoring (1 commit) ⚠️ NEEDS FIX
- Commit 35: Chargeback ratio computation 
  ⚠️ **AUDIT ISSUE:** Currently computes ratio from `Transaction.refunded`, 
  not real chargebacks from Payroc disputes API. Refunds ≠ chargebacks. 
  **TODO:** Replace data source with Payroc disputes endpoint.

### Phase 10.2 — Customer intelligence (1 commit) ✅ ENGINE-ONLY (HONEST)
- Commit 40: GET /customers list, lookup, detail, LTV, visits
  All endpoints query our database. No Payroc dependency. Real product.

### Phase 10.3 — Charge lifecycle (5 commits)
- Commit 41: GET /charges/[id] ✅ Real (reads Transaction)
- Commit 42: GET /charges list ✅ Real (reads Transaction)
- Commit 43: POST .../refund ✅ Real (calls Payroc /payments/{id}/refunds)
- Commit 44: POST .../capture ⚠️ NEEDS PAYROC VERIFY
- Commit 45: POST .../void ⚠️ NEEDS PAYROC VERIFY
  **TODO:** Confirm with Matt that capture/void endpoints work on House Account config.

### Phase 10.4 — Saved cards + wallets (3 code commits, 2 deferred)
- Commit 47: GET /cards + GET /cards/[id] ✅ Real
- Commit 48: DELETE /cards/[id] ⚠️ AUDIT ISSUE
  **TODO:** Verify route also calls Payroc to delete secureToken, not just our row.
- Commit 49: POST /tokenization/sessions ⚠️ NEEDS AUDIT
  **TODO:** Confirm what this endpoint actually does vs what's documented.
- Commits 50-51: Apple Pay + Google Pay 🚧 DEFERRED (per Chris cert requirement)

### Phase 10.5 — Reporting (5 commits)
- Commit 52: GET /reports/transactions ✅ Engine-only, real
- Commit 53: GET /reports/payouts ⚠️ DEPENDS ON DATA SOURCE
  **TODO:** Verify /api/cron/sync-payouts actually pulls from Payroc.
- Commit 54: GET /reports/stylist-attribution ✅ Engine-only, real
- Commit 55: GET /reports/cash-flow ⚠️ DEPENDS ON PAYOUT DATA
  Same as payouts.
- Commit 56: GET /reports/risk ✅ Engine-only, real

### Phase 10.6 — Webhook delivery (3 commits) ✅ FULLY ENGINE-OWNED
- Commits 57-59 (git 47-49): Retry with backoff, delivery history, manual replay
  All our infrastructure. No Payroc dependency. Honest.

### Phase 10.7 — Operational intelligence (5 commits) ⚠️ ONE FIX NEEDED
- Commit 60 (git 50): Velocity controls ✅ Engine-only
- Commit 61 (git 51): Risk scoring ✅ Engine-only
- Commit 62 (git 52): Pre-charge risk check API ✅ Engine-only
- Commit 63 (git 53): Evidence pack ⚠️ Engine timestamps, not card-network
  Acceptable but should be documented in IMPLEMENTATION KIT.
- Commit 64 (git 54): Chargeback alerting cron ⚠️ SAME ISSUE AS PHASE 10.1
  **TODO:** Replace refund-based ratio with Payroc disputes data.

### Phase 10.8 — Multi-location / franchise (4 commits) — TOMORROW
Engine-only Location model. Each location can have its own Payroc MID 
(per Chris's note). Honest.

### Phase 10.9 — Money movement (3 commits, REVISED) — TOMORROW
**DESCOPED from original 4 commits.** Real instant payouts removed (no Treasury).
- Same-day-payout (wraps Payroc same-day funding) ✅ Real
- Stylist allocation tracking (engine ledger only) ✅ Engine-only
- End-of-day batch close (calls Payroc batch close) ⚠️ NEEDS PAYROC VERIFY

### Phase 10.10 — Compliance / risk surface (3 commits) — TOMORROW
- PCI status query ⚠️ NEEDS AUDIT (what data is real vs synthetic)
- Audit log query ✅ Engine-only, real
- Velocity alerts feed ✅ Engine-only, real

### Phase 10.11 — Integration ecosystem (5 commits) — TOMORROW
- QuickBooks GL sync (build with QB OAuth) ✅ Real if built correctly
- Mailchimp/Klaviyo customer export ✅ Real if built correctly
- Statement parser ✅ Real (extracts from PDF/CSV)
- Switching wizard ✅ Real
- Kasse SDK foundation ✅ Real (TypeScript wrapper of v1 API)

### Phase 10.12 — Feature flags + env split (3 commits) — TOMORROW
- sk_test_* vs sk_live_* keys ✅ Real
- Per-merchant feature flags ✅ Real
- Test mode for charge/customer endpoints ✅ Real

### Phase 10.13 — IMPLEMENTATION KIT (5 commits) — TOMORROW
The IMPLEMENTATION KIT will be HONEST about every capability per the 
payroc-capability-matrix.md doc. No aspirational claims. No "instant 
payouts" without Treasury asterisk. Real engine, honestly documented.

## TODO list (audit fixes, ship FIRST tomorrow before Phase 10.8)

1. **HIGH:** Replace chargeback ratio source — Payroc disputes API not Transaction.refunded
2. **MEDIUM:** Verify DELETE /cards calls Payroc to delete secureToken
3. **MEDIUM:** Verify /api/cron/sync-payouts actually pulls from Payroc payouts/funding API
4. **LOW:** Verify capture/void endpoints work on Payroc House Account config (Matt question)
5. **LOW:** Verify /tokenization/sessions endpoint behavior vs documentation
6. **LOW:** Check evidence-pack 400 vs 404 issue (likely PowerShell, but verify)

After Phase 10.13 ships, any new vertical brand or external reseller can be onboarded in days, not weeks. Drop a single markdown file into Claude Code or Cursor and the entire Reyna Pay engine integrates against any platform.

### Phase 10.3 — Charge endpoint expansions

Completes the charge lifecycle. Consumers (Kasse, third-party POS) need to retrieve, list, refund, capture, and void charges via API. Today only POST /charges exists.

### Phase 10.4 — Saved cards + wallets

Card-on-file management as a clean API surface. Includes Apple Pay and Google Pay wallet integration: customer types in card via Apple Pay/Google Pay sheet (instead of typing card number), Hosted Fields tokenizes the wallet token the same way it tokenizes a typed card, our charge flow stays unchanged. **Apple Pay production cert workflow** (per Chris #3): UAT cert needs sandbox setup; production cert uses consumer Apple device for verification. Google Pay similar.

### Phase 10.5 — Reporting APIs

The reporting surface that Kasse, accounting integrations, and merchant dashboards consume. Flexible query API for transactions, payouts, stylist attribution rollups (Kasse uses this for end-of-day payroll), cash flow projections, and risk metrics.

### Phase 10.6 — Webhook delivery completion

Today's webhook delivery is single-attempt fire-and-forget (Commit 39). Production needs retry with exponential backoff (5 attempts over 24 hours), delivery history queries, and manual replay for failed deliveries. Cron-based retry queue.

### Phase 10.7 — Operational intelligence ✅ COMPLETE

The "engine knows things" surface. Shipped 5 commits (50-54 in git):
- **Velocity controls** (5 rules): customer 10+/24h, email 5+/1h, merchant 100+ failed/1h (card testing), amount 10x outlier, new customer > $500. Evaluated on every charge before Payroc call. VelocityAlert model persists all triggers.
- **Risk scoring**: 0-100 score computed on every Transaction with factor breakdown stored in riskFactors JSON. Bands: low/medium/high/critical.
- **Pre-charge risk check API**: GET /api/v1/risk/check — Kasse/POS systems call before submitting a charge to get score + band + recommendation + velocity alerts without actually charging.
- **Evidence pack builder**: POST /api/v1/disputes/[id]/evidence-pack — one call pulls transaction, customer profile, card details, customer history (25 prior charges), booking details, and full audit trail into structured JSON for dispute response.
- **Chargeback alerting cron**: Daily 9am UTC scan of all active merchants. Computes 90-day chargeback ratio, sends email (Resend) + SMS (Twilio) alerts at warning (≥0.4%) and excessive (≥0.65%) thresholds. ChargebackAlert model tracks all alerts with notification audit trail. Deduplicates per merchant per threshold per day.

### Phase 10.8 — Multi-location / franchise

Single owner, multiple salons, one dashboard, separate MIDs per location for clean accounting. Location model. Per-location scoping on existing endpoints. Aggregated reporting across locations. Per-location stylist/customer scoping.

### Phase 10.9 — Money movement

Same-day payouts (T+0, ~1% fee). Split deposits across multiple bank accounts. Per-stylist payout method preferences (cash, ACH, Venmo, next paycheck). End-of-day batch close trigger that distributes tips automatically.

### Phase 10.10 — Compliance / risk surface

PCI compliance status visualization (merchant dashboards show their PCI scope). Auto-built dispute evidence pack. Audit log query (scoped to API key's merchant). Velocity alerts feed.

### Phase 10.11 — Integration ecosystem

QuickBooks GL category sync. Mailchimp/Klaviyo customer export. Statement parser (merchant uploads competitor statement PDF, we auto-show "with us, you'd save $X/mo"). Switching wizard (auto-populate application from extracted statement data). Kasse SDK foundation (TypeScript npm package wrapping the v1 API for ergonomic use in Kasse + future native consumer apps).

### Phase 10.12 — Feature flags + environment split

`sk_test_*` keys hit Payroc UAT environment; `sk_live_*` keys hit production. Per-merchant feature flags (some Phase 10 features should be opt-in: same-day payouts, ML risk scoring, multi-location). Test mode for charge/customer endpoints (predictable test data, no real card touches).

### Phase 10.13 — IMPLEMENTATION KIT

The final phase. Makes Reyna Pay easy for ANY external developer to integrate.

**OpenAPI 3.1 spec** auto-generated from the v1 routes. Importable into Postman, Insomnia, Swagger UI, Stoplight. Machine-readable contract.

**Interactive docs page** at `/api/v1/docs` powered by Scalar (or similar). Beautiful, searchable, with code samples in TypeScript, Python, Ruby, cURL.

**Master integration prompt** — a single `.md` file (`docs/integration-kit/REYNA-PAY-INTEGRATION.md`) that contains:
- API surface summary
- Auth pattern with examples
- Endpoint catalog with request/response shapes
- Code samples for every common flow (charge a card, refund, save a card, look up customer, place auth hold, send card-entry SMS)
- Error handling patterns
- Idempotency key best practices
- Webhook signature verification
- Common integration patterns by use case

This is the file you (Robert) drop into a fresh Claude Code or Cursor project and say "integrate Reyna Pay payments" — Claude Code can read it once and produce a working integration in minutes.

**Vertical quick-starts** — separate `.md` files for each vertical Robert plans to launch under:
- `docs/integration-kit/quick-start-salon.md` (SalonTransact pattern, with Kasse expectations)
- `docs/integration-kit/quick-start-restaurant.md` (RestaurantTransact pattern, with table/tab/course/tip-out concepts)
- `docs/integration-kit/quick-start-tire-shop.md` (auto/repair pattern, parts + labor + multi-bay attribution)
- `docs/integration-kit/quick-start-computer-store.md` (retail + service mix, inventory + repair tickets)
- `docs/integration-kit/quick-start-gym.md` (recurring billing, class drop-ins, member tiers)
- `docs/integration-kit/quick-start-wellness.md` (massage, spa, yoga: appointment + retail + memberships)

Each is a one-page integration guide that shows: the typical customer journey, the API calls that map to that journey, the data model nuances for that vertical, the Kasse-deep features available if using a Reyna Pay POS.

**Solution review template** — `docs/integration-kit/SOLUTION-REVIEW.md`. A 30-minute architectural read for any new vertical brand or external reseller. Models the Payroc Solution Review document Robert went through. Sections: Engine architecture overview, API surface map, integration patterns, security model, money flow, compliance perimeter, support model, billing/commercial model.

After Phase 10.13 ships, the engine isn't just code — it's a productized integration platform.

---

## Phase 11 — Kasse iPad POS (parallel with Phase 10 if resources allow)

**Goal:** Native iPad POS that integrates with SalonTransact processing, with iPhone stylist app for individual login.

Per memory: "Build React Native iPad POS + iPhone stylist app on Stripe Terminal — this permanently fixes payroll attribution (once stylists log in with individual profiles, attribution is automatic)."

Note: Despite the memory saying Stripe Terminal, given Reyna Pay processes on Payroc, **Kasse will use Payroc's terminal SDK**, not Stripe Terminal. Update the memory once Payroc Terminal SDK details are confirmed (likely separate Phase 11 unblock from Payroc).

### Core scope
- Native React Native app (iPad primary, iPhone for stylist tip-pickup)
- Stylist login with individual profiles
- Cart, item builder, ticket flow
- Payroc Pax A920 Pro device integration (already have device serial 1854592644 in UAT)
- Tip selection (preset percentages + custom)
- Card-present + card-on-file flows
- Receipt printing or email/SMS
- End-of-day close + tip distribution
- Sync to SalonTransact backend (uses API keys from Phase 8)

### Why this matters
- Without Kasse: salons share one terminal login → no automatic stylist attribution → manual payroll reconciliation at end of day → errors and disputes
- With Kasse: each stylist logs into the iPhone app, taps to start a sale, the iPad terminal processes → automatic attribution via stylist ID → payroll runs itself
- This is the operational killer feature that makes Reyna Pay/SalonTransact materially different from anything else on the market for salons

### Build estimate
- Kasse v1: 8–12 weeks
- Smaller team can ship in 6 weeks if focused
- Parallelizable with Phase 10

### Vertical-specific POS for other brands
- RestaurantTransact will get a different POS (table layouts, modifiers, tabs, splits, kitchen display systems) — separate codebase, but uses the same Reyna Pay backend SDK
- Book stores would use a third POS variant
- All POS apps share the same Reyna Pay backend, just different frontends per vertical

---

## Phase 12 — Multi-tenant engine foundation (8–12 weeks after Phase 10)

**Goal:** Convert SalonTransact's single-brand architecture into a multi-tenant engine where multiple branded products run on the same codebase.

This is the biggest architectural shift in the roadmap. Done correctly, it makes RestaurantTransact a 4-week launch instead of a 6-month rebuild.

### Scope
- Add `Brand` model: id, name, slug, primaryDomain, logoUrl, primaryColorHex, supportEmail, fromAddressOverride, payrocConfigOverride (terminal IDs, etc.), featureFlags
- Add `brandId` foreign key to all major models: User, Merchant, MerchantApplication, Transaction, Customer, Notification, AuditLog, etc.
- Add `User.role` extension: "super_master" (you, see all brands) vs "master" (single-brand scope)
- Brand switcher UI: dropdown next to profile icon, shows brands the user has access to, click switches context
- Brand context middleware: every request scoped to active brand, even at the database query level
- Per-brand subdomain routing: `master.salontransact.com` shows SalonTransact, `master.restauranttransact.com` shows RestaurantTransact, etc.
- Theme system: CSS variables override per brand (logo URL, primary color, accent color, font choice)
- Email template overrides per brand: from-address, header logo, footer text
- PDF document overrides: agreement, statements, receipts get the active brand's logo + colors

### Migration risk
- Every existing query needs `WHERE brandId = activeBrand` or it leaks data across brands
- Audit log needs brand context to prevent one brand's master from seeing another brand's audit entries
- Notifications need to be brand-scoped (RestaurantTransact merchant doesn't get SalonTransact alerts)
- This is a 4-week migration done carefully, with tests, with backfill scripts. Do NOT rush it.

### Prerequisites
- SalonTransact must be live with paying merchants
- Phase 10 must be substantially complete (otherwise we're migrating a moving target)
- Real demand validated for second brand (e.g., 1+ restaurant willing to pilot RestaurantTransact)

---

## Phase 13 — Launch RestaurantTransact (4 weeks after Phase 12)

**Goal:** Prove the multi-tenant engine by launching a second branded product.

### Scope
- New brand record: RestaurantTransact, restauranttransact.com, distinct logo + colors
- Vertical-specific UI changes: terms ("table service" instead of "stylist service"), reporting categories (food vs beverage vs alcohol), tax handling (sales tax vs service tax)
- Restaurant-specific features:
  - Tab/check management
  - Course timing
  - Modifier handling
  - Tip-out among servers/bartenders/kitchen
  - Split checks
  - Kitchen display system integration
- Different POS app (Phase 11 forks — RestaurantTransact uses ResTablet, not Kasse)
- Marketing site at restauranttransact.com (mirrors Reyna Pay site structure)

### Exit criteria
- 5+ restaurant merchants live on RestaurantTransact
- Same Reyna Pay engine code, different brand context
- Owner (Robert) switches between SalonTransact and RestaurantTransact via brand dropdown

---

## Phase 14 — External reseller program (after counsel review)

**Goal:** Enable external entrepreneurs to onboard as branded resellers under the Reyna Pay engine.

See `docs/reseller-program.md` for full details.

Key distinction from Robert's own brands:
- **Robert's brands** (SalonTransact, RestaurantTransact, etc.): Robert is the legal merchant services provider, owns the brand, controls Payroc relationship for that brand. Multi-tenant engine has Robert as super-master.
- **External resellers**: Robert is STILL the legal merchant services provider. Reseller is a referral partner with branded portal. Different commission structure. Counsel-reviewed agreements.

Both use the same multi-tenant engine. The architectural difference is access scope (resellers can only see their own merchants and commissions; can't switch brand context to other brands).

### Prerequisites
- Counsel review of reseller agreement, marketing language, state compliance (FTC business opportunity rule, state MTL exposure)
- Phase 12 (multi-tenant) must be live
- Robert's own brands must be live (resellers want to join an established platform, not pre-launch)

---

## Phase architecture summary

```
Phase 9   → Real merchants on SalonTransact (single brand, manual ERF)
Phase 10  → Engine v1 API build-out (47 commits, 10.3-10.13)
Phase 11  → Kasse iPad POS (parallel with 10)
Phase 12  → Multi-tenant engine foundation (Brand model, switcher, theming)
Phase 13  → RestaurantTransact launches (proves multi-tenant works)
Phase 14  → External reseller program (after counsel)
```

Year 1 = Phases 9, 10, 11. Year 2 = Phases 12, 13, 14.

---

## Architectural principles (apply to every phase)

1. **Single Payroc relationship.** All brands and resellers run on Reyna Pay's House Account / single MID architecture. Sub-MIDs per merchant, not per brand or reseller. Compliance perimeter stays unified.

2. **Single codebase, multiple brand contexts.** Don't fork the codebase per brand. Use brand context to drive theming, terminology, feature flags. Brand differences live in data, not code.

3. **Multi-location ≠ multi-brand.** A salon owner with 3 locations is multi-location (merchant level). Robert running SalonTransact + RestaurantTransact is multi-brand (engine level). Build for both, but they're different abstractions.

4. **Vertical features in shared lib + brand-specific overrides.** Stylist productivity scoreboard lives in `lib/intelligence/`. Restaurant tab management lives in the same `lib/intelligence/` but exposed only when active brand is RestaurantTransact.

5. **Reyna Pay engine is the source of truth.** Each brand's marketing site, POS app, booking app — they all call the same Reyna Pay backend via API keys. No local databases per brand. No data drift between brands.

6. **Don't pre-build multi-tenancy.** Resist the temptation in Phase 9-11. Single-brand is faster to ship, and the Phase 12 migration becomes obvious once we see what fields actually need brand context.

7. **Counsel review for ANY commercial structure that involves real money flowing to external parties.** Reseller program, multi-brand revenue splits, white-label legal disclosures — all require lawyer input before launch.

---

## Open questions to resolve

- **Payroc Terminal SDK vs Stripe Terminal for Kasse**: Memory says Stripe Terminal but Reyna Pay processes on Payroc. Confirm which SDK Phase 11 uses. (Likely Payroc, but get confirmation from Matt.)
- **Test cert questions** from Payroc, expected tomorrow night
- **Multi-MID vs single-MID for multi-location merchants**: One merchant with 3 salons — do they get 3 sub-MIDs (clean accounting per location) or 1 MID with location codes (simpler tax/reporting)? Needs Payroc input.
- **Pricing per brand**: Do Robert's brands all charge the same processing rates, or vary by vertical? Restaurants typically pay higher rates than salons due to chargeback risk; need to decide if Reyna Pay aligns or absorbs the variance.
- **POS hardware standardization**: Pax A920 Pro for salons confirmed (UAT device 1854592644). What about restaurants? KDS integration requires different hardware ecosystem.

---

## How to use this doc

When making any architectural or product decision going forward, ask:
1. Which phase does this belong to?
2. Does this require multi-tenant changes? If yes, defer until Phase 12.
3. Is this a SalonTransact-specific feature, or engine-level capability? If engine-level, build it in shared lib.
4. Does this affect Payroc's compliance perimeter? If yes, slow down and confirm with Chris/Matt.

Update this doc when:
- A phase ships (mark exit criteria met)
- A new strategic insight changes priorities
- Feature scope changes within a phase
- New unblock items appear

---

*This is the living strategic document for Reyna Pay. Read it before starting work. Update it after shipping. Reference it when making big calls.*
