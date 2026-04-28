import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { MasterDevicesClient } from "./master-devices-client";
import type { MasterDeviceRow } from "@/lib/devices/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ merchantId?: string }>;
}

export default async function MasterDevicesPage({ searchParams }: PageProps) {
  await requireMaster();
  const params = await searchParams;
  const merchantIdScope = params.merchantId ?? null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { status: { not: "retired" } };
  if (merchantIdScope) where.merchantId = merchantIdScope;

  const [rows, allMerchants, scopeMerchant] = await Promise.all([
    prisma.device.findMany({
      where,
      orderBy: [{ pairedAt: "desc" }],
      take: 500,
      include: {
        merchant: {
          select: { id: true, businessName: true, city: true, state: true },
        },
      },
    }),
    prisma.merchant.findMany({
      orderBy: { businessName: "asc" },
      select: { id: true, businessName: true },
    }),
    merchantIdScope
      ? prisma.merchant.findUnique({
          where: { id: merchantIdScope },
          select: { id: true, businessName: true, city: true, state: true },
        })
      : Promise.resolve(null),
  ]);

  const initialDevices: MasterDeviceRow[] = rows.map((r) => ({
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

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1
        className="text-2xl font-semibold text-[#1A1313] mb-1"
        style={{ letterSpacing: "-0.31px" }}
      >
        Devices
      </h1>
      <p className="text-sm text-[#878787] mb-8">
        {scopeMerchant
          ? `Card-present terminals for ${scopeMerchant.businessName}`
          : "All paired terminals across the platform"}
      </p>

      <MasterDevicesClient
        initialDevices={initialDevices}
        allMerchants={allMerchants}
        scopedMerchantId={merchantIdScope}
        scopedMerchant={scopeMerchant}
      />
    </div>
  );
}
