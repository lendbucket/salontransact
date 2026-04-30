# Deferred fixes — alert before declaring "production ready"

This file tracks bugs we've intentionally deferred. Each entry has a
trigger condition for revisiting. **Read this file at the start of any
session that touches checkout, saved-cards, or merchant onboarding.**

When SDK 1.7.0 is unblocked by Payroc and tokenization works again,
walk this list top-down before resuming Phase 10.8 Commit 66.

---

## DEF-001: `/api/saved-cards` 400 for master-portal role

**Logged:** 2026-04-30
**Severity:** Cosmetic (test-account only) — real merchants unaffected
**Revisit trigger:** After SDK 1.7.0 unblocked AND before first real merchant onboards
**Owner:** Robert / next session

### Symptom

Visiting `/checkout` while logged in as a master-portal-role user (e.g.,
Robert's account) and entering any customer email triggers a console error:

```
GET /api/saved-cards?customerEmail=<email> 400 (Bad Request)
{"error":"master portal must provide merchantId"}
```

The Save Card checkbox still works for the new-card flow. The saved-cards
lookup never returns results because the request is rejected.

### Root cause

`app/api/saved-cards/route.ts` line 286 + `resolveMerchantId` line
110-130:

- When `user.role === "master portal"`, the route requires a
  `merchantId` query param. There can be many merchants, so the route
  refuses to guess.
- `app/(dashboard)/checkout/checkout-form.tsx` line 86 calls the
  endpoint without `merchantId`:

```
/api/saved-cards?customerEmail=${encodeURIComponent(email)}
```

- Result: 400 for master portal, works fine for `merchant` role users
  (they auto-resolve via `userId`).

### Recommended fix (Option C)

Cleanest scope. Hide the saved-cards lookup + Save Card checkbox entirely
when `user.role === "master portal"`. Master portal is an admin tool, not
a real charge flow — they shouldn't be saving cards on behalf of merchants.

**Implementation:**

1. Pass session role into `CheckoutForm` as a prop from the parent
   `/checkout` page (server component reads session, passes role).
2. In `checkout-form.tsx`, gate the customer email block + checkbox JSX
   behind `userRole === "merchant"`.
3. Master portal users see only Amount / Description / Card Information.
4. No server changes. No saved-cards route changes.

Single commit, single file (plus prop wiring in `app/(dashboard)/checkout/page.tsx`).

### DO NOT

- Do NOT fix this before SDK 1.7.0 is unblocked. It's not a real-merchant
  bug and we don't validate fixes on broken tokenization.
- Do NOT switch to Option A or B without revisiting the trade-offs
  in the 2026-04-30 chat history.

---

## How to use this file

When a deferred fix is created:
1. Add a new `DEF-NNN` entry below the most recent one
2. Fill in: Logged date, Severity, Revisit trigger, Owner, Symptom,
   Root cause, Recommended fix, DO NOT
3. Reference DEF-NNN in the deferring commit message

When a deferred fix is resolved:
1. Move the entry to a `## Resolved` section at the bottom (don't
   delete — keeps audit trail)
2. Add the resolving commit hash
3. Add resolution notes if the actual fix differed from
   "Recommended fix"
