import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  capturePayment,
  type CapturePaymentRequest,
} from "@/lib/payroc/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CaptureBody {
  amount?: unknown;
  operator?: unknown;
  processingTerminalId?: unknown;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    if (!id || id.length < 6 || id.length > 20) {
      return NextResponse.json(
        { error: "invalid payment id" },
        { status: 400 }
      );
    }

    let body: CaptureBody = {};
    try {
      body = (await request.json()) as CaptureBody;
    } catch {
      // Empty body is valid for full capture
      body = {};
    }

    const captureRequest: CapturePaymentRequest = {};

    if (body.amount !== undefined) {
      if (
        typeof body.amount !== "number" ||
        !Number.isInteger(body.amount) ||
        body.amount <= 0
      ) {
        return NextResponse.json(
          {
            error:
              "amount must be a positive integer in cents, or omitted for full capture",
          },
          { status: 400 }
        );
      }
      captureRequest.amount = body.amount;
    }

    if (typeof body.operator === "string" && body.operator.length > 0) {
      captureRequest.operator = body.operator.slice(0, 50);
    } else if (user.email) {
      captureRequest.operator = user.email.slice(0, 50);
    }

    if (
      typeof body.processingTerminalId === "string" &&
      body.processingTerminalId.length > 0
    ) {
      captureRequest.processingTerminalId = body.processingTerminalId;
    }

    const result = await capturePayment(id, captureRequest);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
