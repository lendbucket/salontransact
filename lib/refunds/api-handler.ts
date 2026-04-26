import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { payrocRefundRequest } from "@/lib/refunds/payroc-helper";
import { canInitiateRefundForPayment } from "@/lib/refunds/permissions";
import type {
  OperationKind,
  PayrocPayment,
  RefundRequestBody,
  ReverseRequestBody,
} from "@/lib/refunds/types";
import crypto from "crypto";

export interface HandlerInput {
  operation: OperationKind;
  paymentId: string;
  amountCents: number;
  description?: string;
  isFullReverse?: boolean;
}

export interface HandlerSuccess {
  ok: true;
  refundOperationId: string;
  payrocStatusCode: number;
  payrocResponse: PayrocPayment | null;
}

export interface HandlerFailure {
  ok: false;
  status: number;
  error: string;
  refundOperationId?: string;
}

export type HandlerResult = HandlerSuccess | HandlerFailure;

export async function handleRefundOperation(
  input: HandlerInput
): Promise<HandlerResult> {
  // 1. Authentication
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return { ok: false, status: 401, error: "Not authenticated" };
  }

  // 2. Validation (runs before permission check because check needs paymentId)
  const { operation, paymentId, amountCents, description, isFullReverse } =
    input;

  if (!paymentId || typeof paymentId !== "string") {
    return { ok: false, status: 400, error: "paymentId is required" };
  }
  if (paymentId.length < 6 || paymentId.length > 20) {
    return { ok: false, status: 400, error: "paymentId is invalid" };
  }
  if (operation !== "refund" && operation !== "reverse") {
    return {
      ok: false,
      status: 400,
      error: "operation must be refund or reverse",
    };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return {
      ok: false,
      status: 400,
      error: "amountCents must be a positive integer",
    };
  }
  if (operation === "refund") {
    if (!description || typeof description !== "string") {
      return {
        ok: false,
        status: 400,
        error: "description is required for refunds",
      };
    }
    if (description.length < 1 || description.length > 100) {
      return {
        ok: false,
        status: 400,
        error: "description must be 1-100 characters",
      };
    }
  }

  // 3. Authorization — checks ownership (merchant) or full access (master portal)
  const permission = await canInitiateRefundForPayment(user, paymentId);
  if (!permission.allowed) {
    const friendly =
      permission.reason === "payment-belongs-to-other-merchant"
        ? "You can only refund your own transactions."
        : permission.reason === "no-transaction-for-payment"
          ? "No matching transaction found in your account. If this is a recent payment, please try again in a moment."
          : "You are not authorized to refund this payment.";
    return { ok: false, status: 403, error: friendly };
  }

  // 4. Idempotency key
  const idempotencyKey = crypto.randomUUID();

  // 5. Build request body and pre-insert audit row
  let payrocRequestBody: Record<string, unknown> = {};
  let payrocPath = "";

  if (operation === "refund") {
    const body: RefundRequestBody = {
      amount: amountCents,
      description: description as string,
    };
    if (user.email) body.operator = user.email.slice(0, 50);
    payrocRequestBody = body as unknown as Record<string, unknown>;
    payrocPath = `/payments/${encodeURIComponent(paymentId)}/refund`;
  } else {
    const body: ReverseRequestBody = {};
    if (!isFullReverse) {
      body.amount = amountCents;
    }
    if (user.email) body.operator = user.email.slice(0, 50);
    payrocRequestBody = body as unknown as Record<string, unknown>;
    payrocPath = `/payments/${encodeURIComponent(paymentId)}/reverse`;
  }

  let auditRow;
  try {
    auditRow = await prisma.refundOperation.create({
      data: {
        operation,
        payrocPaymentId: paymentId,
        idempotencyKey,
        amountCents,
        description: description ?? null,
        operatorUserId: user.id,
        operatorEmail: user.email ?? "",
        merchantId: permission.merchantId ?? null,
        status: "pending",
        payrocRequestBody: payrocRequestBody as object,
      },
    });
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: `Failed to record operation: ${(e as Error).message}`,
    };
  }

  // 6. Call Payroc
  let result;
  try {
    result = await payrocRefundRequest<PayrocPayment>(
      "POST",
      payrocPath,
      payrocRequestBody,
      idempotencyKey
    );
  } catch (e) {
    await prisma.refundOperation.update({
      where: { id: auditRow.id },
      data: {
        status: "failed",
        errorMessage: `Network error: ${(e as Error).message}`.slice(0, 500),
      },
    });
    return {
      ok: false,
      status: 500,
      error: "Network error contacting payment processor",
      refundOperationId: auditRow.id,
    };
  }

  // 7. Update audit row
  if (result.ok && result.data) {
    const payrocRefundId =
      result.data.refunds && result.data.refunds.length > 0
        ? result.data.refunds[result.data.refunds.length - 1].refundId
        : null;

    await prisma.refundOperation.update({
      where: { id: auditRow.id },
      data: {
        status: "success",
        payrocStatusCode: result.status,
        payrocResponseBody: result.data as unknown as object,
        payrocRefundId: payrocRefundId,
      },
    });
    return {
      ok: true,
      refundOperationId: auditRow.id,
      payrocStatusCode: result.status,
      payrocResponse: result.data,
    };
  } else {
    await prisma.refundOperation.update({
      where: { id: auditRow.id },
      data: {
        status: "failed",
        payrocStatusCode: result.status,
        payrocResponseBody: result.data
          ? (result.data as unknown as object)
          : undefined,
        errorMessage: (
          result.error ||
          result.rawBody ||
          "Unknown error"
        ).slice(0, 500),
      },
    });
    return {
      ok: false,
      status:
        result.status >= 400 && result.status < 600 ? result.status : 502,
      error: `Payroc rejected the request: ${result.rawBody || result.error || "unknown"}`,
      refundOperationId: auditRow.id,
    };
  }
}
