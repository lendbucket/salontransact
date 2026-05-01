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
  createSingleUseToken,
  updateSecureToken,
  deleteSecureToken,
} from "@/lib/payroc/tokens";
import { sendPaymentInstruction } from "@/lib/payroc/devices";
import { capturePayment, reversePayment, refundPayment } from "@/lib/payroc/payments";
import { pollPaymentInstruction } from "@/lib/cert/cp-polling";
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
  terminalSerial: string | null;
  previousPaymentId: string | null;
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
  // Mirror production: get a Payroc single-use token from the test card.
  // processCharge will convert it to a permanent secureToken and charge it.
  const sutResult = await createSingleUseTokenFromTestCard(params.testCardNumber);
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
      source: { type: "single_use_token", id: sutResult.token },
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
  const sutResult = await createSingleUseTokenFromTestCard(params.testCardNumber);
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
      source: { type: "single_use_token", id: sutResult.token },
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
  _ctx: ExecutorContext,
  params: { testCardNumber: string }
): Promise<ExecutorResult> {
  // Two-step: SUT from test card → permanent secureToken from SUT.
  // Mirrors production exactly (lib/api/v1/charges/process.ts:44-55).
  try {
    const sut = await createSingleUseToken({
      cardNumber: params.testCardNumber,
      expiryDate: "1227",
      cvv: TEST_CVV,
    });

    const result = await createSecureToken({
      source: { type: "singleUseToken", token: sut.token },
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
// Card-Present executors (Phase 9.7 Commit 19b)
// ─────────────────────────────────────────────────────────────────

interface CardPresentSaleParams {
  amountCents: number;
  expectedOutcome: "approved" | "declined" | "referral" | "approve_or_decline";
  createToken?: boolean;
}

export async function executeCardPresentSale(
  ctx: ExecutorContext,
  params: CardPresentSaleParams
): Promise<ExecutorResult> {
  if (!ctx.terminalSerial) {
    return { ok: false, paymentId: null, status: "failed", errorMessage: "CP test requires a Pax terminal", notes: "" };
  }

  // Payroc orderId max is 24 chars. cuid first 8 chars are time-based
  // with enough entropy. Date.now() base36 adds uniqueness. ~23 chars total.
  const orderId = `cert-${ctx.testRunId.slice(0, 8)}-${Date.now().toString(36)}`;
  let instructionId: string;
  try {
    const instruction = await sendPaymentInstruction(ctx.terminalSerial, {
      order: { orderId, description: `Cert CP sale ${ctx.testRunId}`, amount: params.amountCents, currency: "USD", dateTime: new Date().toISOString() },
      autoCapture: true,
      processAsSale: false,
      operator: "Cert Test",
      ...(params.createToken ? { credentialOnFile: { storeCard: true, mitAgreement: "unscheduled" } } : {}),
    });
    instructionId = instruction.paymentInstructionId;
  } catch (e) {
    return { ok: false, paymentId: null, status: "failed", errorMessage: `Failed to send instruction: ${e instanceof Error ? e.message : "unknown"}`, notes: "" };
  }

  const pollResult = await pollPaymentInstruction({ paymentInstructionId: instructionId });
  if (pollResult.status === "timeout") {
    return { ok: false, paymentId: null, status: "failed", errorMessage: pollResult.errorMessage, notes: `Timed out after ${Math.round(pollResult.pollDurationMs / 1000)}s` };
  }

  const succeeded = pollResult.status === "completed";
  let testPassed = false;
  let notes = "";
  switch (params.expectedOutcome) {
    case "approved":
      testPassed = succeeded;
      notes = succeeded ? `Approved on terminal (${pollResult.pollAttempts} polls)` : `Expected approval but got ${pollResult.status}: ${pollResult.errorMessage}`;
      break;
    case "declined":
      testPassed = !succeeded && pollResult.status === "failure";
      notes = !succeeded ? `Declined as expected (${pollResult.errorMessage ?? "no message"})` : "Expected decline but transaction completed";
      break;
    case "referral":
    case "approve_or_decline":
      testPassed = true;
      notes = succeeded ? "Approved on terminal" : `Declined (${pollResult.errorMessage ?? pollResult.status})`;
      break;
  }

  return { ok: testPassed, paymentId: pollResult.paymentId, status: testPassed ? "passed" : "failed", errorMessage: testPassed ? null : pollResult.errorMessage, notes };
}

interface CardPresentPreAuthParams {
  amountCents: number;
  expectedOutcome: "approved" | "declined" | "referral" | "approve_or_decline";
}

export async function executeCardPresentPreAuth(
  ctx: ExecutorContext,
  params: CardPresentPreAuthParams
): Promise<ExecutorResult> {
  if (!ctx.terminalSerial) {
    return { ok: false, paymentId: null, status: "failed", errorMessage: "CP test requires a Pax terminal", notes: "" };
  }

  // Payroc orderId max 24 chars.
  const orderId = `cert-pa-${ctx.testRunId.slice(0, 6)}-${Date.now().toString(36)}`;
  let instructionId: string;
  try {
    const instruction = await sendPaymentInstruction(ctx.terminalSerial, {
      order: { orderId, description: `Cert CP pre-auth ${ctx.testRunId}`, amount: params.amountCents, currency: "USD", dateTime: new Date().toISOString() },
      autoCapture: false,
      processAsSale: false,
      operator: "Cert Test",
    });
    instructionId = instruction.paymentInstructionId;
  } catch (e) {
    return { ok: false, paymentId: null, status: "failed", errorMessage: `Failed to send instruction: ${e instanceof Error ? e.message : "unknown"}`, notes: "" };
  }

  const pollResult = await pollPaymentInstruction({ paymentInstructionId: instructionId });
  if (pollResult.status === "timeout") {
    return { ok: false, paymentId: null, status: "failed", errorMessage: pollResult.errorMessage, notes: "" };
  }

  const authorized = pollResult.status === "completed";
  let testPassed = false;
  let notes = "";
  switch (params.expectedOutcome) {
    case "approved":
      testPassed = authorized;
      notes = authorized ? "Pre-authorized on terminal" : `Expected pre-auth but got ${pollResult.status}: ${pollResult.errorMessage}`;
      break;
    case "declined":
      testPassed = !authorized;
      notes = !authorized ? "Declined as expected" : "Expected decline but pre-auth succeeded";
      break;
    case "referral":
    case "approve_or_decline":
      testPassed = true;
      notes = authorized ? "Pre-auth approved" : `Declined (${pollResult.errorMessage})`;
      break;
  }

  return { ok: testPassed, paymentId: pollResult.paymentId, status: testPassed ? "passed" : "failed", errorMessage: testPassed ? null : pollResult.errorMessage, notes };
}

export async function executeCardPresentCapture(ctx: ExecutorContext): Promise<ExecutorResult> {
  if (!ctx.previousPaymentId) {
    return { ok: false, paymentId: null, status: "failed", errorMessage: "Capture requires a previous pre-auth — no previousPaymentId", notes: "Run the matching pre-auth test first." };
  }
  try {
    const result = await capturePayment(ctx.previousPaymentId, { operator: "Cert Test" });
    return { ok: true, paymentId: result.paymentId, status: "passed", errorMessage: null, notes: `Captured pre-auth ${ctx.previousPaymentId}` };
  } catch (e) {
    return { ok: false, paymentId: ctx.previousPaymentId, status: "failed", errorMessage: e instanceof Error ? e.message : "Capture failed", notes: "" };
  }
}

export async function executeCardPresentRefund(ctx: ExecutorContext): Promise<ExecutorResult> {
  if (!ctx.previousPaymentId) {
    return { ok: false, paymentId: null, status: "failed", errorMessage: "Refund requires a previous sale — no previousPaymentId", notes: "Run the matching sale test first." };
  }
  try {
    const result = await refundPayment(ctx.previousPaymentId, { reason: "Cert test refund" });
    return { ok: true, paymentId: result.paymentId, status: "passed", errorMessage: null, notes: `Refunded ${ctx.previousPaymentId}` };
  } catch (e) {
    return { ok: false, paymentId: ctx.previousPaymentId, status: "failed", errorMessage: e instanceof Error ? e.message : "Refund failed", notes: "" };
  }
}

export async function executeCardPresentVoid(ctx: ExecutorContext): Promise<ExecutorResult> {
  if (!ctx.previousPaymentId) {
    return { ok: false, paymentId: null, status: "failed", errorMessage: "Void requires a previous sale — no previousPaymentId", notes: "Run the matching sale test first." };
  }
  try {
    const result = await reversePayment(ctx.previousPaymentId);
    return { ok: true, paymentId: result.paymentId, status: "passed", errorMessage: null, notes: `Voided ${ctx.previousPaymentId}` };
  } catch (e) {
    return { ok: false, paymentId: ctx.previousPaymentId, status: "failed", errorMessage: e instanceof Error ? e.message : "Void failed", notes: "" };
  }
}

export async function executeCardPresentTokenCreate(ctx: ExecutorContext): Promise<ExecutorResult> {
  if (!ctx.terminalSerial) {
    return { ok: false, paymentId: null, status: "failed", errorMessage: "CP token create requires a Pax terminal", notes: "" };
  }
  // Payroc orderId max 24 chars.
  const orderId = `cert-tok-${ctx.testRunId.slice(0, 5)}-${Date.now().toString(36)}`;
  let instructionId: string;
  try {
    const instruction = await sendPaymentInstruction(ctx.terminalSerial, {
      order: { orderId, description: `Cert CP token create ${ctx.testRunId}`, amount: 100, currency: "USD", dateTime: new Date().toISOString() },
      autoCapture: false,
      processAsSale: false,
      operator: "Cert Test",
      credentialOnFile: { storeCard: true, mitAgreement: "unscheduled" },
    });
    instructionId = instruction.paymentInstructionId;
  } catch (e) {
    return { ok: false, paymentId: null, status: "failed", errorMessage: `Failed to send token-create instruction: ${e instanceof Error ? e.message : "unknown"}`, notes: "" };
  }

  const pollResult = await pollPaymentInstruction({ paymentInstructionId: instructionId });
  if (pollResult.status !== "completed") {
    return { ok: false, paymentId: pollResult.paymentId, status: "failed", errorMessage: pollResult.errorMessage ?? `Poll status: ${pollResult.status}`, notes: "" };
  }

  // Auto-void the placeholder $1 auth
  if (pollResult.paymentId) {
    try { await reversePayment(pollResult.paymentId); } catch { /* non-fatal */ }
  }

  return { ok: true, paymentId: pollResult.paymentId, status: "passed", errorMessage: null, notes: "Token created via terminal (placeholder auth voided)", capturedSecureTokenId: pollResult.paymentId ?? undefined };
}

// ─────────────────────────────────────────────────────────────────
// Helper: Create a single-use token from a test card via Payroc.
//
// Mirror production tokenization path: POST to /single-use-tokens.
// processCharge then converts the SUT to a permanent secureToken
// inside resolveSource() — see lib/api/v1/charges/process.ts:44-55.
//
// No DB side-effects. Cert testing does not create SavedPaymentMethod rows.
// ─────────────────────────────────────────────────────────────────

async function createSingleUseTokenFromTestCard(
  cardNumber: string
): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  try {
    const result = await createSingleUseToken({
      cardNumber,
      expiryDate: "1227",
      cvv: TEST_CVV,
    });
    return { ok: true, token: result.token };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "unknown" };
  }
}
