import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import type {
  StylistDetail,
  StylistRole,
  StylistStatus,
} from "@/lib/stylists/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PatchBody {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  role?: unknown;
  commissionRate?: unknown;
  hourlyRate?: unknown;
  payoutMethod?: unknown;
  status?: unknown;
  externalRef?: unknown;
}

const VALID_ROLES: StylistRole[] = ["stylist", "manager", "owner"];

async function findStylistForMerchant(
  userId: string,
  stylistId: string
): Promise<
  | { stylist: { id: string; merchantId: string } }
  | { error: string; status: number }
> {
  const merchant = await prisma.merchant.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!merchant) {
    return { error: "Merchant not found", status: 404 };
  }

  const stylist = await prisma.stylist.findUnique({
    where: { id: stylistId },
    select: { id: true, merchantId: true },
  });
  if (!stylist || stylist.merchantId !== merchant.id) {
    return { error: "Stylist not found", status: 404 };
  }

  return { stylist };
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
  const result = await findStylistForMerchant(user.id, id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  const row = await prisma.stylist.findUnique({
    where: { id },
    include: {
      transactions: {
        select: { amount: true, tipAmount: true },
      },
    },
  });
  if (!row) {
    return NextResponse.json({ error: "Stylist not found" }, { status: 404 });
  }

  const totalTransactions = row.transactions.length;
  const totalVolumeCents = Math.round(
    row.transactions.reduce((sum, t) => sum + t.amount * 100, 0)
  );
  const totalTipsCents = Math.round(
    row.transactions.reduce((sum, t) => sum + t.tipAmount * 100, 0)
  );

  const detail: StylistDetail = {
    id: row.id,
    merchantId: row.merchantId,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role as StylistRole,
    commissionRate: row.commissionRate,
    hourlyRate: row.hourlyRate,
    payoutMethod: row.payoutMethod,
    status: row.status as StylistStatus,
    externalRef: row.externalRef,
    createdAt: row.createdAt.toISOString(),
    totalTransactions,
    totalVolumeCents,
    totalTipsCents,
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
  const result = await findStylistForMerchant(user.id, id);
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

  if (body.name !== undefined) {
    if (
      typeof body.name !== "string" ||
      body.name.trim().length === 0 ||
      body.name.trim().length > 100
    ) {
      return NextResponse.json(
        { error: "name must be 1-100 chars" },
        { status: 400 }
      );
    }
    data.name = body.name.trim();
  }

  if (body.email !== undefined) {
    data.email =
      typeof body.email === "string" && body.email.trim().length > 0
        ? body.email.trim().toLowerCase()
        : null;
  }

  if (body.phone !== undefined) {
    data.phone =
      typeof body.phone === "string" && body.phone.trim().length > 0
        ? body.phone.trim()
        : null;
  }

  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role as StylistRole)) {
      return NextResponse.json(
        { error: "role must be one of: stylist, manager, owner" },
        { status: 400 }
      );
    }
    data.role = body.role;
  }

  if (body.commissionRate !== undefined) {
    data.commissionRate =
      typeof body.commissionRate === "number" ? body.commissionRate : null;
  }

  if (body.hourlyRate !== undefined) {
    data.hourlyRate =
      typeof body.hourlyRate === "number" ? body.hourlyRate : null;
  }

  if (body.payoutMethod !== undefined) {
    data.payoutMethod =
      typeof body.payoutMethod === "string" &&
      body.payoutMethod.trim().length > 0
        ? body.payoutMethod.trim()
        : null;
  }

  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "inactive") {
      return NextResponse.json(
        { error: "status must be active or inactive" },
        { status: 400 }
      );
    }
    data.status = body.status;
  }

  if (body.externalRef !== undefined) {
    data.externalRef =
      typeof body.externalRef === "string" &&
      body.externalRef.trim().length > 0
        ? body.externalRef.trim()
        : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No editable fields provided" },
      { status: 400 }
    );
  }

  const updated = await prisma.stylist.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "stylist.update",
    targetType: "Stylist",
    targetId: id,
    merchantId: result.stylist.merchantId,
    metadata: { fields: Object.keys(data) },
  });

  return NextResponse.json({
    id: updated.id,
    merchantId: updated.merchantId,
    name: updated.name,
    email: updated.email,
    phone: updated.phone,
    role: updated.role,
    commissionRate: updated.commissionRate,
    hourlyRate: updated.hourlyRate,
    payoutMethod: updated.payoutMethod,
    status: updated.status,
    externalRef: updated.externalRef,
    createdAt: updated.createdAt.toISOString(),
  });
}

export async function DELETE(
  _request: Request,
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
  const result = await findStylistForMerchant(user.id, id);
  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status }
    );
  }

  await prisma.stylist.update({
    where: { id },
    data: { status: "inactive" },
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "stylist.delete",
    targetType: "Stylist",
    targetId: id,
    merchantId: result.stylist.merchantId,
  });

  return NextResponse.json({ ok: true });
}
