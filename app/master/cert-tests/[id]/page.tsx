import { requireMaster } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CertSessionDetailClient } from "./cert-session-detail-client";

export const dynamic = "force-dynamic";

export default async function CertSessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireMaster();
  const { id } = await params;

  const session = await prisma.certTestSession.findUnique({
    where: { id },
    include: {
      runs: {
        orderBy: [{ sheetName: "asc" }, { sectionName: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!session) notFound();

  const sessionData = {
    id: session.id,
    name: session.name,
    description: session.description,
    status: session.status,
    totalTests: session.totalTests,
    passedTests: session.passedTests,
    failedTests: session.failedTests,
    skippedTests: session.skippedTests,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString() ?? null,
  };

  const runs = session.runs.map((r) => ({
    id: r.id,
    testCaseId: r.testCaseId,
    sheetName: r.sheetName,
    sectionName: r.sectionName,
    transactionType: r.transactionType,
    scenario: r.scenario,
    expectedResult: r.expectedResult,
    required: r.required,
    status: r.status,
    paymentId: r.paymentId,
    notes: r.notes,
    ranAt: r.ranAt?.toISOString() ?? null,
  }));

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <div className="mb-2">
        <Link href="/master/cert-tests" className="text-sm text-[#017ea7] hover:underline">
          &larr; Back to cert runs
        </Link>
      </div>
      <CertSessionDetailClient session={sessionData} runs={runs} />
    </div>
  );
}
