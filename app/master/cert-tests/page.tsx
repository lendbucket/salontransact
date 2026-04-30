import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { CertTestsClient } from "./cert-tests-client";

export const dynamic = "force-dynamic";

export default async function MasterCertTestsPage() {
  await requireMaster();

  const sessions = await prisma.certTestSession.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const sessionList = sessions.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    status: s.status,
    totalTests: s.totalTests,
    passedTests: s.passedTests,
    failedTests: s.failedTests,
    skippedTests: s.skippedTests,
    startedAt: s.startedAt.toISOString(),
    completedAt: s.completedAt?.toISOString() ?? null,
    createdAt: s.createdAt.toISOString(),
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cert Tests</h1>
          <p className="text-sm text-gray-500 mt-1">
            Payroc certification test plan execution. Internal master-portal tooling.
          </p>
        </div>
        <Link
          href="/master/cert-tests/new"
          className="inline-flex items-center px-4 py-2 bg-[#017ea7] text-white text-sm font-medium rounded-lg hover:bg-[#016690]"
        >
          Start New Cert Run
        </Link>
      </div>

      <CertTestsClient sessions={sessionList} />
    </div>
  );
}
