import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getRefund,
  adjustRefund,
  reverseRefund,
  type AdjustRefundRequest,
  type RefundAdjustment,
} from "@/lib/payroc/refunds";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RefundActionBody {
  action?: unknown;
  amount?: unknown;
  adjustments?: unknown;
  operator?: unknown;
}

export async function GET(
  _request: Request,
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
    const refund = await getRefund(id);
    return NextResponse.json(refund);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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
    const body = (await request.json()) as RefundActionBody;
    const action = typeof body.action === "string" ? body.action : "";
    const operator =
      typeof body.operator === "string"
        ? body.operator.slice(0, 50)
        : user.email?.slice(0, 50) ?? undefined;

    if (action === "adjust") {
      let adjustments: RefundAdjustment[];
      if (Array.isArray(body.adjustments)) {
        adjustments = body.adjustments as RefundAdjustment[];
      } else {
        return NextResponse.json(
          {
            error:
              'For action="adjust", provide { adjustments: RefundAdjustment[] }',
          },
          { status: 400 }
        );
      }
      const req: AdjustRefundRequest = { adjustments, operator };
      const result = await adjustRefund(id, req);
      return NextResponse.json(result);
    }

    if (action === "reverse") {
      const amount =
        typeof body.amount === "number" && body.amount > 0
          ? body.amount
          : undefined;
      const result = await reverseRefund(id, { amount, operator });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Invalid action. Use "adjust" or "reverse"' },
      { status: 400 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
