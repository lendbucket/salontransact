import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  MasterApiKeyListResponse,
  MasterApiKeyRow,
} from "@/lib/api-keys/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { id?: string; role?: string } | undefined;

  if (!user || !user.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.role !== "master portal") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const merchantIdParam = url.searchParams.get("merchantId");
  const activeParam = url.searchParams.get("active");

  const where: { merchantId?: string; active?: boolean } = {};
  if (merchantIdParam && merchantIdParam.length > 0) {
    where.merchantId = merchantIdParam;
  }
  if (activeParam === "true") where.active = true;
  if (activeParam === "false") where.active = false;

  const rows = await prisma.apiKey.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      merchant: {
        select: { id: true, businessName: true },
      },
    },
  });

  const data: MasterApiKeyRow[] = rows.map((r) => ({
    id: r.id,
    merchantId: r.merchantId,
    merchantBusinessName: r.merchant.businessName,
    name: r.name,
    keyPrefix: r.keyPrefix ?? "",
    active: r.active,
    lastUsed: r.lastUsed ? r.lastUsed.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));

  const activeCount = data.filter((k) => k.active).length;
  const merchantsRepresented = new Set(data.map((k) => k.merchantId)).size;

  const response: MasterApiKeyListResponse = {
    data,
    count: data.length,
    activeCount,
    merchantsRepresented,
  };
  return NextResponse.json(response);
}
