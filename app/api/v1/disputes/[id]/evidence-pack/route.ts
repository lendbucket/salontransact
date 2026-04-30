import { NextResponse } from "next/server";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { buildEvidencePack } from "@/lib/disputes/evidence-pack";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id: disputeId } = await params;

  let bodyText: string;
  try { bodyText = await request.text(); } catch { bodyText = "{}"; }

  let transactionId: string | null = null;
  if (bodyText.length > 0) {
    try {
      const body = JSON.parse(bodyText) as { transaction_id?: unknown };
      if (typeof body.transaction_id === "string") {
        transactionId = body.transaction_id.startsWith("ch_") ? body.transaction_id.slice(3) : body.transaction_id;
      }
    } catch {
      return apiError("validation_error", "Invalid JSON", { requestId: auth.requestId });
    }
  }

  if (!transactionId) {
    return apiError("validation_error", "transaction_id is required in request body", { requestId: auth.requestId });
  }

  const pack = await buildEvidencePack({ merchantId: auth.merchant.id, disputeId, transactionId });
  if (!pack) {
    return apiError("not_found", "Transaction not found or not owned by this merchant", { requestId: auth.requestId });
  }

  const response = NextResponse.json({ object: "evidence_pack", ...pack });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
