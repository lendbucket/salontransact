import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { checkIdempotency, storeIdempotency } from "@/lib/api/v1/idempotency";
import { writeAuditLog } from "@/lib/audit/log";
import { fireWebhookEvent } from "@/lib/webhooks/fanout";
import { formatTransactionAsCharge } from "@/lib/api/v1/charges/format";
import { getPayrocToken } from "@/lib/payroc/client";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RefundBody {
  amount_cents?: unknown;
  reason?: unknown;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id: rawId } = await params;
  const txnId = rawId.startsWith("ch_") ? rawId.slice(3) : rawId;

  let bodyText: string;
  try { bodyText = await request.text(); } catch {
    return apiError("validation_error", "Could not read request body", { requestId: auth.requestId });
  }

  const idem = await checkIdempotency(request, auth.apiKey.id, bodyText, auth.requestId);
  if (idem.cached === true || idem.cached === "conflict") return idem.response;

  let body: RefundBody = {};
  try { body = bodyText.length > 0 ? JSON.parse(bodyText) : {}; } catch {
    return apiError("validation_error", "Invalid JSON", { requestId: auth.requestId });
  }

  const txn = await prisma.transaction.findUnique({ where: { id: txnId } });
  if (!txn || txn.merchantId !== auth.merchant.id) {
    return apiError("not_found", "Charge not found", { requestId: auth.requestId });
  }
  if (txn.status !== "succeeded") {
    return apiError("validation_error", `Cannot refund charge with status '${txn.status}'`, { requestId: auth.requestId });
  }

  const totalCents = Math.round(txn.amount * 100);
  const alreadyRefundedCents = Math.round(txn.refundAmount * 100);
  const maxRefundable = totalCents - alreadyRefundedCents;

  let refundCents = maxRefundable; // default: full remaining
  if (body.amount_cents !== undefined) {
    if (typeof body.amount_cents !== "number" || !Number.isInteger(body.amount_cents) || body.amount_cents < 1) {
      return apiError("validation_error", "amount_cents must be a positive integer", { requestId: auth.requestId });
    }
    if (body.amount_cents > maxRefundable) {
      return apiError("validation_error", `amount_cents (${body.amount_cents}) exceeds refundable amount (${maxRefundable})`, { requestId: auth.requestId, details: { max_refundable_cents: maxRefundable } });
    }
    refundCents = body.amount_cents;
  }

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : null;

  // Call Payroc refund
  const meta = (txn.metadata ?? {}) as Record<string, unknown>;
  const payrocPaymentId = meta.payrocPaymentId as string | undefined;

  let refundSuccess = false;
  let payrocRefundId: string | null = null;
  let refundError: string | null = null;

  if (payrocPaymentId) {
    try {
      const apiUrl = process.env.PAYROC_API_URL;
      const bearerToken = await getPayrocToken();
      const idempotencyKey = crypto.randomUUID();
      console.log(`[PAYROC-IDEMPOTENCY] key=${idempotencyKey} path=/payments/${payrocPaymentId}/refunds method=POST amount=${refundCents} requestId=${auth.requestId}`);

      const res = await fetch(`${apiUrl}/payments/${payrocPaymentId}/refunds`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${bearerToken}`,
          "Idempotency-Key": idempotencyKey,
          Accept: "application/json",
        },
        body: JSON.stringify({ amount: refundCents }),
      });

      const resData = await res.json().catch(() => ({}));
      if (res.ok || res.status === 201) {
        refundSuccess = true;
        payrocRefundId = (resData as { refundId?: string }).refundId ?? null;
      } else {
        refundError = `Payroc ${res.status}: ${JSON.stringify(resData).slice(0, 200)}`;
      }
    } catch (e) {
      refundError = e instanceof Error ? e.message : "Refund request failed";
    }
  } else {
    // No payrocPaymentId — update locally only (test transactions, legacy)
    refundSuccess = true;
  }

  if (!refundSuccess) {
    const errorBody = { error: { code: "payment_failed" as const, message: refundError ?? "Refund failed" } };
    const response = NextResponse.json(errorBody, { status: 502 });
    response.headers.set("X-Request-ID", auth.requestId);
    return response;
  }

  // Update transaction
  const newRefundAmount = (txn.refundAmount * 100 + refundCents) / 100;
  const isFullRefund = Math.round(newRefundAmount * 100) >= totalCents;

  await prisma.transaction.update({
    where: { id: txnId },
    data: {
      refunded: true,
      refundAmount: newRefundAmount,
      status: isFullRefund ? "refunded" : "succeeded",
    },
  });

  const updated = await prisma.transaction.findUnique({ where: { id: txnId } });
  const responseBody = updated ? formatTransactionAsCharge(updated) : null;

  const responseStatus = 200;
  const jsonBody = {
    refund: {
      amount_cents: refundCents,
      reason,
      payroc_refund_id: payrocRefundId,
      full_refund: isFullRefund,
    },
    charge: responseBody,
  };

  const response = NextResponse.json(jsonBody, { status: responseStatus });
  response.headers.set("X-Request-ID", auth.requestId);

  await storeIdempotency(auth.apiKey.id, request, bodyText, responseStatus, jsonBody);

  await writeAuditLog({
    actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
    action: "charge.refund.v1",
    targetType: "Charge",
    targetId: txnId,
    merchantId: auth.merchant.id,
    metadata: { refundCents, reason, payrocRefundId, fullRefund: isFullRefund, requestId: auth.requestId },
  }).catch(() => {});

  void fireWebhookEvent({
    merchantId: auth.merchant.id,
    eventType: "charge.refunded",
    data: { refund: { amount_cents: refundCents, reason, full_refund: isFullRefund }, charge: responseBody as unknown as Record<string, unknown> },
  });

  return response;
}
