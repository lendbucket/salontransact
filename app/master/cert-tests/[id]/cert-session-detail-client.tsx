"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

      <BatchRunButtons sessionId={session.id} />

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
                    <CertTestRow key={r.id} run={r} />
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CertTestRow({ run }: { run: RunData }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualPaymentId, setManualPaymentId] = useState(run.paymentId ?? "");
  const [manualNotes, setManualNotes] = useState(run.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/master/cert-tests/runs/${run.id}/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Run failed");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  async function handleMarkManual(status: "passed" | "failed" | "skipped") {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(`/api/master/cert-tests/runs/${run.id}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, paymentId: manualPaymentId || null, notes: manualNotes || null }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Mark failed");
      } else {
        setShowManual(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Mark failed");
    } finally {
      setRunning(false);
      router.refresh();
    }
  }

  return (
    <>
      <tr className="hover:bg-gray-50">
        <td className="px-6 py-3 align-top w-56">
          <div className="text-sm font-medium text-gray-900">{run.transactionType}</div>
          {run.required && (
            <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded bg-[#017ea7] text-white mt-1">
              REQUIRED
            </span>
          )}
        </td>
        <td className="px-6 py-3 align-top">
          <div className="text-sm text-gray-700">{run.scenario}</div>
          <div className="text-xs text-gray-500 mt-1">
            Expected: <span className="text-gray-700">{run.expectedResult}</span>
          </div>
          {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
          {run.notes && <div className="text-xs text-gray-600 mt-1 italic">{run.notes}</div>}
        </td>
        <td className="px-6 py-3 align-top w-44 text-right">
          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${statusPillClasses(run.status)}`}>
            {run.status}
          </span>
          {run.paymentId && (
            <div className="text-[10px] text-gray-500 mt-1 font-mono break-all">{run.paymentId}</div>
          )}
          <div className="mt-2 flex flex-col gap-1">
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="px-2 py-1 bg-[#017ea7] text-white text-xs font-medium rounded hover:bg-[#016690] disabled:opacity-50"
            >
              {running ? "Running\u2026" : "Run"}
            </button>
            <button
              type="button"
              onClick={() => setShowManual((v) => !v)}
              disabled={running}
              className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded hover:bg-gray-200 disabled:opacity-50"
            >
              {showManual ? "Hide" : "Mark manually"}
            </button>
          </div>
        </td>
      </tr>
      {showManual && (
        <tr>
          <td colSpan={3} className="px-6 py-3 bg-gray-50 border-t border-gray-100">
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Payroc paymentId (optional)"
                value={manualPaymentId}
                onChange={(e) => setManualPaymentId(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs font-mono"
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={manualNotes}
                onChange={(e) => setManualNotes(e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => handleMarkManual("passed")} disabled={running} className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50">Mark passed</button>
                <button type="button" onClick={() => handleMarkManual("failed")} disabled={running} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50">Mark failed</button>
                <button type="button" onClick={() => handleMarkManual("skipped")} disabled={running} className="px-3 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600 disabled:opacity-50">Mark skipped</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function BatchRunButtons({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [running, setRunning] = useState<"CNP" | "CP" | null>(null);
  const [result, setResult] = useState<string | null>(null);

  async function runBatch(sheetName: "CNP" | "CP") {
    setRunning(sheetName);
    setResult(null);
    try {
      const res = await fetch(`/api/master/cert-tests/sessions/${sessionId}/run-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult(`Failed: ${data.error ?? "Unknown error"}`);
      } else {
        setResult(
          `${sheetName} batch complete: ${data.executed} executed (${data.passed} passed, ${data.failed} failed, ${data.skipped} skipped/manual)`
        );
      }
    } catch (e) {
      setResult(`Failed: ${e instanceof Error ? e.message : "Network error"}`);
    } finally {
      setRunning(null);
      router.refresh();
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4 flex items-center gap-3 flex-wrap">
      <span className="text-sm font-medium text-gray-700">Batch run:</span>
      <button
        type="button"
        onClick={() => runBatch("CNP")}
        disabled={running !== null}
        className="px-3 py-1.5 bg-[#017ea7] text-white text-sm font-medium rounded-lg hover:bg-[#016690] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running === "CNP" ? "Running CNP\u2026" : "Run all pending CNP"}
      </button>
      <button
        type="button"
        onClick={() => runBatch("CP")}
        disabled={running !== null}
        className="px-3 py-1.5 bg-[#017ea7] text-white text-sm font-medium rounded-lg hover:bg-[#016690] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {running === "CP" ? "Running CP\u2026 (tap card on each prompt)" : "Run all pending CP"}
      </button>
      {result && (
        <span className="text-xs text-gray-700 ml-2">{result}</span>
      )}
      <a
        href={`/api/master/cert-tests/sessions/${sessionId}/export`}
        download
        className="px-3 py-1.5 bg-gray-100 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-200 ml-auto"
      >
        Export to spreadsheet
      </a>
    </div>
  );
}
