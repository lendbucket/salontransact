import { requireMaster } from "@/lib/session";
import { NewCertSessionClient } from "./new-cert-session-client";
import { getTestCaseStats } from "@/lib/cert/test-cases";

export const dynamic = "force-dynamic";

export default async function NewCertSessionPage() {
  await requireMaster();
  const stats = getTestCaseStats();

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Start New Cert Run</h1>
      <p className="text-sm text-gray-500 mb-6">
        Creates a new cert session and seeds all {stats.total} test cases as pending runs.
      </p>
      <NewCertSessionClient stats={stats} />
    </div>
  );
}
