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

## Phase 9 — Path to Production (CRITICAL — gates live revenue)

**Status:** In progress. Engine works in UAT. NOT yet processing real 
money for real merchants.

This phase is the difference between "we built a thing" and "we have a 
payments business." Until Phase 9 closes, all the v1 API surface in 
Phase 10 only works against Payroc UAT. No revenue, no merchant 
billing, no chargeback exposure, no real risk.

### Phase 9.1 — Payroc production cert (BLOCKED on Matt + Chris)

**Open items:**
1. Matt: Hosted Fields parent div field name (he was emailing exact name)
2. Matt: Idempotency UUID format confirmation (we send crypto.randomUUID() per request)
3. Matt: Confirm capture/void endpoints work on House Account config 
   (added during audit — Phase 10.3 capture/void shipped but unverified against real Payroc)
4. Chris: Production cert Option 2 details — Reyna Pay live House Account, 
   abridged scripts, real cards, 1-2 business days for cert letter
5. Chris: ERF form for batch close time — where to send it once filled
6. Chris: Confirm same-day funding setup (also via ERF)

**What we ship after answers come in:**
- Production cert run-through (real cards, real auth, real capture, real refund, real void on Reyna Pay live House Account)
- ERF form filled out + submitted
- Cert letter received from Payroc Operations (1-2 business days)

### Phase 9.2 — Apple Pay integration

**Status:** DEFERRED at end of Phase 10.4 because cert path was unclear.
Now scoped properly:

**Apple Pay UAT cert (do FIRST, before production):**
- Apple Developer account active (Robert has one)
- Generate Payment Processing Certificate Signing Request (CSR)
- Upload to Apple Developer dashboard, get .cer file
- Submit cert to Payroc UAT for sandbox setup
- Test in UAT with sandbox Apple Pay environment
- Verify token exchange works through our existing Hosted Fields tokenization path

**Apple Pay production cert:**
Per Chris (Memory #14): Production uses consumer Apple device for verification, NOT sandbox. Sandbox cert only needed for UAT testing.
- Production CSR generated separately
- Submitted to Payroc Operations as part of Production Cert Option 2
- Activated alongside production credentials

**Build work (engine side, ~3 commits):**
- Apple Pay button component for consumer-facing card-entry page (/c/[token])
- Apple Pay session creation endpoint that calls Apple's validation server
- Token-exchange flow: Apple Pay token → Hosted Fields tokenization → Payroc secureToken → POST /api/v1/charges with source.type=single_use_token

### Phase 9.3 — Google Pay integration

**Same architecture as Apple Pay** — wallet token flows through Hosted Fields tokenization. Easier than Apple Pay because no per-app cert (uses merchant ID + Google Pay business profile).

**Setup:**
- Register Google Pay Business Profile (Robert)
- Get Google Pay merchant ID
- Configure Payroc UAT to accept Google Pay tokens
- Test in UAT (Google Pay TEST environment)
- Same architecture as Apple Pay for token exchange

**Build work (~2 commits):**
- Google Pay button component for /c/[token] page
- Token-exchange flow same pattern as Apple Pay

### Phase 9.4 — Production cutover

After cert + ERF + wallets:

**Environment swap:**
- Vercel production env vars updated:
  - `PAYROC_API_URL` → production URL (replace UAT)
  - `PAYROC_API_KEY` → production House Account key
  - `PAYROC_TERMINAL_ID` → production terminal ID (real merchant terminals)
  - `PAYROC_ENV` → "production"
- Idempotency keys flagged with environment so test data and live data don't collide
- Apple Pay + Google Pay merchant IDs configured

**Database considerations:**
- UAT test data stays in production DB (it's labeled with merchantId scoping; no cross-contamination)
- Real merchants get separate Merchant rows from any UAT test merchants
- All audit logs preserved

### Phase 9.5 — First merchant live

The validation gate. Real revenue moment.

**Happy path:**
1. First real merchant submits application via /apply
2. Master operator (you) reviews + approves in master portal
3. Application goes through boarding state machine: submitted → approved → submitted_to_payroc → active
4. Merchant gets API keys generated
5. Merchant runs first real charge via Hosted Fields or device
6. Real money settles via Payroc same-day (or T+1 standard)
7. Webhook fires charge.succeeded to subscriber endpoints
8. Audit log records the full flow

**Validation checklist:**
- [ ] First charge succeeded (real card, real money, real merchant)
- [ ] Charge appears in master portal transactions list
- [ ] Customer record auto-created
- [ ] Stylist attribution worked (if booking attached)
- [ ] Webhook fired to merchant's subscribed endpoint
- [ ] Receipt sent (email + SMS if configured)
- [ ] Payroc dashboard shows transaction
- [ ] Audit log entry written
- [ ] Risk score computed and stored
- [ ] Velocity check ran without false positive

### Phase 9 commit estimate

3-5 build commits (production env swap, Apple Pay button + flow, Google 
Pay button + flow, cutover documentation, first-merchant runbook).

### Phase 9 timing

**BLOCKED on Matt + Chris responses.** Targeting first merchant live 2-3 weeks once unblocked. Apple Pay UAT cert can run in parallel with waiting for Payroc cert.

### Slack message to bug Matt + Chris (send Friday morning April 30)

```
Hey Matt + Chris,

Hope you both had a solid week. Quick check-in on a few items I'm 
tracking for SalonTransact's production cert:

1. Matt — did you get a chance to email me the exact Hosted Fields 
   parent div field name? I have the rest of my CNP integration ready 
   to test against UAT.

2. Matt — any thoughts on my UUID v4 idempotency-key format? My 
   process.ts uses crypto.randomUUID() per-request. Want to confirm 
   that works server-side before I run a production batch.

3. Matt — also need to confirm: does Payroc support separate auth/capture 
   and void endpoints on Reyna Pay's House Account config? I have those 
   built but want to verify they work against real Payroc before going 
   live.

4. Chris — re: Production Cert Option 2 (Reyna Pay live House Account, 
   abridged scripts, real cards). What's the next step from my side? 
   Should I email Matt the test plan or is there a specific request 
   form?

5. Chris — for the ERF form to set batch close time at boarding, where 
   do I send it once filled? Does it go through you or directly to 
   Payroc Operations? Same question for the same-day funding ERF setup.

6. Chris — for Apple Pay, can you confirm the UAT cert path? My 
   understanding from our last call: I generate a Payment Processing 
   CSR via my Apple Developer account, submit the .cer to Payroc UAT 
   sandbox, then for production I use a consumer Apple device. Is 
   that right?

7. Chris — Google Pay setup — same path through Payroc? I need to 
   register a Google Pay Business Profile, get merchant ID, configure 
   in Payroc?

I've shipped 50+ engine commits this week and want to time the 
production cert work right. Targeting first live merchant in 2-3 weeks 
if everything aligns. Let me know what you need from me.

Thanks,
Robert
```

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

## Updated phase ordering — official sequence

1. **Phase 9.1** — Payroc production cert (BLOCKED, parallel)
2. **Phase 9.2** — Apple Pay UAT cert (can start NOW, parallel with Payroc cert)
3. **Phase 9.3** — Google Pay setup (can start NOW, parallel)
4. **Phase 10.8-10.13** — Tomorrow's engine build (NOT BLOCKED, ship in parallel)
5. **Phase 10 audit fixes** — Tomorrow morning, before 10.8
6. **Phase 9.4** — Production cutover (after Payroc cert + ERF received)
7. **Phase 9.5** — First merchant live (validation gate)
8. **Phase 11** — Kasse iPad POS (separate project, after Phase 9 + Phase 10 close)
9. **Phase 12** — Multi-tenant engine foundation (Brand model, super-master)
10. **Phase 13** — RestaurantTransact launch (proves multi-tenant)
11. **Phase 14** — External reseller program (after counsel review)

## What we can ship without Matt/Chris answers

- All of Phase 10 build (engine work, no Payroc cert dependency)
- Apple Pay UAT cert work (Apple Developer account is independent of Payroc)
- Google Pay Business Profile setup (independent of Payroc)
- Apple Pay + Google Pay button components (UI work)
- Documentation (Phase 10.13 IMPLEMENTATION KIT)

## What's actually blocked

- Production cutover (Payroc cert + ERF)
- Apple Pay production validation (Payroc operations side)
- First merchant live (everything above must be done)
- Capture/void endpoint verification (Matt confirmation)

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
