import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { savedPaymentMethodToCard } from "@/lib/api/v1/cards/format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id: rawId } = await params;
  const cardId = rawId.startsWith("card_") ? rawId.slice(5) : rawId;

  const row = await prisma.savedPaymentMethod.findUnique({ where: { id: cardId } });
  if (!row || row.merchantId !== auth.merchant.id) {
    return apiError("not_found", "Card not found", { requestId: auth.requestId });
  }

  const body = savedPaymentMethodToCard(row);
  const response = NextResponse.json(body);
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiKey(request);
  if (auth instanceof NextResponse) return auth;

  const { id: rawId } = await params;
  const cardId = rawId.startsWith("card_") ? rawId.slice(5) : rawId;

  const row = await prisma.savedPaymentMethod.findUnique({ where: { id: cardId } });
  if (!row || row.merchantId !== auth.merchant.id) {
    return apiError("not_found", "Card not found", { requestId: auth.requestId });
  }
  if (row.status !== "active") {
    return apiError("validation_error", `Card is already ${row.status}`, { requestId: auth.requestId });
  }

  await prisma.savedPaymentMethod.update({
    where: { id: cardId },
    data: { status: "revoked" },
  });

  await writeAuditLog({
    actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
    action: "card.revoke.v1",
    targetType: "SavedPaymentMethod",
    targetId: cardId,
    merchantId: auth.merchant.id,
    metadata: { last4: row.last4, customerEmail: row.customerEmail, requestId: auth.requestId },
  }).catch(() => {});

  const response = NextResponse.json({ id: `card_${cardId}`, deleted: true });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
