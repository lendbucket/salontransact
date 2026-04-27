import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  createUnreferencedRefund,
  type CreateUnreferencedRefundRequest,
  type UnreferencedRefundMethod,
} from "@/lib/payroc/refunds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface UnreferencedRefundBody {
  channel?: unknown;
  order?: unknown;
  refundMethod?: unknown;
  operator?: unknown;
  processingTerminalId?: unknown;
}

interface OrderBody {
  orderId?: unknown;
  description?: unknown;
  amount?: unknown;
  currency?: unknown;
}

function isOrderBody(value: unknown): value is OrderBody {
  return typeof value === "object" && value !== null;
}

function isRefundMethod(value: unknown): value is UnreferencedRefundMethod {
  if (typeof value !== "object" || value === null) return false;
  const v = value as { type?: unknown };
  if (v.type === "card") {
    const card = value as {
      cardDetails?: { keyed?: { cardNumber?: unknown; expiryDate?: unknown } };
    };
    return (
      typeof card.cardDetails?.keyed?.cardNumber === "string" &&
      typeof card.cardDetails?.keyed?.expiryDate === "string"
    );
  }
  if (v.type === "secureToken") {
    const tok = value as { secureTokenId?: unknown };
    return typeof tok.secureTokenId === "string" && tok.secureTokenId.length > 0;
  }
  return false;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const user = session?.user as
      | { id?: string; email?: string | null; role?: string }
      | undefined;

    if (!user || !user.id) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (user.role !== "master portal" && user.role !== "merchant") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: UnreferencedRefundBody;
    try {
      body = (await request.json()) as UnreferencedRefundBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    // Validate channel
    if (body.channel !== "pos" && body.channel !== "moto") {
      return NextResponse.json(
        { error: 'channel must be "pos" or "moto"' },
        { status: 400 }
      );
    }

    // Validate order
    if (!isOrderBody(body.order)) {
      return NextResponse.json(
        {
          error:
            "order is required: { orderId, description?, amount, currency? }",
        },
        { status: 400 }
      );
    }
    const order = body.order;
    if (typeof order.orderId !== "string" || order.orderId.length === 0) {
      return NextResponse.json(
        { error: "order.orderId must be a non-empty string" },
        { status: 400 }
      );
    }
    if (
      typeof order.amount !== "number" ||
      !Number.isInteger(order.amount) ||
      order.amount <= 0
    ) {
      return NextResponse.json(
        { error: "order.amount must be a positive integer in cents" },
        { status: 400 }
      );
    }
    if (
      order.description !== undefined &&
      (typeof order.description !== "string" || order.description.length > 100)
    ) {
      return NextResponse.json(
        { error: "order.description must be a string 1-100 characters" },
        { status: 400 }
      );
    }
    if (order.currency !== undefined && order.currency !== "USD") {
      return NextResponse.json(
        { error: 'order.currency must be "USD" or omitted' },
        { status: 400 }
      );
    }

    // Validate refundMethod
    if (!isRefundMethod(body.refundMethod)) {
      return NextResponse.json(
        {
          error:
            'refundMethod required: either { type: "card", cardDetails: { keyed: { cardNumber, expiryDate } } } or { type: "secureToken", secureTokenId }',
        },
        { status: 400 }
      );
    }

    const operator =
      typeof body.operator === "string" && body.operator.length > 0
        ? body.operator.slice(0, 50)
        : user.email?.slice(0, 50);

    const processingTerminalId =
      typeof body.processingTerminalId === "string" &&
      body.processingTerminalId.length > 0
        ? body.processingTerminalId
        : undefined;

    const refundRequest: CreateUnreferencedRefundRequest = {
      channel: body.channel,
      order: {
        orderId: order.orderId,
        description:
          typeof order.description === "string"
            ? order.description
            : undefined,
        amount: order.amount,
        currency: "USD",
      },
      refundMethod: body.refundMethod,
      operator,
      processingTerminalId,
    };

    const result = await createUnreferencedRefund(refundRequest);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
