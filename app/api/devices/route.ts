import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { DevicePublic, DeviceListResponse } from "@/lib/devices/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  serialNumber?: unknown;
  model?: unknown;
  label?: unknown;
  merchantId?: unknown;
}

function rowToPublic(row: {
  id: string;
  serialNumber: string;
  model: string | null;
  label: string | null;
  status: string;
  pairedAt: Date;
  lastSeenAt: Date | null;
  lastChargeAt: Date | null;
}): DevicePublic {
  return {
    id: row.id,
    serialNumber: row.serialNumber,
    model: row.model,
    label: row.label,
    status: row.status,
    pairedAt: row.pairedAt.toISOString(),
    lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
    lastChargeAt: row.lastChargeAt ? row.lastChargeAt.toISOString() : null,
  };
}

async function resolveMerchantId(
  user: { id: string; role?: string },
  bodyMerchantId: unknown
): Promise<{ merchantId: string } | { error: string; status: number }> {
  if (user.role === "master portal") {
    if (typeof bodyMerchantId !== "string" || bodyMerchantId.length === 0) {
      return { error: "master portal must provide merchantId", status: 400 };
    }
    const exists = await prisma.merchant.findUnique({
      where: { id: bodyMerchantId },
      select: { id: true },
    });
    if (!exists) return { error: "merchant not found", status: 404 };
    return { merchantId: bodyMerchantId };
  }
  if (user.role === "merchant") {
    const merchant = await prisma.merchant.findUnique({
      where: { userId: user.id },
      select: { id: true },
    });
    if (!merchant)
      return { error: "merchant profile not found", status: 404 };
    return { merchantId: merchant.id };
  }
  return { error: "Forbidden", status: 403 };
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal" && user.role !== "merchant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (
    typeof body.serialNumber !== "string" ||
    body.serialNumber.length < 1 ||
    body.serialNumber.length > 64
  ) {
    return NextResponse.json(
      { error: "serialNumber required (1-64 chars)" },
      { status: 400 }
    );
  }
  const serialNumber = body.serialNumber.trim();
  if (serialNumber.length === 0) {
    return NextResponse.json(
      { error: "serialNumber cannot be blank" },
      { status: 400 }
    );
  }

  let model: string | undefined;
  if (body.model !== undefined) {
    if (typeof body.model !== "string" || body.model.length > 64) {
      return NextResponse.json(
        { error: "model must be a string <= 64 chars" },
        { status: 400 }
      );
    }
    model = body.model.trim();
  }

  let label: string | undefined;
  if (body.label !== undefined) {
    if (typeof body.label !== "string" || body.label.length > 50) {
      return NextResponse.json(
        { error: "label must be a string <= 50 chars" },
        { status: 400 }
      );
    }
    label = body.label.trim();
  }

  const resolved = await resolveMerchantId(
    { id: user.id, role: user.role },
    body.merchantId
  );
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  const existing = await prisma.device.findUnique({
    where: { serialNumber },
    select: { id: true, merchantId: true, status: true },
  });
  if (existing) {
    if (existing.merchantId === resolved.merchantId) {
      return NextResponse.json(
        {
          error:
            existing.status === "retired"
              ? "This device is retired. Reactivate it via PATCH instead of pairing again."
              : "This device is already paired to your account.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "This device is paired to another merchant." },
      { status: 409 }
    );
  }

  let row;
  try {
    row = await prisma.device.create({
      data: {
        merchantId: resolved.merchantId,
        serialNumber,
        model: model ?? null,
        label: label ?? null,
        status: "active",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to pair device: ${message}`.slice(0, 500) },
      { status: 500 }
    );
  }

  return NextResponse.json(rowToPublic(row), { status: 201 });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal" && user.role !== "merchant") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const merchantIdParam = url.searchParams.get("merchantId");
  const resolved = await resolveMerchantId(
    { id: user.id, role: user.role },
    merchantIdParam
  );
  if ("error" in resolved) {
    return NextResponse.json(
      { error: resolved.error },
      { status: resolved.status }
    );
  }

  const includeRetired = url.searchParams.get("includeRetired") === "true";
  const where: { merchantId: string; status?: { not: string } } = {
    merchantId: resolved.merchantId,
  };
  if (!includeRetired) {
    where.status = { not: "retired" };
  }

  const rows = await prisma.device.findMany({
    where,
    orderBy: [{ status: "asc" }, { pairedAt: "desc" }],
    take: 100,
  });

  const data = rows.map(rowToPublic);
  const response: DeviceListResponse = { data, count: data.length };
  return NextResponse.json(response);
}
