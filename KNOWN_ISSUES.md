# Known Issues

Pre-existing issues in `lib/payroc/` identified during the refund feature
planning phase. None of these affect the currently-working hosted-fields
payment flow. They are tracked here so they don't get lost.

**Do not fix these as part of refund feature work.** Each fix is its own
isolated change with its own verification ritual.

## Issue 1: `reversePayment` doesn't accept an amount

**File:** `lib/payroc/payments.ts`
**Symptom:** No way to call `POST /payments/{paymentId}/reverse` with a
partial amount, even though the Payroc docs make `amount` an optional body
field for partial reversals.
**Impact:** None today (no caller uses this function). Will block partial
reversals when the refund UI ships.
**Workaround in refund feature:** the refund feature uses its own request
helper in `lib/refunds/payroc-helper.ts` that supports passing a body with
an amount. The existing `reversePayment` is left untouched.

## Issue 2: `payrocRequest` generates a fresh idempotency key per call

**File:** `lib/payroc/client.ts`
**Symptom:** `crypto.randomUUID()` is generated inside `payrocRequest` for
every POST. The caller has no way to provide a stable key, so app-level
dedup (e.g. preventing double-click refunds) cannot align with Payroc's
own 7-day idempotency window.
**Impact:** None for current payment flow (each checkout is a unique
request). Would matter for any retry logic.
**Workaround in refund feature:** `lib/refunds/payroc-helper.ts` is a
parallel request function that requires a caller-provided idempotency key.
Existing `payrocRequest` is left untouched.

## Issue 3: `listPayments` query parameters do not match Payroc spec

**File:** `lib/payroc/payments.ts`
**Symptom:** Sends `startDate`, `endDate`. Per the Payroc docs, the actual
parameter names are `dateFrom` and `dateTo`. Currently latent because no
caller passes these params.
**Impact:** Filtered payment list calls return unfiltered results.
**Fix scope:** Single function rename of query params. Low-risk standalone
change after refunds ship.

## Issue 4: `listPayments` return type doesn't match Payroc response shape

**File:** `lib/payroc/payments.ts` and `lib/payroc/types.ts`
**Symptom:** Function types its return as `{ payments: [...], total: number }`.
Per the Payroc docs, the actual response is `{ limit, count, hasMore, data: [...], links: [...] }`.
**Impact:** Any consumer that destructures `payments` or reads `total`
would get undefined. Currently latent.
**Fix scope:** Update the type definition and any consumer code. Should be
fixed before the refund feature lists payments to a user.
