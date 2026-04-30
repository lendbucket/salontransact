/**
 * Cert test executor — runs individual test cases against the engine
 * by calling internal libraries (NOT HTTP routes) for speed and
 * correctness.
 *
 * Each executor returns ExecutorResult with paymentId + status. The
 * /api/master/cert-tests/runs/{id}/run route updates the CertTestRun
 * row with the outcome.
 *
 * Test card numbers + amount-ending response codes come from Matt's
 * spreadsheet (TESTING DIRECTIONS sheet):
 *   .00, .05-.09 → Approved
 *   .01 → Decline
 *   .02 → Referral
 *   .03 → AVS failure (may decline)
 *   .04 → CVV decline (may decline)
 */

import { processCharge } from "@/lib/api/v1/charges/process";
import { processCapture } from "@/lib/api/v1/charges/capture";
import { processRefund } from "@/lib/api/v1/charges/refund";
import { processVoid } from "@/lib/api/v1/charges/void";
import {
  createSecureToken,
  updateSecureToken,
  deleteSecureToken,
} from "@/lib/payroc/tokens";
import { prisma } from "@/lib/prisma";

// Payroc UAT test cards (from Matt's spreadsheet)
export const TEST_CARDS = {
  visa: "4539858876047062",
  mastercard: "5001650000000000",
  amex: "3400000000000000",
  discover: "6011000000000004",
} as const;

export const TEST_CVV = "123";

export interface ExecutorContext {
  sessionId: string;
  merchantId: string;
  apiKeyId: string;
  testRunId: string;
}

export interface ExecutorResult {
  ok: boolean;
  paymentId: string | null;
  status: "passed" | "failed";
  errorMessage: string | null;
  notes: string;
  internalTransactionId?: string;
  capturedSecureTokenId?: string;
}

// ─────────────────────────────────────────────────────────────────
// Card sale tests
// ─────────────────────────────────────────────────────────────────

interface CardSaleParams {
  amountCents: number;
  testCardNumber: string;
  expectedOutcome: "approved" | "declined" | "referral" | "approve_or_decline";
  saveCard: boolean;
}

export async function executeCardSale(
  ctx: ExecutorContext,
  params: CardSaleParams
): Promise<ExecutorResult> {
  // Create a secure token from test card (keyed), then use its token for the charge.
  // This bypasses Hosted Fields — for cert testing only.
  const sutResult = await createSingleUseTokenFromTestCard(params.testCardNumber, ctx.merchantId);
  if (!sutResult.ok) {
    return {
      ok: false,
      paymentId: null,
      status: "failed",
      errorMessage: `Single-use token creation failed: ${sutResult.error}`,
      notes: "",
    };
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: ctx.merchantId },
    select: { businessName: true },
  });

  const result = await processCharge({
    apiKeyId: ctx.apiKeyId,
    merchantId: ctx.merchantId,
    merchantBusinessName: merchant?.businessName ?? "Cert Test",
    parsed: {
      amountCents: params.amountCents,
      currency: "usd",
      description: `Cert test ${ctx.testRunId}`,
      source: { type: "saved_card", id: sutResult.savedPaymentMethodId },
      customerId: null,
      customerEmail: null,
      customerName: null,
      capture: true,
      stylistId: null,
      bookingId: null,
      tipAmountCents: 0,
      items: null,
      metadata: { certTest: true, testRunId: ctx.testRunId },
    },
    requestId: `cert-${ctx.testRunId}`,
  });

  const succeeded = result.ok && result.status === "succeeded";
  let testPassed = false;
  let notes = "";

  switch (params.expectedOutcome) {
    case "approved":
      testPassed = succeeded;
      notes = succeeded ? "Approved as expected" : `Expected approval but got: ${result.declineReason ?? result.errorMessage}`;
      break;
    case "declined":
      testPassed = !succeeded;
      notes = !succeeded ? `Declined as expected (${result.declineReason ?? "no reason"})` : "Expected decline but got approval";
      break;
    case "referral":
      testPassed = true;
      notes = succeeded ? "Approved (gateway treated referral as approval)" : `Declined with referral code (${result.declineReason})`;
      break;
    case "approve_or_decline":
      testPassed = true;
      notes = succeeded ? "Approved" : `Declined (${result.declineReason})`;
      break;
  }

  return {
    ok: testPassed,
    paymentId: result.payrocPaymentId,
    status: testPassed ? "passed" : "failed",
    errorMessage: testPassed ? null : (result.errorMessage ?? result.declineReason ?? "Test outcome mismatch"),
    notes,
    internalTransactionId: result.transactionId ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────
// Pre-auth
// ─────────────────────────────────────────────────────────────────

interface PreAuthParams {
  amountCents: number;
  testCardNumber: string;
  expectedOutcome: "approved" | "declined" | "referral" | "approve_or_decline";
}

export async function executePreAuth(
  ctx: ExecutorContext,
  params: PreAuthParams
): Promise<ExecutorResult> {
  const sutResult = await createSingleUseTokenFromTestCard(params.testCardNumber, ctx.merchantId);
  if (!sutResult.ok) {
    return {
      ok: false,
      paymentId: null,
      status: "failed",
      errorMessage: `Single-use token creation failed: ${sutResult.error}`,
      notes: "",
    };
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: ctx.merchantId },
    select: { businessName: true },
  });

  const result = await processCharge({
    apiKeyId: ctx.apiKeyId,
    merchantId: ctx.merchantId,
    merchantBusinessName: merchant?.businessName ?? "Cert Test",
    parsed: {
      amountCents: params.amountCents,
      currency: "usd",
      description: `Cert pre-auth test ${ctx.testRunId}`,
      source: { type: "saved_card", id: sutResult.savedPaymentMethodId },
      customerId: null,
      customerEmail: null,
      customerName: null,
      capture: false,
      stylistId: null,
      bookingId: null,
      tipAmountCents: 0,
      items: null,
      metadata: { certTest: true, testRunId: ctx.testRunId, preauth: true },
    },
    requestId: `cert-${ctx.testRunId}`,
  });

  const authorized = result.ok && result.status === "requires_capture";
  let testPassed = false;
  let notes = "";

  switch (params.expectedOutcome) {
    case "approved":
      testPassed = authorized;
      notes = authorized ? "Pre-authorized as expected" : `Expected pre-auth but got: ${result.declineReason ?? result.errorMessage}`;
      break;
    case "declined":
      testPassed = !authorized;
      notes = !authorized ? `Declined as expected (${result.declineReason ?? "no reason"})` : "Expected decline but pre-auth succeeded";
      break;
    case "referral":
    case "approve_or_decline":
      testPassed = true;
      notes = authorized ? "Pre-auth approved" : `Declined (${result.declineReason})`;
      break;
  }

  return {
    ok: testPassed,
    paymentId: result.payrocPaymentId,
    status: testPassed ? "passed" : "failed",
    errorMessage: testPassed ? null : (result.errorMessage ?? result.declineReason),
    notes,
    internalTransactionId: result.transactionId ?? undefined,
  };
}

// ─────────────────────────────────────────────────────────────────
// Secure tokens (create / update / delete)
// ─────────────────────────────────────────────────────────────────

export async function executeSecureTokenCreate(
  ctx: ExecutorContext,
  params: { testCardNumber: string }
): Promise<ExecutorResult> {
  try {
    const result = await createSecureToken({
      source: {
        type: "card",
        cardDetails: {
          type: "keyed",
          keyedData: {
            type: "plainText",
            cardNumber: params.testCardNumber,
            expiryDate: "1227",
            cvv: TEST_CVV,
          },
        },
      },
      mitAgreement: "unscheduled",
      operator: "Cert Test",
    });

    return {
      ok: true,
      paymentId: result.secureTokenId,
      status: "passed",
      errorMessage: null,
      notes: `Secure token created: ${result.secureTokenId}`,
      capturedSecureTokenId: result.secureTokenId,
    };
  } catch (e) {
    return {
      ok: false,
      paymentId: null,
      status: "failed",
      errorMessage: e instanceof Error ? e.message : "Token creation failed",
      notes: "",
    };
  }
}

export async function executeSecureTokenUpdate(
  _ctx: ExecutorContext,
  params: { secureTokenId: string }
): Promise<ExecutorResult> {
  try {
    const result = await updateSecureToken(params.secureTokenId, {
      mitAgreement: "recurring",
    });
    return {
      ok: true,
      paymentId: result.secureTokenId,
      status: "passed",
      errorMessage: null,
      notes: "Secure token updated",
    };
  } catch (e) {
    return {
      ok: false,
      paymentId: null,
      status: "failed",
      errorMessage: e instanceof Error ? e.message : "Token update failed",
      notes: "",
    };
  }
}

export async function executeSecureTokenDelete(
  _ctx: ExecutorContext,
  params: { secureTokenId: string }
): Promise<ExecutorResult> {
  try {
    await deleteSecureToken(params.secureTokenId);
    return {
      ok: true,
      paymentId: params.secureTokenId,
      status: "passed",
      errorMessage: null,
      notes: "Secure token deleted",
    };
  } catch (e) {
    return {
      ok: false,
      paymentId: null,
      status: "failed",
      errorMessage: e instanceof Error ? e.message : "Token delete failed",
      notes: "",
    };
  }
}

// ─────────────────────────────────────────────────────────────────
// Helper: Create a keyed secure token from a test card, then use
// its payrocToken for charges via the saved_card source path.
//
// We create a real SavedPaymentMethod row so processCharge can
// resolve it via the standard saved_card flow.
// ─────────────────────────────────────────────────────────────────

async function createSingleUseTokenFromTestCard(
  cardNumber: string,
  merchantId?: string
): Promise<{ ok: true; savedPaymentMethodId: string } | { ok: false; error: string }> {
  try {
    const result = await createSecureToken({
      source: {
        type: "card",
        cardDetails: {
          type: "keyed",
          keyedData: {
            type: "plainText",
            cardNumber,
            expiryDate: "1227",
            cvv: TEST_CVV,
          },
        },
      },
      mitAgreement: "unscheduled",
      operator: "Cert SUT",
    });

    // Create a temporary SavedPaymentMethod row so processCharge can use the saved_card path
    const row = await prisma.savedPaymentMethod.create({
      data: {
        merchantId: merchantId ?? "cert-temp",
        customerEmail: "cert-test@reynapay.com",
        payrocSecureTokenId: result.secureTokenId,
        payrocToken: result.token,
        last4: cardNumber.slice(-4),
        status: "active",
        mitAgreement: "unscheduled",
      },
    });

    return { ok: true, savedPaymentMethodId: row.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
