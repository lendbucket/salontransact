import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSecureToken } from "@/lib/payroc/tokens";
import type {
  CreateSecureTokenRequest,
  TokenizationSource,
} from "@/lib/payroc/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StoreBody {
  source?: unknown;
}

/**
 * POST /api/card-entry-tokens/[token]/store
 *
 * Public endpoint (no session auth -- authenticated by the signed token).
 * The customer's browser submits card details, which are tokenized via
 * Payroc and saved as a SavedPaymentMethod linked to the merchant.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const row = await prisma.cardEntryToken.findUnique({
    where: { signedToken: token },
    include: {
      merchant: { select: { id: true } },
      booking: { select: { id: true, customerId: true } },
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
    await prisma.cardEntryToken.update({
      where: { id: row.id },
      data: { status: "expired" },
    });
    return NextResponse.json(
      { error: "Token has expired" },
      { status: 410 }
    );
  }

  let body: StoreBody;
  try {
    body = (await request.json()) as StoreBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.source || typeof body.source !== "object") {
    return NextResponse.json(
      { error: "source is required (tokenization source object)" },
      { status: 400 }
    );
  }

  const payrocReq: CreateSecureTokenRequest = {
    source: body.source as TokenizationSource,
    mitAgreement: "unscheduled",
    operator: `card-entry:${row.id}`.slice(0, 50),
  };

  let payrocResponse;
  try {
    payrocResponse = await createSecureToken(payrocReq);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        error: `Payroc rejected secure token creation: ${message}`.slice(
          0,
          500
        ),
      },
      { status: 502 }
    );
  }

  let expiryMonth: string | null = null;
  let expiryYear: string | null = null;
  if (
    typeof payrocResponse.source.expiryDate === "string" &&
    payrocResponse.source.expiryDate.length === 4
  ) {
    expiryMonth = payrocResponse.source.expiryDate.slice(0, 2);
    expiryYear = `20${payrocResponse.source.expiryDate.slice(2, 4)}`;
  }

  let last4: string | null = null;
  if (typeof payrocResponse.source.cardNumber === "string") {
    const last4Match = payrocResponse.source.cardNumber.match(/(\d{4})$/);
    last4 = last4Match ? last4Match[1] : null;
  }

  const customerEmail = row.customerEmail ?? `phone:${row.customerPhone}`;

  const savedPaymentMethod = await prisma.savedPaymentMethod.create({
    data: {
      merchantId: row.merchant.id,
      customerEmail,
      customerId: row.booking?.customerId ?? null,
      payrocSecureTokenId: payrocResponse.secureTokenId,
      payrocToken: payrocResponse.token,
      last4,
      expiryMonth,
      expiryYear,
      cardholderName: payrocResponse.source.cardholderName ?? row.customerName,
      label: null,
      status: "active",
      mitAgreement: "unscheduled",
    },
  });

  // Mark token as used and link the resulting saved payment method
  await prisma.cardEntryToken.update({
    where: { id: row.id },
    data: {
      status: "used",
      usedAt: new Date(),
      resultingSavedPaymentMethodId: savedPaymentMethod.id,
    },
  });

  // If linked to a booking, attach the saved payment method to it
  if (row.booking) {
    await prisma.booking.update({
      where: { id: row.booking.id },
      data: { savedPaymentMethodId: savedPaymentMethod.id },
    });
  }

  return NextResponse.json(
    {
      savedPaymentMethodId: savedPaymentMethod.id,
      last4: savedPaymentMethod.last4,
      cardScheme: savedPaymentMethod.cardScheme ?? null,
      expiryMonth: savedPaymentMethod.expiryMonth,
      expiryYear: savedPaymentMethod.expiryYear,
      cardholderName: savedPaymentMethod.cardholderName,
    },
    { status: 201 }
  );
}
