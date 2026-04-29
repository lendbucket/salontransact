import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import type {
  BookingDetail,
  BookingStatus,
  BookingExternalSource,
} from "@/lib/bookings/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  status?: unknown;
  notes?: unknown;
  scheduledFor?: unknown;
  expectedAmountCents?: unknown;
  savedPaymentMethodId?: unknown;
  stylistId?: unknown;
}

const VALID_STATUSES: BookingStatus[] = [
  "booked",
  "arrived",
  "completed",
  "cancelled",
  "no_show",
];

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  booked: ["arrived", "cancelled", "no_show"],
  arrived: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

async function findBookingForMerchant(
  userId: string,
  bookingId: string
): Promise<
  | { booking: { id: string; merchantId: string; status: string } }
  | { error: string; status: number }
> {
  const merchant = await prisma.merchant.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!merchant) {
    return { error: "Merchant not found", status: 404 };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, merchantId: true, status: true },
  });
  if (!booking || booking.merchantId !== merchant.id) {
    return { error: "Booking not found", status: 404 };
  }

  return { booking };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "merchant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const result = await findBookingForMerchant(user.id, id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  const row = await prisma.booking.findUnique({
    where: { id },
    include: {
      stylist: { select: { name: true } },
      customer: { select: { email: true, name: true } },
      savedPaymentMethod: { select: { id: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Booking not found" }, { status: 404 });
  }

  const detail: BookingDetail = {
    id: row.id,
    merchantId: row.merchantId,
    stylistId: row.stylistId,
    stylistName: row.stylist?.name,
    customerId: row.customerId,
    customerName: row.customer?.name ?? undefined,
    customerEmail: row.customer?.email ?? undefined,
    scheduledFor: row.scheduledFor.toISOString(),
    durationMinutes: row.durationMinutes,
    serviceCode: row.serviceCode,
    serviceName: row.serviceName,
    expectedAmountCents: row.expectedAmountCents,
    status: row.status as BookingStatus,
    hasCardOnFile: !!row.savedPaymentMethod,
    hasAuthHold: !!row.authHoldId,
    externalSource: row.externalSource as BookingExternalSource | null,
    externalBookingId: row.externalBookingId,
    createdAt: row.createdAt.toISOString(),
    authHoldId: row.authHoldId,
    authHoldAmountCents: row.authHoldAmountCents,
    authHoldExpiresAt: row.authHoldExpiresAt
      ? row.authHoldExpiresAt.toISOString()
      : null,
    savedPaymentMethodId: row.savedPaymentMethodId,
    notes: row.notes,
  };

  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const result = await findBookingForMerchant(user.id, id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  const currentStatus = result.booking.status as BookingStatus;

  // Status transition validation
  if (body.status !== undefined) {
    if (!VALID_STATUSES.includes(body.status as BookingStatus)) {
      return NextResponse.json(
        { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    const newStatus = body.status as BookingStatus;
    const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Cannot transition from '${currentStatus}' to '${newStatus}'. Allowed: ${allowed.join(", ") || "none"}`,
        },
        { status: 409 }
      );
    }
    data.status = newStatus;
  }

  if (body.notes !== undefined) {
    data.notes =
      typeof body.notes === "string" && body.notes.trim().length > 0
        ? body.notes.trim()
        : null;
  }

  if (body.scheduledFor !== undefined) {
    if (
      typeof body.scheduledFor !== "string" ||
      isNaN(new Date(body.scheduledFor).getTime())
    ) {
      return NextResponse.json(
        { error: "scheduledFor must be a valid ISO datetime" },
        { status: 400 }
      );
    }
    data.scheduledFor = new Date(body.scheduledFor);
  }

  if (body.expectedAmountCents !== undefined) {
    if (typeof body.expectedAmountCents !== "number") {
      return NextResponse.json(
        { error: "expectedAmountCents must be a number" },
        { status: 400 }
      );
    }
    data.expectedAmountCents = body.expectedAmountCents;
  }

  if (body.savedPaymentMethodId !== undefined) {
    if (body.savedPaymentMethodId === null) {
      data.savedPaymentMethodId = null;
    } else if (typeof body.savedPaymentMethodId === "string") {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      const spm = await prisma.savedPaymentMethod.findUnique({
        where: { id: body.savedPaymentMethodId },
        select: { id: true, merchantId: true },
      });
      if (!spm || spm.merchantId !== merchant!.id) {
        return NextResponse.json(
          { error: "SavedPaymentMethod not found or does not belong to this merchant" },
          { status: 400 }
        );
      }
      data.savedPaymentMethodId = spm.id;
    }
  }

  if (body.stylistId !== undefined) {
    if (body.stylistId === null) {
      data.stylistId = null;
    } else if (typeof body.stylistId === "string") {
      const merchant = await prisma.merchant.findUnique({
        where: { userId: user.id },
        select: { id: true },
      });
      const stylist = await prisma.stylist.findUnique({
        where: { id: body.stylistId },
        select: { id: true, merchantId: true },
      });
      if (!stylist || stylist.merchantId !== merchant!.id) {
        return NextResponse.json(
          { error: "Stylist not found or does not belong to this merchant" },
          { status: 400 }
        );
      }
      data.stylistId = stylist.id;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No editable fields provided" },
      { status: 400 }
    );
  }

  const updated = await prisma.booking.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "booking.update",
    targetType: "Booking",
    targetId: id,
    merchantId: result.booking.merchantId,
    metadata: { fields: Object.keys(data) },
  });

  return NextResponse.json({
    id: updated.id,
    merchantId: updated.merchantId,
    status: updated.status,
    scheduledFor: updated.scheduledFor.toISOString(),
    expectedAmountCents: updated.expectedAmountCents,
    notes: updated.notes,
    stylistId: updated.stylistId,
    savedPaymentMethodId: updated.savedPaymentMethodId,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
