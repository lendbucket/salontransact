import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/card-entry-tokens/[token]/session
 *
 * Public endpoint (no auth). Validates the signed token and returns
 * the session context needed by the card entry UI: merchant info,
 * booking details, and customer name.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const row = await prisma.cardEntryToken.findUnique({
    where: { signedToken: token },
    include: {
      merchant: { select: { id: true, businessName: true } },
      booking: {
        select: {
          id: true,
          scheduledFor: true,
          serviceName: true,
          expectedAmountCents: true,
          stylist: { select: { name: true } },
        },
      },
    },
  });

  if (!row) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }

  if (row.status !== "active") {
    return NextResponse.json(
      { error: "Token has already been used or expired", status: row.status },
      { status: 410 }
    );
  }

  if (new Date() > row.expiresAt) {
    // Mark as expired
    await prisma.cardEntryToken.update({
      where: { id: row.id },
      data: { status: "expired" },
    });
    return NextResponse.json(
      { error: "Token has expired" },
      { status: 410 }
    );
  }

  return NextResponse.json({
    tokenId: row.id,
    merchantName: row.merchant.businessName,
    merchantId: row.merchant.id,
    customerPhone: row.customerPhone,
    customerName: row.customerName,
    customerEmail: row.customerEmail,
    expiresAt: row.expiresAt.toISOString(),
    booking: row.booking
      ? {
          id: row.booking.id,
          scheduledFor: row.booking.scheduledFor.toISOString(),
          serviceName: row.booking.serviceName,
          expectedAmountCents: row.booking.expectedAmountCents,
          stylistName: row.booking.stylist?.name ?? null,
        }
      : null,
  });
}
