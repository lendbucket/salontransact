import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { transactionToCharge } from "@/lib/api/v1/charges/retrieve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id: rawId } = await params;

  // Accept both "ch_<cuid>" and bare "<cuid>"
  const txnId = rawId.startsWith("ch_") ? rawId.slice(3) : rawId;

  const txn = await prisma.transaction.findUnique({
    where: { id: txnId },
  });

  if (!txn || txn.merchantId !== auth.merchant.id) {
    return apiError("not_found", "Charge not found", {
      requestId: auth.requestId,
    });
  }

  const body = transactionToCharge(txn);

  const response = NextResponse.json(body);
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
