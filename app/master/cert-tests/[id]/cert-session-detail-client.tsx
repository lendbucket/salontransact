"use client";

import { useMemo, useState } from "react";

interface SessionData {
  id: string;
  name: string;
  description: string | null;
  status: string;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  skippedTests: number;
  startedAt: string;
  completedAt: string | null;
}

interface RunData {
  id: string;
  testCaseId: string;
  sheetName: string;
  sectionName: string;
  transactionType: string;
  scenario: string;
  expectedResult: string;
  required: boolean;
  status: string;
  paymentId: string | null;
  notes: string | null;
  ranAt: string | null;
}

interface Props {
  session: SessionData;
  runs: RunData[];
}

function statusPillClasses(status: string): string {
  switch (status) {
    case "passed": return "bg-green-100 text-green-800";
    case "failed": return "bg-red-100 text-red-800";
    case "skipped": return "bg-gray-100 text-gray-700";
    case "running": return "bg-blue-100 text-blue-800";
    case "pending": return "bg-yellow-50 text-yellow-800";
    default: return "bg-gray-100 text-gray-700";
  }
}

export function CertSessionDetailClient({ session, runs }: Props) {
  const [activeSheet, setActiveSheet] = useState<"CNP" | "CP">("CNP");

  const filteredRuns = useMemo(
    () => runs.filter((r) => r.sheetName === activeSheet),
    [runs, activeSheet]
  );

  const groupedBySection = useMemo(() => {
    const map = new Map<string, RunData[]>();
    for (const r of filteredRuns) {
      const list = map.get(r.sectionName) ?? [];
      list.push(r);
      map.set(r.sectionName, list);
    }
    return Array.from(map.entries());
  }, [filteredRuns]);

  const completed = session.passedTests + session.failedTests + session.skippedTests;
  const pct = session.totalTests > 0 ? Math.round((completed / session.totalTests) * 100) : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{session.name}</h1>
      {session.description && <p className="text-sm text-gray-500 mt-1">{session.description}</p>}

      <div className="bg-white border border-gray-200 rounded-lg p-6 mt-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm font-medium text-gray-900">Progress</div>
          <div className="text-xs text-gray-500">{completed} of {session.totalTests} complete ({pct}%)</div>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-[#017ea7] transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-4 gap-4 mt-4 text-center">
          <div>
            <div className="text-xl font-semibold text-yellow-700">{session.totalTests - completed}</div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-green-600">{session.passedTests}</div>
            <div className="text-xs text-gray-500">Passed</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-red-600">{session.failedTests}</div>
            <div className="text-xs text-gray-500">Failed</div>
          </div>
          <div>
            <div className="text-xl font-semibold text-gray-500">{session.skippedTests}</div>
            <div className="text-xs text-gray-500">Skipped</div>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="border-b border-gray-200 flex">
          {(["CNP", "CP"] as const).map((sheet) => (
            <button
              key={sheet}
              type="button"
              onClick={() => setActiveSheet(sheet)}
              className={`px-4 py-2 text-sm font-medium border-b-2 ${
                activeSheet === sheet
                  ? "border-[#017ea7] text-[#017ea7]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {sheet === "CNP" ? "CNP (Hosted Fields)" : "CP (Payroc Cloud)"}
              <span className="ml-2 text-xs text-gray-400">({runs.filter((r) => r.sheetName === sheet).length})</span>
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          {groupedBySection.map(([sectionName, sectionRuns]) => (
            <div key={sectionName} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-900">
                {sectionName}
                <span className="ml-2 text-xs text-gray-500 font-normal">({sectionRuns.length})</span>
              </div>
              <table className="w-full">
                <tbody className="divide-y divide-gray-100">
                  {sectionRuns.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-6 py-3 align-top w-56">
                        <div className="text-sm font-medium text-gray-900">{r.transactionType}</div>
                        {r.required && (
                          <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-[#017ea7] text-white mt-1">
                            REQUIRED
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 align-top">
                        <div className="text-sm text-gray-700">{r.scenario}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Expected: <span className="text-gray-700">{r.expectedResult}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 align-top w-32 text-right">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${statusPillClasses(r.status)}`}>
                          {r.status}
                        </span>
                        {r.paymentId && (
                          <div className="text-[10px] text-gray-500 mt-1 font-mono break-all">{r.paymentId}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <div className="font-medium mb-1">Test execution coming next commit</div>
        <div className="text-blue-800">
          The &quot;Run&quot; buttons and &quot;Export to Spreadsheet&quot; feature ship in Commits 18 and 19. CNP test execution is currently
          blocked on the SDK 1.7.0 regression (see SD-010). Once Payroc resolves, the runner will execute tests against UAT,
          capture paymentIds, and export Matt&apos;s exact spreadsheet format ready to email back.
        </div>
      </div>
    </div>
  );
}
