import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  bookingId?: unknown;
  amountCents?: unknown;
  expiresInMinutes?: unknown;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "merchant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.bookingId !== "string" || body.bookingId.length === 0) {
    return NextResponse.json(
      { error: "bookingId required" },
      { status: 400 }
    );
  }

  if (typeof body.amountCents !== "number" || body.amountCents <= 0) {
    return NextResponse.json(
      { error: "amountCents required (positive integer)" },
      { status: 400 }
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: body.bookingId },
    select: {
      id: true,
      merchantId: true,
      savedPaymentMethodId: true,
      authHoldId: true,
    },
  });
  if (!booking || booking.merchantId !== merchant.id) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  if (!booking.savedPaymentMethodId) {
    return NextResponse.json(
      { error: "Booking has no saved payment method on file" },
      { status: 409 }
    );
  }

  if (booking.authHoldId) {
    return NextResponse.json(
      { error: "Booking already has an active auth hold" },
      { status: 409 }
    );
  }

  const expiresInMinutes =
    typeof body.expiresInMinutes === "number" && body.expiresInMinutes > 0
      ? body.expiresInMinutes
      : 1440; // default 24 hours

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

  // Generate a hold ID (in production this would come from the payment processor)
  const authHoldId = `hold_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      authHoldId,
      authHoldAmountCents: body.amountCents,
      authHoldExpiresAt: expiresAt,
    },
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "auth_hold.create",
    targetType: "Booking",
    targetId: booking.id,
    merchantId: merchant.id,
    metadata: {
      authHoldId,
      amountCents: body.amountCents,
      expiresAt: expiresAt.toISOString(),
      savedPaymentMethodId: booking.savedPaymentMethodId,
    },
  });

  return NextResponse.json(
    {
      bookingId: updated.id,
      authHoldId: updated.authHoldId,
      authHoldAmountCents: updated.authHoldAmountCents,
      authHoldExpiresAt: updated.authHoldExpiresAt
        ? updated.authHoldExpiresAt.toISOString()
        : null,
    },
    { status: 201 }
  );
}
