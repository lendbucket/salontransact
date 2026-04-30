/**
 * Dispatch table — maps testCaseId to an executor function or marks
 * it as manual entry. Tests not listed default to manual.
 */

import {
  executeCardSale,
  executePreAuth,
  executeSecureTokenCreate,
  TEST_CARDS,
  type ExecutorContext,
  type ExecutorResult,
} from "./executor";

export type DispatchEntry =
  | { kind: "auto"; run: (ctx: ExecutorContext) => Promise<ExecutorResult> }
  | { kind: "manual"; reason: string };

export const DISPATCH: Record<string, DispatchEntry> = {
  // CNP — Hosted Fields singleUseToken generation (browser-only)
  "cnp-hf-cc-sut-generate": { kind: "manual", reason: "Hosted Fields tokenization happens in the browser. Generate at /checkout, then paste the singleUseToken." },

  // CNP — Credit Card Sale NO Secure Token
  "cnp-cc-nst-sale-approved": { kind: "auto", run: (ctx) => executeCardSale(ctx, { amountCents: 4500, testCardNumber: TEST_CARDS.visa, expectedOutcome: "approved", saveCard: false }) },
  "cnp-cc-nst-sale-decline-01": { kind: "auto", run: (ctx) => executeCardSale(ctx, { amountCents: 4501, testCardNumber: TEST_CARDS.visa, expectedOutcome: "declined", saveCard: false }) },
  "cnp-cc-nst-sale-avs-03": { kind: "auto", run: (ctx) => executeCardSale(ctx, { amountCents: 4503, testCardNumber: TEST_CARDS.visa, expectedOutcome: "approve_or_decline", saveCard: false }) },
  "cnp-cc-nst-sale-cvv-04": { kind: "auto", run: (ctx) => executeCardSale(ctx, { amountCents: 4504, testCardNumber: TEST_CARDS.visa, expectedOutcome: "approve_or_decline", saveCard: false }) },
  "cnp-cc-nst-sale-referral-02": { kind: "auto", run: (ctx) => executeCardSale(ctx, { amountCents: 4502, testCardNumber: TEST_CARDS.visa, expectedOutcome: "referral", saveCard: false }) },

  // CNP — Credit Card Sale WITH Create Secure Token
  "cnp-cc-cst-sale-approved": { kind: "auto", run: (ctx) => executeCardSale(ctx, { amountCents: 4500, testCardNumber: TEST_CARDS.mastercard, expectedOutcome: "approved", saveCard: true }) },
  "cnp-cc-cst-sale-decline-01": { kind: "auto", run: (ctx) => executeCardSale(ctx, { amountCents: 4501, testCardNumber: TEST_CARDS.mastercard, expectedOutcome: "declined", saveCard: true }) },
  "cnp-cc-cst-sale-avs-03": { kind: "auto", run: (ctx) => executeCardSale(ctx, { amountCents: 4503, testCardNumber: TEST_CARDS.mastercard, expectedOutcome: "approve_or_decline", saveCard: true }) },
  "cnp-cc-cst-sale-cvv-04": { kind: "auto", run: (ctx) => executeCardSale(ctx, { amountCents: 4504, testCardNumber: TEST_CARDS.mastercard, expectedOutcome: "approve_or_decline", saveCard: true }) },
  "cnp-cc-cst-sale-referral-02": { kind: "auto", run: (ctx) => executeCardSale(ctx, { amountCents: 4502, testCardNumber: TEST_CARDS.mastercard, expectedOutcome: "referral", saveCard: true }) },

  // CNP — Credit Card Sale WITH Previously Created Secure Token (needs prerequisite)
  "cnp-cc-pst-sale-approved": { kind: "manual", reason: "Requires existing saved card. Run cnp-cc-cst-sale-approved first." },
  "cnp-cc-pst-sale-decline-01": { kind: "manual", reason: "Requires existing saved card." },
  "cnp-cc-pst-sale-avs-03": { kind: "manual", reason: "Requires existing saved card." },
  "cnp-cc-pst-sale-cvv-04": { kind: "manual", reason: "Requires existing saved card." },
  "cnp-cc-pst-sale-referral-02": { kind: "manual", reason: "Requires existing saved card." },

  // CNP — Pre-Auth + Capture NO Secure Token
  "cnp-cc-preauth-nst-approved": { kind: "auto", run: (ctx) => executePreAuth(ctx, { amountCents: 4500, testCardNumber: TEST_CARDS.visa, expectedOutcome: "approved" }) },
  "cnp-cc-preauth-nst-capture": { kind: "manual", reason: "Run AFTER cnp-cc-preauth-nst-approved. Capture chaining in next commit." },
  "cnp-cc-preauth-nst-decline-01": { kind: "auto", run: (ctx) => executePreAuth(ctx, { amountCents: 4501, testCardNumber: TEST_CARDS.visa, expectedOutcome: "declined" }) },
  "cnp-cc-preauth-nst-avs-03": { kind: "auto", run: (ctx) => executePreAuth(ctx, { amountCents: 4503, testCardNumber: TEST_CARDS.visa, expectedOutcome: "approve_or_decline" }) },
  "cnp-cc-preauth-nst-cvv-04": { kind: "auto", run: (ctx) => executePreAuth(ctx, { amountCents: 4504, testCardNumber: TEST_CARDS.visa, expectedOutcome: "approve_or_decline" }) },
  "cnp-cc-preauth-nst-referral-02": { kind: "auto", run: (ctx) => executePreAuth(ctx, { amountCents: 4502, testCardNumber: TEST_CARDS.visa, expectedOutcome: "referral" }) },

  // CNP — Pre-Auth + Capture WITH Create Secure Token
  "cnp-cc-preauth-cst-approved": { kind: "auto", run: (ctx) => executePreAuth(ctx, { amountCents: 4500, testCardNumber: TEST_CARDS.mastercard, expectedOutcome: "approved" }) },
  "cnp-cc-preauth-cst-capture": { kind: "manual", reason: "Capture chaining in next commit." },
  "cnp-cc-preauth-cst-decline-01": { kind: "auto", run: (ctx) => executePreAuth(ctx, { amountCents: 4501, testCardNumber: TEST_CARDS.mastercard, expectedOutcome: "declined" }) },
  "cnp-cc-preauth-cst-avs-03": { kind: "auto", run: (ctx) => executePreAuth(ctx, { amountCents: 4503, testCardNumber: TEST_CARDS.mastercard, expectedOutcome: "approve_or_decline" }) },
  "cnp-cc-preauth-cst-cvv-04": { kind: "auto", run: (ctx) => executePreAuth(ctx, { amountCents: 4504, testCardNumber: TEST_CARDS.mastercard, expectedOutcome: "approve_or_decline" }) },
  "cnp-cc-preauth-cst-referral-02": { kind: "auto", run: (ctx) => executePreAuth(ctx, { amountCents: 4502, testCardNumber: TEST_CARDS.mastercard, expectedOutcome: "referral" }) },

  // CNP — Pre-Auth WITH Previously Created Secure Token (needs prerequisite)
  "cnp-cc-preauth-pst-approved": { kind: "manual", reason: "Requires existing saved card." },
  "cnp-cc-preauth-pst-capture": { kind: "manual", reason: "Capture chaining in next commit." },
  "cnp-cc-preauth-pst-decline-01": { kind: "manual", reason: "Requires existing saved card." },
  "cnp-cc-preauth-pst-avs-03": { kind: "manual", reason: "Requires existing saved card." },
  "cnp-cc-preauth-pst-cvv-04": { kind: "manual", reason: "Requires existing saved card." },
  "cnp-cc-preauth-pst-referral-02": { kind: "manual", reason: "Requires existing saved card." },

  // CNP — Pre-Auth + ADJUST (no engine support)
  "cnp-cc-preauth-adjust-approved": { kind: "manual", reason: "Pre-auth ADJUST not yet supported by engine." },
  "cnp-cc-preauth-adjust-adjust": { kind: "manual", reason: "Adjust API not yet wired." },
  "cnp-cc-preauth-adjust-capture": { kind: "manual", reason: "Adjust flow." },
  "cnp-cc-preauth-adjust-decline-01": { kind: "manual", reason: "Adjust flow." },
  "cnp-cc-preauth-adjust-avs-03": { kind: "manual", reason: "Adjust flow." },
  "cnp-cc-preauth-adjust-cvv-04": { kind: "manual", reason: "Adjust flow." },
  "cnp-cc-preauth-adjust-referral-02": { kind: "manual", reason: "Adjust flow." },

  // CNP — Void / Refund
  "cnp-cc-void-same-day": { kind: "manual", reason: "Run after a fresh sale — paste paymentId." },
  "cnp-cc-refund-next-day": { kind: "manual", reason: "Run after a fresh sale — paste refund paymentId." },
  "cnp-cc-unreferenced-refund": { kind: "manual", reason: "Engine rejects unreferenced refunds. Use Payroc Selfcare UI." },

  // CNP — Secure Token
  "cnp-cc-token-create": { kind: "auto", run: (ctx) => executeSecureTokenCreate(ctx, { testCardNumber: TEST_CARDS.visa }) },
  "cnp-cc-token-update": { kind: "manual", reason: "Run AFTER cnp-cc-token-create — paste secureTokenId." },
  "cnp-cc-token-delete": { kind: "manual", reason: "Run AFTER cnp-cc-token-create — paste secureTokenId." },

  // CNP — Recurring + ACH + Surcharging (all manual)
  "cnp-cc-recurring-first": { kind: "manual", reason: "Recurring not yet wired." },
  "cnp-cc-recurring-subsequent": { kind: "manual", reason: "Recurring not yet wired." },
  "cnp-hf-ach-sut-generate": { kind: "manual", reason: "ACH Hosted Fields in browser." },
  "cnp-hf-ach-sut-sale": { kind: "manual", reason: "ACH not yet wired." },
  "cnp-ach-nst-sale": { kind: "manual", reason: "ACH not yet wired." },
  "cnp-ach-cst-sale": { kind: "manual", reason: "ACH not yet wired." },
  "cnp-ach-void-same-day": { kind: "manual", reason: "ACH not yet wired." },
  "cnp-ach-refund-7-days": { kind: "manual", reason: "ACH not yet wired." },
  "cnp-ach-token-create": { kind: "manual", reason: "ACH not yet wired." },
  "cnp-ach-token-update": { kind: "manual", reason: "ACH not yet wired." },
  "cnp-ach-token-delete": { kind: "manual", reason: "ACH not yet wired." },
  "cnp-ach-recurring-first": { kind: "manual", reason: "ACH not yet wired." },
  "cnp-ach-recurring-subsequent": { kind: "manual", reason: "ACH not yet wired." },
  "cnp-surcharge-accept": { kind: "manual", reason: "Surcharging not yet wired." },
  "cnp-surcharge-decline": { kind: "manual", reason: "Surcharging not yet wired." },
  "cnp-dual-pricing": { kind: "manual", reason: "Dual pricing not yet wired." },
  "cnp-service-fee": { kind: "manual", reason: "Service fee not yet wired." },

  // CP — All card-present (manual — requires Pax A920 Pro terminal)
  "cp-cc-nst-sale-approved": { kind: "manual", reason: "Card-present on Pax A920 Pro terminal." },
  "cp-cc-nst-sale-decline-01": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-nst-sale-avs-03": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-nst-sale-cvv-04": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-nst-sale-referral-02": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-cst-sale-approved": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-cst-sale-decline-01": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-cst-sale-avs-03": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-cst-sale-cvv-04": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-cst-sale-referral-02": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-approved": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-capture": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-decline-01": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-avs-03": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-cvv-04": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-referral-02": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-adjust-approved": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-adjust-adjust": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-adjust-capture": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-adjust-decline-01": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-adjust-avs-03": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-adjust-cvv-04": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-preauth-adjust-referral-02": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-void-same-day": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-refund-next-day": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-unreferenced-refund": { kind: "manual", reason: "Card-present — Selfcare UI." },
  "cp-cc-error-bad-card": { kind: "manual", reason: "Card-present error injection on terminal." },
  "cp-cc-token-create": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-token-sale": { kind: "manual", reason: "Card-present on terminal." },
  "cp-cc-token-update": { kind: "manual", reason: "Card-present on terminal." },
  "cp-surcharge-accept": { kind: "manual", reason: "Card-present on terminal." },
  "cp-surcharge-decline": { kind: "manual", reason: "Card-present on terminal." },
  "cp-dual-pricing": { kind: "manual", reason: "Card-present on terminal." },
  "cp-service-fee": { kind: "manual", reason: "Card-present on terminal." },
};

export function getDispatchEntry(testCaseId: string): DispatchEntry {
  return DISPATCH[testCaseId] ?? { kind: "manual", reason: "No executor configured for this test case." };
}
