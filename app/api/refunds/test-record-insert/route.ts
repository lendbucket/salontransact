import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { recordPaymentForRefunds } from "@/lib/refunds/payment-record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TestBody {
  payrocPaymentId?: unknown;
  merchantId?: unknown;
  amountCents?: unknown;
  currency?: unknown;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: TestBody;
  try {
    body = (await req.json()) as TestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const payrocPaymentId =
    typeof body.payrocPaymentId === "string" ? body.payrocPaymentId : "";
  const merchantId =
    typeof body.merchantId === "string" ? body.merchantId : "";
  const amountCents =
    typeof body.amountCents === "number" && Number.isInteger(body.amountCents)
      ? body.amountCents
      : NaN;
  const currency =
    typeof body.currency === "string" && body.currency.length > 0
      ? body.currency
      : undefined;

  if (!payrocPaymentId || !merchantId || !Number.isFinite(amountCents)) {
    return NextResponse.json(
      {
        error:
          "Required: payrocPaymentId (string), merchantId (string), amountCents (integer)",
      },
      { status: 400 }
    );
  }

  const result = await recordPaymentForRefunds({
    payrocPaymentId,
    merchantId,
    amountCents,
    currency,
    source: "manual",
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
