import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  adjustPayment,
  type AdjustPaymentRequest,
  type PaymentAdjustment,
} from "@/lib/payroc/payments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AdjustBody {
  amount?: unknown;
  adjustments?: unknown;
  operator?: unknown;
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
    const body = (await request.json()) as AdjustBody;

    let adjustments: PaymentAdjustment[];
    if (Array.isArray(body.adjustments)) {
      adjustments = body.adjustments as PaymentAdjustment[];
    } else if (typeof body.amount === "number" && body.amount > 0) {
      adjustments = [{ type: "order", amount: body.amount }];
    } else {
      return NextResponse.json(
        {
          error:
            "Provide either { adjustments: PaymentAdjustment[] } or { amount: number }",
        },
        { status: 400 }
      );
    }

    const req: AdjustPaymentRequest = {
      adjustments,
      operator:
        typeof body.operator === "string"
          ? body.operator.slice(0, 50)
          : user.email?.slice(0, 50) ?? undefined,
    };

    const result = await adjustPayment(id, req);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
