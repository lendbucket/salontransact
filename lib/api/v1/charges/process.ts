import { prisma } from "@/lib/prisma";
import { getPayrocToken } from "@/lib/payroc/client";
import { createSecureToken } from "@/lib/payroc/tokens";
import { isPayrocApiError } from "@/lib/payroc/errors";
import crypto from "crypto";
import type { ParsedChargeInput } from "./validate";

export interface ProcessChargeResult {
  ok: boolean;
  status: "succeeded" | "failed" | "requires_capture";
  transactionId: string | null;
  payrocPaymentId: string | null;
  approvalCode: string | null;
  declineReason: string | null;
  responseCode: string | null;
  errorMessage: string | null;
  sourceLast4: string | null;
  sourceBrand: string | null;
  sourceSavedPaymentMethodId: string | null;
}

interface ProcessChargeContext {
  apiKeyId: string;
  merchantId: string;
  merchantBusinessName: string;
  parsed: ParsedChargeInput;
  requestId: string;
}

async function resolveSource(ctx: ProcessChargeContext): Promise<
  | { ok: true; payrocToken: string; last4: string | null; brand: string | null; savedPaymentMethodId: string | null }
  | { ok: false; errorMessage: string }
> {
  const { source } = ctx.parsed;

  if (source.type === "saved_card") {
    const savedCard = await prisma.savedPaymentMethod.findUnique({ where: { id: source.id } });
    if (!savedCard || savedCard.merchantId !== ctx.merchantId) return { ok: false, errorMessage: `Saved card ${source.id} not found` };
    if (savedCard.status !== "active") return { ok: false, errorMessage: `Saved card ${source.id} is ${savedCard.status}` };
    if (!savedCard.payrocToken) return { ok: false, errorMessage: `Saved card ${source.id} missing payment token` };
    return { ok: true, payrocToken: savedCard.payrocToken, last4: savedCard.last4, brand: savedCard.cardScheme, savedPaymentMethodId: savedCard.id };
  }

  try {
    const secureToken = await createSecureToken({
      source: { type: "singleUseToken", token: source.id },
      mitAgreement: "unscheduled",
      operator: ctx.merchantBusinessName.slice(0, 50),
    });
    let extractedLast4: string | null = null;
    if (typeof secureToken.source.cardNumber === "string") {
      const m = secureToken.source.cardNumber.match(/(\d{4})$/);
      extractedLast4 = m ? m[1] : null;
    }
    return { ok: true, payrocToken: secureToken.token, last4: extractedLast4, brand: null, savedPaymentMethodId: null };
  } catch (e) {
    let message = "Failed to tokenize card";
    if (isPayrocApiError(e)) message = `Tokenization failed: ${(e as { body?: { message?: string }; status?: number }).body?.message ?? (e as { status?: number }).status}`;
    else if (e instanceof Error) message = `Tokenization failed: ${e.message}`;
    return { ok: false, errorMessage: message };
  }
}

async function validateReferences(ctx: ProcessChargeContext): Promise<{ ok: true } | { ok: false; errorMessage: string }> {
  const { parsed, merchantId } = ctx;
  if (parsed.stylistId) {
    const s = await prisma.stylist.findUnique({ where: { id: parsed.stylistId }, select: { merchantId: true, status: true } });
    if (!s || s.merchantId !== merchantId) return { ok: false, errorMessage: `stylist_id ${parsed.stylistId} not found` };
    if (s.status !== "active") return { ok: false, errorMessage: `stylist_id ${parsed.stylistId} is ${s.status}` };
  }
  if (parsed.bookingId) {
    const b = await prisma.booking.findUnique({ where: { id: parsed.bookingId }, select: { merchantId: true } });
    if (!b || b.merchantId !== merchantId) return { ok: false, errorMessage: `booking_id ${parsed.bookingId} not found` };
  }
  if (parsed.customerId) {
    const c = await prisma.customer.findUnique({ where: { id: parsed.customerId }, select: { merchantId: true } });
    if (!c || c.merchantId !== merchantId) return { ok: false, errorMessage: `customer_id ${parsed.customerId} not found` };
  }
  return { ok: true };
}

export async function processCharge(ctx: ProcessChargeContext): Promise<ProcessChargeResult> {
  const failResult = (msg: string): ProcessChargeResult => ({
    ok: false, status: "failed", transactionId: null, payrocPaymentId: null,
    approvalCode: null, declineReason: null, responseCode: null, errorMessage: msg,
    sourceLast4: null, sourceBrand: null, sourceSavedPaymentMethodId: null,
  });

  const refCheck = await validateReferences(ctx);
  if (!refCheck.ok) return failResult(refCheck.errorMessage);

  const sourceRes = await resolveSource(ctx);
  if (!sourceRes.ok) return failResult(sourceRes.errorMessage);

  const { payrocToken, last4, brand, savedPaymentMethodId } = sourceRes;

  const apiUrl = process.env.PAYROC_API_URL;
  const terminalId = process.env.PAYROC_TERMINAL_ID;
  if (!apiUrl || !terminalId) return { ...failResult("Payroc not configured"), sourceLast4: last4, sourceBrand: brand, sourceSavedPaymentMethodId: savedPaymentMethodId };

  let bearerToken: string;
  try { bearerToken = await getPayrocToken(); }
  catch (e) { return { ...failResult(`Auth failed: ${e instanceof Error ? e.message : "unknown"}`), sourceLast4: last4, sourceBrand: brand, sourceSavedPaymentMethodId: savedPaymentMethodId }; }

  const orderId = `V1-${ctx.parsed.bookingId ? ctx.parsed.bookingId.slice(0, 6).toUpperCase() : Date.now().toString(36).toUpperCase()}`;
  const idempotencyKey = crypto.randomUUID();
  console.log(`[PAYROC-IDEMPOTENCY] key=${idempotencyKey} path=/payments method=POST merchantId=${ctx.merchantId} amount=${ctx.parsed.amountCents} requestId=${ctx.requestId}`);

  // Match existing checkout payload structure exactly
  const payrocPayload = {
    channel: "web",
    processingTerminalId: terminalId,
    operator: ctx.merchantBusinessName.slice(0, 50),
    order: {
      orderId,
      orderDate: new Date().toISOString().split("T")[0],
      description: ctx.parsed.description?.slice(0, 100) || "SalonTransact charge",
      amount: ctx.parsed.amountCents,
      currency: ctx.parsed.currency.toUpperCase(),
    },
    paymentMethod: {
      type: "secureToken",
      token: payrocToken,
    },
  };

  let payrocResponse: Record<string, unknown> = {};
  try {
    const res = await fetch(`${apiUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
        "Idempotency-Key": idempotencyKey,
        Accept: "application/json",
      },
      body: JSON.stringify(payrocPayload),
    });

    const responseText = await res.text();
    try { payrocResponse = JSON.parse(responseText); } catch { payrocResponse = { rawText: responseText }; }

    if (!res.ok && res.status >= 500) {
      return { ok: false, status: "failed", transactionId: null, payrocPaymentId: (payrocResponse.paymentId as string) ?? null, approvalCode: null, declineReason: null,
        responseCode: null, errorMessage: `Payroc ${res.status}: upstream error`, sourceLast4: last4, sourceBrand: brand, sourceSavedPaymentMethodId: savedPaymentMethodId };
    }
  } catch (e) {
    return { ok: false, status: "failed", transactionId: null, payrocPaymentId: null, approvalCode: null, declineReason: null,
      responseCode: null, errorMessage: `Network error: ${e instanceof Error ? e.message : "unknown"}`, sourceLast4: last4, sourceBrand: brand, sourceSavedPaymentMethodId: savedPaymentMethodId };
  }

  // Parse Payroc response (matches existing checkout parsing pattern)
  const txnResult = payrocResponse.transactionResult as Record<string, unknown> | undefined;
  const responseCode = (txnResult?.responseCode ?? payrocResponse.responseCode ?? null) as string | null;
  const responseMessage = (txnResult?.responseMessage ?? payrocResponse.responseMessage ?? null) as string | null;
  const approvalCode = (txnResult?.approvalCode ?? payrocResponse.approvalCode ?? null) as string | null;
  const payrocPaymentId = (payrocResponse.paymentId ?? null) as string | null;

  const card = payrocResponse.card as Record<string, unknown> | undefined;
  const payrocLast4 = (card?.cardNumber as string)?.slice(-4) ?? (card?.lastFour as string) ?? (card?.last4 as string) ?? null;
  const payrocBrand = (card?.type ?? card?.scheme ?? card?.cardBrand ?? null) as string | null;

  const succeeded = responseCode === "A";
  const status = succeeded ? (ctx.parsed.capture ? "succeeded" : "requires_capture") : "failed";

  // Create Transaction row
  let transactionId: string | null = null;
  try {
    const txn = await prisma.transaction.create({
      data: {
        merchantId: ctx.merchantId,
        amount: ctx.parsed.amountCents / 100,
        currency: ctx.parsed.currency,
        status: succeeded ? "succeeded" : "failed",
        description: ctx.parsed.description,
        customerEmail: ctx.parsed.customerEmail,
        customerName: ctx.parsed.customerName,
        customerId: ctx.parsed.customerId,
        stylistId: ctx.parsed.stylistId,
        bookingId: ctx.parsed.bookingId,
        tipAmount: ctx.parsed.tipAmountCents / 100,
        items: ctx.parsed.items ? (ctx.parsed.items as unknown as object) : undefined,
        metadata: {
          ...((ctx.parsed.metadata ?? {}) as object),
          payrocPaymentId,
          payrocIdempotencyKey: idempotencyKey,
          orderId,
          approvalCode,
          last4: payrocLast4 ?? last4,
          cardBrand: payrocBrand ?? brand,
          source: ctx.parsed.source,
          apiKeyId: ctx.apiKeyId,
          requestId: ctx.requestId,
          v1: true,
        },
      },
    });
    transactionId = txn.id;

    if (savedPaymentMethodId) {
      await prisma.savedPaymentMethod.update({ where: { id: savedPaymentMethodId }, data: { lastUsedAt: new Date() } }).catch(() => {});
    }

    // Customer upsert if email provided and customer_id not provided
    if (ctx.parsed.customerEmail && !ctx.parsed.customerId) {
      try {
        const customer = await prisma.customer.upsert({
          where: { merchantId_email: { merchantId: ctx.merchantId, email: ctx.parsed.customerEmail } },
          update: {
            lastSeenAt: new Date(),
            ...(succeeded ? { totalTransactions: { increment: 1 }, totalSpentCents: { increment: ctx.parsed.amountCents } } : {}),
            ...(ctx.parsed.customerName ? { name: ctx.parsed.customerName } : {}),
          },
          create: {
            merchantId: ctx.merchantId, email: ctx.parsed.customerEmail, name: ctx.parsed.customerName,
            firstSeenAt: new Date(), lastSeenAt: new Date(),
            totalTransactions: succeeded ? 1 : 0, totalSpentCents: succeeded ? ctx.parsed.amountCents : 0,
          },
        });
        await prisma.transaction.update({ where: { id: transactionId }, data: { customerId: customer.id } }).catch(() => {});
      } catch (e) { console.error("[CHARGE] Customer upsert failed (non-fatal):", e); }
    }
  } catch (e) { console.error("[CHARGE] Transaction row creation failed:", e); }

  return {
    ok: succeeded, status, transactionId, payrocPaymentId, approvalCode,
    declineReason: succeeded ? null : responseMessage ?? "Payment declined",
    responseCode, errorMessage: null,
    sourceLast4: payrocLast4 ?? last4, sourceBrand: payrocBrand ?? brand, sourceSavedPaymentMethodId: savedPaymentMethodId,
  };
}
