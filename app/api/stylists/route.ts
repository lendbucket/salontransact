import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import type {
  StylistSummary,
  StylistListResponse,
  StylistRole,
  StylistStatus,
} from "@/lib/stylists/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PostBody {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  role?: unknown;
  commissionRate?: unknown;
  hourlyRate?: unknown;
  payoutMethod?: unknown;
  externalRef?: unknown;
}

const VALID_ROLES: StylistRole[] = ["stylist", "manager", "owner"];

function rowToSummary(r: {
  id: string;
  merchantId: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: string;
  commissionRate: number | null;
  hourlyRate: number | null;
  payoutMethod: string | null;
  status: string;
  externalRef: string | null;
  createdAt: Date;
}): StylistSummary {
  return {
    id: r.id,
    merchantId: r.merchantId,
    name: r.name,
    email: r.email,
    phone: r.phone,
    role: r.role as StylistRole,
    commissionRate: r.commissionRate,
    hourlyRate: r.hourlyRate,
    payoutMethod: r.payoutMethod,
    status: r.status as StylistStatus,
    externalRef: r.externalRef,
    createdAt: r.createdAt.toISOString(),
  };
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

  const whereClause: Record<string, unknown> = { merchantId: merchant.id };
  if (status === "active" || status === "inactive") {
    whereClause.status = status;
  }

  const rows = await prisma.stylist.findMany({
    where: whereClause,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const data = rows.map(rowToSummary);
  const response: StylistListResponse = { data, count: data.length };
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

  if (
    typeof body.name !== "string" ||
    body.name.trim().length === 0 ||
    body.name.trim().length > 100
  ) {
    return NextResponse.json(
      { error: "name required (1-100 chars)" },
      { status: 400 }
    );
  }
  const name = body.name.trim();

  const email =
    typeof body.email === "string" && body.email.trim().length > 0
      ? body.email.trim().toLowerCase()
      : null;

  const phone =
    typeof body.phone === "string" && body.phone.trim().length > 0
      ? body.phone.trim()
      : null;

  let role: StylistRole = "stylist";
  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role as StylistRole)) {
      return NextResponse.json(
        { error: "role must be one of: stylist, manager, owner" },
        { status: 400 }
      );
    }
    role = body.role as StylistRole;
  }

  const commissionRate =
    typeof body.commissionRate === "number" ? body.commissionRate : null;
  const hourlyRate =
    typeof body.hourlyRate === "number" ? body.hourlyRate : null;
  const payoutMethod =
    typeof body.payoutMethod === "string" && body.payoutMethod.trim().length > 0
      ? body.payoutMethod.trim()
      : null;
  const externalRef =
    typeof body.externalRef === "string" && body.externalRef.trim().length > 0
      ? body.externalRef.trim()
      : null;

  const created = await prisma.stylist.create({
    data: {
      merchantId: merchant.id,
      name,
      email,
      phone,
      role,
      commissionRate,
      hourlyRate,
      payoutMethod,
      externalRef,
      status: "active",
    },
  });

  await writeAuditLog({
    actor: { id: user.id, email: user.email ?? "", role: user.role ?? "" },
    action: "stylist.create",
    targetType: "Stylist",
    targetId: created.id,
    merchantId: merchant.id,
    metadata: { name, role },
  });

  return NextResponse.json(rowToSummary(created), { status: 201 });
}
