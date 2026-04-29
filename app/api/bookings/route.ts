import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import type {
  BookingSummary,
  BookingListResponse,
  BookingStatus,
  BookingExternalSource,
} from "@/lib/bookings/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  scheduledFor?: unknown;
  durationMinutes?: unknown;
  serviceCode?: unknown;
  serviceName?: unknown;
  expectedAmountCents?: unknown;
  stylistId?: unknown;
  customerId?: unknown;
  savedPaymentMethodId?: unknown;
  notes?: unknown;
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
  const stylistId = url.searchParams.get("stylistId");
  const fromDate = url.searchParams.get("fromDate");
  const toDate = url.searchParams.get("toDate");

  const whereClause: Record<string, unknown> = { merchantId: merchant.id };

  if (status) {
    whereClause.status = status;
  }
  if (stylistId) {
    whereClause.stylistId = stylistId;
  }
  if (fromDate || toDate) {
    const scheduledFilter: Record<string, unknown> = {};
    if (fromDate) {
      scheduledFilter.gte = new Date(fromDate);
    }
    if (toDate) {
      scheduledFilter.lte = new Date(toDate);
    }
    whereClause.scheduledFor = scheduledFilter;
  }

  const rows = await prisma.booking.findMany({
    where: whereClause,
    orderBy: { scheduledFor: "desc" },
    take: 200,
    include: {
      stylist: { select: { name: true } },
      customer: { select: { email: true, name: true } },
      savedPaymentMethod: { select: { id: true } },
    },
  });

  const data: BookingSummary[] = rows.map((r) => ({
    id: r.id,
    merchantId: r.merchantId,
    stylistId: r.stylistId,
    stylistName: r.stylist?.name,
    customerId: r.customerId,
    customerName: r.customer?.name ?? undefined,
    customerEmail: r.customer?.email ?? undefined,
    scheduledFor: r.scheduledFor.toISOString(),
    durationMinutes: r.durationMinutes,
    serviceCode: r.serviceCode,
    serviceName: r.serviceName,
    expectedAmountCents: r.expectedAmountCents,
    status: r.status as BookingStatus,
    hasCardOnFile: !!r.savedPaymentMethod,
    hasAuthHold: !!r.authHoldId,
    externalSource: r.externalSource as BookingExternalSource | null,
    externalBookingId: r.externalBookingId,
    createdAt: r.createdAt.toISOString(),
  }));

  const response: BookingListResponse = { data, count: data.length };
  return NextResponse.json(response);
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

  // Validate scheduledFor (required)
  if (typeof body.scheduledFor !== "string" || body.scheduledFor.length === 0) {
    return NextResponse.json(
      { error: "scheduledFor is required (ISO datetime)" },
      { status: 400 }
    );
  }
  const scheduledFor = new Date(body.scheduledFor);
  if (isNaN(scheduledFor.getTime())) {
    return NextResponse.json(
      { error: "scheduledFor must be a valid ISO datetime" },
      { status: 400 }
    );
  }

  const durationMinutes =
    typeof body.durationMinutes === "number" && body.durationMinutes > 0
      ? body.durationMinutes
      : 60;

  const serviceCode =
    typeof body.serviceCode === "string" && body.serviceCode.trim().length > 0
      ? body.serviceCode.trim()
      : null;

  const serviceName =
    typeof body.serviceName === "string" && body.serviceName.trim().length > 0
      ? body.serviceName.trim()
      : null;

  const expectedAmountCents =
    typeof body.expectedAmountCents === "number" ? body.expectedAmountCents : 0;

  const notes =
    typeof body.notes === "string" && body.notes.trim().length > 0
      ? body.notes.trim()
      : null;

  // Validate stylistId belongs to merchant
  let stylistId: string | null = null;
  if (typeof body.stylistId === "string" && body.stylistId.length > 0) {
    const stylist = await prisma.stylist.findUnique({
      where: { id: body.stylistId },
      select: { id: true, merchantId: true },
    });
    if (!stylist || stylist.merchantId !== merchant.id) {
      return NextResponse.json(
        { error: "Stylist not found or does not belong to this merchant" },
        { status: 400 }
      );
    }
    stylistId = stylist.id;
  }

  // Validate customerId belongs to merchant
  let customerId: string | null = null;
  if (typeof body.customerId === "string" && body.customerId.length > 0) {
    const customer = await prisma.customer.findUnique({
      where: { id: body.customerId },
      select: { id: true, merchantId: true },
    });
    if (!customer || customer.merchantId !== merchant.id) {
      return NextResponse.json(
        { error: "Customer not found or does not belong to this merchant" },
        { status: 400 }
      );
    }
    customerId = customer.id;
  }

  // Validate savedPaymentMethodId belongs to merchant
  let savedPaymentMethodId: string | null = null;
  if (
    typeof body.savedPaymentMethodId === "string" &&
    body.savedPaymentMethodId.length > 0
  ) {
    const spm = await prisma.savedPaymentMethod.findUnique({
      where: { id: body.savedPaymentMethodId },
      select: { id: true, merchantId: true },
    });
    if (!spm || spm.merchantId !== merchant.id) {
      return NextResponse.json(
        {
          error:
            "SavedPaymentMethod not found or does not belong to this merchant",
        },
        { status: 400 }
      );
    }
    savedPaymentMethodId = spm.id;
  }

  const created = await prisma.booking.create({
    data: {
      merchantId: merchant.id,
      stylistId,
      customerId,
      savedPaymentMethodId,
      scheduledFor,
      durationMinutes,
      serviceCode,
      serviceName,
      expectedAmountCents,
      status: "booked",
      externalSource: "manual",
      notes,
    },
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "booking.create",
    targetType: "Booking",
    targetId: created.id,
    merchantId: merchant.id,
    metadata: {
      scheduledFor: body.scheduledFor,
      stylistId,
      customerId,
      externalSource: "manual",
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      merchantId: created.merchantId,
      stylistId: created.stylistId,
      customerId: created.customerId,
      scheduledFor: created.scheduledFor.toISOString(),
      durationMinutes: created.durationMinutes,
      serviceCode: created.serviceCode,
      serviceName: created.serviceName,
      expectedAmountCents: created.expectedAmountCents,
      status: created.status,
      externalSource: created.externalSource,
      notes: created.notes,
      createdAt: created.createdAt.toISOString(),
    },
    { status: 201 }
  );
}
