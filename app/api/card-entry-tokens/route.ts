import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  bookingId?: unknown;
  customerPhone?: unknown;
  customerName?: unknown;
  customerEmail?: unknown;
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

  if (
    typeof body.customerPhone !== "string" ||
    body.customerPhone.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "customerPhone required" },
      { status: 400 }
    );
  }
  const customerPhone = body.customerPhone.trim();

  const customerName =
    typeof body.customerName === "string" && body.customerName.trim().length > 0
      ? body.customerName.trim()
      : null;

  const customerEmail =
    typeof body.customerEmail === "string" &&
    body.customerEmail.trim().length > 0
      ? body.customerEmail.trim().toLowerCase()
      : null;

  // Validate bookingId if provided
  let bookingId: string | null = null;
  if (typeof body.bookingId === "string" && body.bookingId.length > 0) {
    const booking = await prisma.booking.findUnique({
      where: { id: body.bookingId },
      select: { id: true, merchantId: true },
    });
    if (!booking || booking.merchantId !== merchant.id) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }
    bookingId = booking.id;
  }

  const expiresInMinutes =
    typeof body.expiresInMinutes === "number" && body.expiresInMinutes > 0
      ? body.expiresInMinutes
      : 60; // default 1 hour

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
  const signedToken = crypto.randomBytes(32).toString("hex");

  const token = await prisma.cardEntryToken.create({
    data: {
      merchantId: merchant.id,
      bookingId,
      customerPhone,
      customerName,
      customerEmail,
      signedToken,
      expiresAt,
      status: "active",
    },
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "card_entry_token.create",
    targetType: "CardEntryToken",
    targetId: token.id,
    merchantId: merchant.id,
    metadata: {
      bookingId,
      customerPhone,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return NextResponse.json(
    {
      id: token.id,
      signedToken: token.signedToken,
      expiresAt: token.expiresAt.toISOString(),
      customerPhone: token.customerPhone,
      customerName: token.customerName,
      bookingId: token.bookingId,
      status: token.status,
    },
    { status: 201 }
  );
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

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

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const bookingId = url.searchParams.get("bookingId");

  const whereClause: Record<string, unknown> = { merchantId: merchant.id };
  if (status) {
    whereClause.status = status;
  }
  if (bookingId) {
    whereClause.bookingId = bookingId;
  }

  const rows = await prisma.cardEntryToken.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const data = rows.map((r) => ({
    id: r.id,
    signedToken: r.signedToken,
    bookingId: r.bookingId,
    customerPhone: r.customerPhone,
    customerName: r.customerName,
    customerEmail: r.customerEmail,
    status: r.status,
    expiresAt: r.expiresAt.toISOString(),
    usedAt: r.usedAt ? r.usedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ data, count: data.length });
}
