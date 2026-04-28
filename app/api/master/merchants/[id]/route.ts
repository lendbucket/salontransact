import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  MerchantDetail,
  MerchantPatchRequest,
} from "@/app/master/merchants/_lib/merchant-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = ["active", "suspended", "pending"] as const;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  const m = await prisma.merchant.findUnique({ where: { id } });

  if (!m) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  const detail: MerchantDetail = {
    id: m.id,
    userId: m.userId,
    businessName: m.businessName,
    dbaName: m.dbaName,
    businessType: m.businessType,
    email: m.email,
    phone: m.phone,
    address: m.address,
    city: m.city,
    state: m.state,
    zip: m.zip,
    ein: m.ein,
    ownerFirstName: m.ownerFirstName,
    ownerLastName: m.ownerLastName,
    ownerTitle: m.ownerTitle,
    ownerDob: m.ownerDob,
    ownerSsnLast4: m.ownerSsnLast4,
    ownerAddress: m.ownerAddress,
    ownershipPercentage: m.ownershipPercentage,
    bankAccountHolder: m.bankAccountHolder,
    bankRoutingNumber: m.bankRoutingNumber,
    bankAccountNumber: m.bankAccountNumber,
    bankAccountType: m.bankAccountType,
    fundingSpeed: m.fundingSpeed,
    avgTransaction: m.avgTransaction,
    paymentMethods: m.paymentMethods,
    monthlyVolume: m.monthlyVolume,
    totalVolume: m.totalVolume,
    totalTransactions: m.totalTransactions,
    payoutsEnabled: m.payoutsEnabled,
    chargesEnabled: m.chargesEnabled,
    stripeAccountStatus: m.stripeAccountStatus,
    plan: m.plan,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    applicationSubmittedAt: m.applicationSubmittedAt?.toISOString() ?? null,
  };

  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: MerchantPatchRequest;
  try {
    body = (await request.json()) as MerchantPatchRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (body.status !== undefined) {
    if (!ALLOWED_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { error: `status must be one of: ${ALLOWED_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    data.status = body.status;
  }

  if (body.plan !== undefined) {
    if (typeof body.plan !== "string" || body.plan.length > 50) {
      return NextResponse.json(
        { error: "plan must be a string <= 50 chars" },
        { status: 400 }
      );
    }
    data.plan = body.plan;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  try {
    const updated = await prisma.merchant.update({
      where: { id },
      data,
    });
    console.log(
      `[MASTER-MERCHANT-UPDATE] ${user.email} changed merchant ${id}:`,
      JSON.stringify(data)
    );
    return NextResponse.json({
      id: updated.id,
      status: updated.status,
      plan: updated.plan,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { error: `Update failed: ${message}` },
      { status: 500 }
    );
  }
}
