import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { NewCertSessionClient } from "./new-cert-session-client";
import { getTestCaseStats } from "@/lib/cert/test-cases";

export const dynamic = "force-dynamic";

export default async function NewCertSessionPage() {
  await requireMaster();
  const stats = getTestCaseStats();

  const merchants = await prisma.merchant.findMany({
    where: {
      apiKeys: { some: { active: true } },
    },
    select: {
      id: true,
      businessName: true,
      apiKeys: {
        where: { active: true },
        select: { id: true, name: true, keyPrefix: true },
        take: 5,
      },
      devices: {
        where: { status: "active" },
        select: { id: true, serialNumber: true, label: true, model: true },
        orderBy: { pairedAt: "desc" },
        take: 10,
      },
    },
    orderBy: { businessName: "asc" },
    take: 50,
  });

  const merchantOptions = merchants
    .filter((m) => m.apiKeys.length > 0)
    .map((m) => ({
      id: m.id,
      businessName: m.businessName,
      apiKeys: m.apiKeys.map((k) => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix })),
      devices: m.devices.map((d) => ({
        id: d.id,
        serialNumber: d.serialNumber,
        label: d.label,
        model: d.model,
      })),
    }));

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Start New Cert Run</h1>
      <p className="text-sm text-gray-500 mb-6">
        Creates a new cert session and seeds all {stats.total} test cases as pending runs.
      </p>
      <NewCertSessionClient stats={stats} merchants={merchantOptions} />
    </div>
  );
}
