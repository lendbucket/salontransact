import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { BookingExternalSource } from "@/lib/bookings/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WebhookBookingPayload {
  externalBookingId?: unknown;
  externalSource?: unknown;
  scheduledFor?: unknown;
  durationMinutes?: unknown;
  serviceCode?: unknown;
  serviceName?: unknown;
  expectedAmountCents?: unknown;
  status?: unknown;
  stylistExternalRef?: unknown;
  customerEmail?: unknown;
  customerName?: unknown;
  customerPhone?: unknown;
  notes?: unknown;
}

const VALID_SOURCES: BookingExternalSource[] = [
  "vagaro",
  "booksy",
  "square_appointments",
  "kasse",
  "manual",
];

const VALID_STATUSES = ["booked", "arrived", "completed", "cancelled", "no_show"];

export async function POST(request: Request) {
  // Authenticate via API key header
  const apiKeyHeader = request.headers.get("x-api-key");
  if (!apiKeyHeader) {
    return NextResponse.json({ error: "Missing x-api-key header" }, { status: 401 });
  }

  const apiKeyRecord = await prisma.apiKey.findFirst({
    where: { key: apiKeyHeader, active: true },
  });
  if (!apiKeyRecord) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  // Update lastUsed
  await prisma.apiKey.update({
    where: { id: apiKeyRecord.id },
    data: { lastUsed: new Date() },
  });

  const merchantId = apiKeyRecord.merchantId;

  let body: WebhookBookingPayload;
  try {
    body = (await request.json()) as WebhookBookingPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate required fields
  if (
    typeof body.externalBookingId !== "string" ||
    body.externalBookingId.length === 0
  ) {
    return NextResponse.json(
      { error: "externalBookingId required" },
      { status: 400 }
    );
  }

  if (
    typeof body.externalSource !== "string" ||
    !VALID_SOURCES.includes(body.externalSource as BookingExternalSource)
  ) {
    return NextResponse.json(
      { error: `externalSource must be one of: ${VALID_SOURCES.join(", ")}` },
      { status: 400 }
    );
  }

  if (
    typeof body.scheduledFor !== "string" ||
    isNaN(new Date(body.scheduledFor).getTime())
  ) {
    return NextResponse.json(
      { error: "scheduledFor required (ISO datetime)" },
      { status: 400 }
    );
  }

  const status =
    typeof body.status === "string" && VALID_STATUSES.includes(body.status)
      ? body.status
      : "booked";

  const durationMinutes =
    typeof body.durationMinutes === "number" && body.durationMinutes > 0
      ? body.durationMinutes
      : 60;

  const expectedAmountCents =
    typeof body.expectedAmountCents === "number"
      ? body.expectedAmountCents
      : 0;

  const serviceCode =
    typeof body.serviceCode === "string" && body.serviceCode.length > 0
      ? body.serviceCode
      : null;

  const serviceName =
    typeof body.serviceName === "string" && body.serviceName.length > 0
      ? body.serviceName
      : null;

  const notes =
    typeof body.notes === "string" && body.notes.length > 0
      ? body.notes
      : null;

  // Resolve stylist by externalRef
  let stylistId: string | null = null;
  if (
    typeof body.stylistExternalRef === "string" &&
    body.stylistExternalRef.length > 0
  ) {
    const stylist = await prisma.stylist.findUnique({
      where: {
        merchantId_externalRef: {
          merchantId,
          externalRef: body.stylistExternalRef,
        },
      },
      select: { id: true },
    });
    if (stylist) {
      stylistId = stylist.id;
    }
  }

  // Resolve or create customer by email
  let customerId: string | null = null;
  if (
    typeof body.customerEmail === "string" &&
    body.customerEmail.length > 0
  ) {
    const customerEmail = body.customerEmail.trim().toLowerCase();
    const customer = await prisma.customer.upsert({
      where: {
        merchantId_email: {
          merchantId,
          email: customerEmail,
        },
      },
      update: { lastSeenAt: new Date() },
      create: {
        merchantId,
        email: customerEmail,
        name:
          typeof body.customerName === "string"
            ? body.customerName.trim()
            : null,
        phone:
          typeof body.customerPhone === "string"
            ? body.customerPhone.trim()
            : null,
      },
      select: { id: true },
    });
    customerId = customer.id;
  }

  // Upsert booking
  const booking = await prisma.booking.upsert({
    where: {
      merchantId_externalSource_externalBookingId: {
        merchantId,
        externalSource: body.externalSource as string,
        externalBookingId: body.externalBookingId as string,
      },
    },
    update: {
      scheduledFor: new Date(body.scheduledFor as string),
      durationMinutes,
      serviceCode,
      serviceName,
      expectedAmountCents,
      status,
      stylistId,
      customerId,
      notes,
    },
    create: {
      merchantId,
      externalSource: body.externalSource as string,
      externalBookingId: body.externalBookingId as string,
      scheduledFor: new Date(body.scheduledFor as string),
      durationMinutes,
      serviceCode,
      serviceName,
      expectedAmountCents,
      status,
      stylistId,
      customerId,
      notes,
    },
  });

  return NextResponse.json(
    {
      id: booking.id,
      merchantId: booking.merchantId,
      externalBookingId: booking.externalBookingId,
      externalSource: booking.externalSource,
      status: booking.status,
      scheduledFor: booking.scheduledFor.toISOString(),
    },
    { status: 200 }
  );
}
