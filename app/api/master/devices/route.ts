import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  MasterDeviceListResponse,
  MasterDeviceRow,
} from "@/lib/devices/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const includeRetired = url.searchParams.get("includeRetired") === "true";
  const merchantIdParam = url.searchParams.get("merchantId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (merchantIdParam && merchantIdParam.length > 0) {
    where.merchantId = merchantIdParam;
  }
  if (!includeRetired) {
    where.status = { not: "retired" };
  }

  const rows = await prisma.device.findMany({
    where,
    orderBy: [{ pairedAt: "desc" }],
    take: 500,
    include: {
      merchant: {
        select: {
          id: true,
          businessName: true,
          city: true,
          state: true,
        },
      },
    },
  });

  const data: MasterDeviceRow[] = rows.map((r) => ({
    id: r.id,
    serialNumber: r.serialNumber,
    model: r.model,
    label: r.label,
    status: r.status,
    pairedAt: r.pairedAt.toISOString(),
    lastSeenAt: r.lastSeenAt ? r.lastSeenAt.toISOString() : null,
    lastChargeAt: r.lastChargeAt ? r.lastChargeAt.toISOString() : null,
    merchantId: r.merchant.id,
    merchantBusinessName: r.merchant.businessName,
    merchantCity: r.merchant.city,
    merchantState: r.merchant.state,
  }));

  const merchantsRepresented = new Set(data.map((d) => d.merchantId)).size;

  const response: MasterDeviceListResponse = {
    data,
    count: data.length,
    merchantsRepresented,
  };

  return NextResponse.json(response);
}
