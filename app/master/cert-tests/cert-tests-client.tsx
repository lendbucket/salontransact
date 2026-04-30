"use client";

import Link from "next/link";

interface SessionRow {
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
  createdAt: string;
}

interface Props {
  sessions: SessionRow[];
}

function statusPillClasses(status: string): string {
  switch (status) {
    case "complete":
      return "bg-green-100 text-green-800";
    case "in_progress":
      return "bg-blue-100 text-blue-800";
    case "abandoned":
      return "bg-gray-100 text-gray-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
}

function progressPct(s: SessionRow): number {
  if (s.totalTests === 0) return 0;
  const completed = s.passedTests + s.failedTests + s.skippedTests;
  return Math.round((completed / s.totalTests) * 100);
}

export function CertTestsClient({ sessions }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No cert runs yet</h3>
        <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
          Start a new cert run to seed all 98 Payroc test cases (64 CNP + 34 CP) and track execution against the certification plan.
        </p>
        <Link
          href="/master/cert-tests/new"
          className="inline-flex items-center px-4 py-2 bg-[#017ea7] text-white text-sm font-medium rounded-lg hover:bg-[#016690]"
        >
          Start New Cert Run
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
            <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
            <th className="text-right px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sessions.map((s) => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <div className="font-medium text-gray-900">{s.name}</div>
                {s.description && <div className="text-xs text-gray-500 mt-0.5">{s.description}</div>}
              </td>
              <td className="px-6 py-4">
                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${statusPillClasses(s.status)}`}>
                  {s.status.replace("_", " ")}
                </span>
              </td>
              <td className="px-6 py-4 w-72">
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#017ea7] transition-all"
                      style={{ width: `${progressPct(s)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 whitespace-nowrap">
                    {s.passedTests + s.failedTests + s.skippedTests} / {s.totalTests}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {s.passedTests} passed · {s.failedTests} failed · {s.skippedTests} skipped
                </div>
              </td>
              <td className="px-6 py-4 text-sm text-gray-500">
                {new Date(s.startedAt).toLocaleString()}
              </td>
              <td className="px-6 py-4 text-right">
                <Link
                  href={`/master/cert-tests/${s.id}`}
                  className="text-sm text-[#017ea7] font-medium hover:underline"
                >
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
