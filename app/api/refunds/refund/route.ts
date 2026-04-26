import { NextResponse } from "next/server";
import { handleRefundOperation } from "@/lib/refunds/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RefundBody {
  paymentId?: unknown;
  amountCents?: unknown;
  description?: unknown;
}

export async function POST(req: Request) {
  let body: RefundBody;
  try {
    body = (await req.json()) as RefundBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paymentId =
    typeof body.paymentId === "string" ? body.paymentId : "";
  const amountCents =
    typeof body.amountCents === "number" ? body.amountCents : NaN;
  const description =
    typeof body.description === "string" ? body.description : undefined;

  const result = await handleRefundOperation({
    operation: "refund",
    paymentId,
    amountCents,
    description,
  });

  if (result.ok) {
    return NextResponse.json(
      {
        refundOperationId: result.refundOperationId,
        payrocStatusCode: result.payrocStatusCode,
        payroc: result.payrocResponse,
      },
      { status: 200 }
    );
  } else {
    return NextResponse.json(
      {
        error: result.error,
        refundOperationId: result.refundOperationId ?? null,
      },
      { status: result.status }
    );
  }
}
