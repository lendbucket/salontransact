# Reyna Pay Engine — Master Roadmap

**Status:** Active reference document. Updated as phases ship.

**Last updated:** 2026-04-29 (after Day 3 of Phase 8.5, post-Payroc call with Matt + Chris)

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

## Phase 10 — SalonTransact deepening (next 6–8 weeks after Phase 9)

**Goal:** Make SalonTransact a 10/10 engine for one vertical (salons) before templatizing for other verticals. The features below are what make Reyna Pay's processing materially better than Square/Stripe/Clover for salon owners.

Build in this priority order:

### 10.1 — Operational intelligence
- **Cash flow forecasting** — "based on bookings + recurring patterns, you'll deposit $X on Friday"
- **Stylist productivity scoreboard** — gamified leaderboard (revenue, biggest tickets, rebook rate, tip percentage)
- **Smart deposit holds** — alert when chargeback ratio creeps toward Visa's 0.65% monitoring threshold

### 10.2 — Customer intelligence
- **Visit frequency segmentation** — auto-classify regular / occasional / lapsed
- **Lifetime value scoring** — every customer profile shows LTV, surfaces gold clients to stylists
- **Birthday automation** — saved-card-on-file customers get a $X credit on their birthday, auto-redeems

### 10.3 — Compliance & risk
- **PCI compliance status visualization** — show merchants their PCI scope (small thanks to Hosted Fields)
- **Chargeback evidence pack auto-builder** — one click pulls transaction record, customer profile, signed receipts, IP/geo, prior visit history; routes to Reyna Pay support
- **Velocity controls** — auto-flag suspicious patterns (same card used 5+ times in 1 hour, decline-then-approve within minutes)

### 10.4 — Money movement
- **Same-day payouts (T+0)** — opt-in, ~1% fee, vs default T+1 standard
- **Split deposits** — owner gets X%, business account gets Y%, automatic at settlement
- **Multi-location consolidation** — single owner, multiple salons, one dashboard, separate MIDs per location for clean accounting

### 10.5 — Integrations
- **QuickBooks sync** — every transaction auto-categorizes to GL accounts
- **Booking system webhooks** — Vagaro/Booksy/Square Appointments hooks to pre-authorize cards at booking time
- **Email marketing sync** (Mailchimp, Klaviyo) — customer list with LTV/segmentation flows out

### 10.6 — Differentiator features (real moat)
- **Negotiated rates pass-through** — show merchants exactly what they pay vs. what Visa charges; transparent unbundled pricing
- **Statement parser** — merchant uploads competitor statement, we auto-show "with us, you'd save $X/mo"
- **Switching wizard** — merchant uploads 3 months of competitor statements, we pre-populate the application from extracted data

### 10.7 — Future-Tier-4 (AI features competitors will have soon)
- **ML fraud scoring** — every transaction scored for fraud risk before approval
- **Predictive chargeback risk** — flag transactions with high chargeback probability
- **Customer churn prediction** — flag clients who haven't booked in N days, recommend outreach

### Build estimate
- Phase 10 total: 6–8 weeks if done in priority order
- Subsections 10.1–10.4 are the core (4–5 weeks)
- 10.5 (integrations) is parallelizable
- 10.6 is sales-tooling, build alongside or just after
- 10.7 deferred to year 2 unless competitive pressure

### Multi-location & franchise readiness
Phase 10 explicitly **prepares** for multi-location merchants but does NOT yet implement multi-tenant brand switching:
- Multi-location consolidation (10.4): single owner with multiple salons sees them all in one view, but they're all under one Reyna Pay brand (SalonTransact)
- Each location gets its own MID, its own settlements, its own reporting
- Owner dashboard shows roll-up across locations
- Permissions: owner can see all locations; location managers see only their location

This is multi-LOCATION (merchant-level), not multi-BRAND (engine-level). Multi-brand is Phase 12.

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
Phase 10  → SalonTransact becomes a 10/10 vertical engine
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
