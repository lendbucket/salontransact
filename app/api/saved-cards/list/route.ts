import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  AllCardsListResponse,
  SavedCardPublic,
} from "@/lib/saved-cards/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveMerchantId(
  user: { id: string; role?: string },
  merchantIdParam: string | null
): Promise<{ merchantId: string } | { error: string; status: number }> {
  if (user.role === "master portal") {
    if (!merchantIdParam || merchantIdParam.length === 0) {
      return { error: "master portal must provide merchantId", status: 400 };
    }
    const exists = await prisma.merchant.findUnique({
      where: { id: merchantIdParam },
      select: { id: true },
    });
    if (!exists) return { error: "merchant not found", status: 404 };
    return { merchantId: merchantIdParam };
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
  const statusParam = url.searchParams.get("status") ?? "active";
  const q = url.searchParams.get("q")?.trim() ?? "";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { merchantId: resolved.merchantId };
  if (statusParam !== "all" && statusParam.length > 0) {
    where.status = statusParam;
  }
  if (q.length > 0) {
    where.OR = [
      { customerEmail: { contains: q, mode: "insensitive" } },
      { cardholderName: { contains: q, mode: "insensitive" } },
      { last4: { contains: q } },
      { label: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.savedPaymentMethod.findMany({
    where,
    orderBy: [{ lastUsedAt: "desc" }, { createdAt: "desc" }],
    take: 500,
  });

  const data: SavedCardPublic[] = rows.map((r) => ({
    id: r.id,
    customerEmail: r.customerEmail,
    payrocSecureTokenId: r.payrocSecureTokenId,
    cardScheme: r.cardScheme,
    last4: r.last4,
    expiryMonth: r.expiryMonth,
    expiryYear: r.expiryYear,
    cardholderName: r.cardholderName,
    label: r.label,
    status: r.status,
    mitAgreement: r.mitAgreement,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
  }));

  const uniqueCustomers = new Set(data.map((c) => c.customerEmail)).size;
  const response: AllCardsListResponse = {
    data,
    count: data.length,
    uniqueCustomers,
  };

  return NextResponse.json(response);
}
