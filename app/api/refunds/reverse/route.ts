import { NextResponse } from "next/server";
import { handleRefundOperation } from "@/lib/refunds/api-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ReverseBody {
  paymentId?: unknown;
  amountCents?: unknown;
  isFullReverse?: unknown;
}

export async function POST(req: Request) {
  let body: ReverseBody;
  try {
    body = (await req.json()) as ReverseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const paymentId =
    typeof body.paymentId === "string" ? body.paymentId : "";
  const amountCents =
    typeof body.amountCents === "number" ? body.amountCents : NaN;
  const isFullReverse =
    typeof body.isFullReverse === "boolean" ? body.isFullReverse : false;

  const result = await handleRefundOperation({
    operation: "reverse",
    paymentId,
    amountCents,
    isFullReverse,
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
