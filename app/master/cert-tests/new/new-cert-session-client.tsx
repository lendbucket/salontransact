"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Stats {
  total: number;
  cnp: number;
  cp: number;
  required: number;
  optional: number;
}

interface Props {
  stats: Stats;
}

export function NewCertSessionClient({ stats }: Props) {
  const router = useRouter();
  const [name, setName] = useState("Reyna Pay Production Cert #1");
  const [description, setDescription] = useState("Initial Payroc certification — full surface (card + ACH + pre-auth + recurring + secure tokens + surcharging + dual pricing)");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/master/cert-tests/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Failed: ${res.status}`);
      }
      const data = (await res.json()) as { id: string };
      router.push(`/master/cert-tests/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create session");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-sm font-medium text-gray-900 mb-4">Test plan summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          <div>
            <div className="text-2xl font-semibold text-gray-900">{stats.total}</div>
            <div className="text-xs text-gray-500 mt-0.5">Total tests</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-gray-900">{stats.cnp}</div>
            <div className="text-xs text-gray-500 mt-0.5">CNP (Hosted Fields)</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-gray-900">{stats.cp}</div>
            <div className="text-xs text-gray-500 mt-0.5">CP (Payroc Cloud)</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-green-600">{stats.required}</div>
            <div className="text-xs text-gray-500 mt-0.5">Required</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-gray-500">{stats.optional}</div>
            <div className="text-xs text-gray-500 mt-0.5">Optional</div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Session name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#017ea7]"
            disabled={submitting}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#017ea7]"
            disabled={submitting}
          />
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <a href="/master/cert-tests" className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900">
            Cancel
          </a>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || name.trim().length === 0}
            className="px-4 py-2 bg-[#017ea7] text-white text-sm font-medium rounded-lg hover:bg-[#016690] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating\u2026" : "Create cert run"}
          </button>
        </div>
      </div>
    </div>
  );
}
