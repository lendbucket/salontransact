import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiKey } from "@/lib/api/v1/auth";
import { apiError } from "@/lib/api/v1/errors";
import { writeAuditLog } from "@/lib/audit/log";
import { savedPaymentMethodToCard } from "@/lib/api/v1/cards/format";
import { deleteSecureToken } from "@/lib/payroc/tokens";

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

  // Delete the secureToken from Payroc FIRST. If Payroc fails (other than
  // 404 "already deleted"), do NOT mark the row revoked locally — keep
  // local state and Payroc state consistent.
  let payrocDeleted = false;
  let payrocError: string | null = null;

  const tokenId = row.payrocSecureTokenId;
  if (tokenId) {
    try {
      await deleteSecureToken(tokenId);
      payrocDeleted = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Treat 404 as "already deleted" — proceed with local revoke.
      // Anything else: fail the request to keep state consistent.
      if (/\b404\b/.test(msg) || /not.?found/i.test(msg)) {
        payrocDeleted = true; // effectively gone
        payrocError = `Payroc returned not-found (treating as already deleted): ${msg}`;
        console.warn(`[card.delete] ${cardId}: ${payrocError}`);
      } else {
        payrocError = msg;
        console.error(`[card.delete] ${cardId}: Payroc deletion failed:`, e);
        await writeAuditLog({
          actor: { id: `apikey:${auth.apiKey.id}`, email: auth.merchant.email, role: "api" },
          action: "card.revoke.v1.payroc_failed",
          targetType: "SavedPaymentMethod",
          targetId: cardId,
          merchantId: auth.merchant.id,
          metadata: {
            last4: row.last4,
            customerEmail: row.customerEmail,
            requestId: auth.requestId,
            payrocError: msg,
            payrocTokenId: tokenId,
          },
        }).catch(() => {});
        return apiError(
          "internal_error",
          "Failed to delete card from payment processor. The card has NOT been revoked. Please retry.",
          { requestId: auth.requestId, status: 502 }
        );
      }
    }
  } else {
    // No Payroc token on the row — local-only card (rare, mostly legacy).
    // Proceed with revoke; Payroc has nothing to delete.
    payrocDeleted = true;
    payrocError = "No Payroc secureTokenId on row — local-only revoke";
    console.warn(`[card.delete] ${cardId}: ${payrocError}`);
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
    metadata: {
      last4: row.last4,
      customerEmail: row.customerEmail,
      requestId: auth.requestId,
      payrocDeleted,
      payrocTokenId: tokenId ?? null,
      payrocNote: payrocError,
    },
  }).catch(() => {});

  const response = NextResponse.json({ id: `card_${cardId}`, deleted: true });
  response.headers.set("X-Request-ID", auth.requestId);
  return response;
}
