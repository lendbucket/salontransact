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

interface MerchantOption {
  id: string;
  businessName: string;
  apiKeys: { id: string; name: string; keyPrefix: string | null }[];
}

interface Props {
  stats: Stats;
  merchants: MerchantOption[];
}

export function NewCertSessionClient({ stats, merchants }: Props) {
  const router = useRouter();
  const [name, setName] = useState("Reyna Pay Production Cert #1");
  const [description, setDescription] = useState(
    "Initial Payroc certification — full surface (card + ACH + pre-auth + recurring + secure tokens + surcharging + dual pricing)"
  );
  const [merchantId, setMerchantId] = useState(merchants[0]?.id ?? "");
  const [apiKeyId, setApiKeyId] = useState(merchants[0]?.apiKeys[0]?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedMerchant = merchants.find((m) => m.id === merchantId);

  function handleMerchantChange(newMerchantId: string): void {
    setMerchantId(newMerchantId);
    const m = merchants.find((mm) => mm.id === newMerchantId);
    setApiKeyId(m?.apiKeys[0]?.id ?? "");
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/master/cert-tests/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, merchantId, apiKeyId }),
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

  if (merchants.length === 0) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
        <h3 className="font-medium text-yellow-900 mb-2">No merchants with API keys found</h3>
        <p className="text-sm text-yellow-800">
          Cert tests run as a specific merchant + API key. Create a test merchant with an active API key first.
        </p>
      </div>
    );
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Test merchant</label>
          <p className="text-xs text-gray-500 mb-2">
            All cert charges attribute to this merchant. Use a dedicated test merchant.
          </p>
          <select
            value={merchantId}
            onChange={(e) => handleMerchantChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#017ea7]"
            disabled={submitting}
          >
            {merchants.map((m) => (
              <option key={m.id} value={m.id}>{m.businessName}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">API key</label>
          <select
            value={apiKeyId}
            onChange={(e) => setApiKeyId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#017ea7]"
            disabled={submitting || !selectedMerchant}
          >
            {selectedMerchant?.apiKeys.map((k) => (
              <option key={k.id} value={k.id}>
                {k.name} ({k.keyPrefix ?? "no prefix"})
              </option>
            ))}
          </select>
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
            disabled={submitting || name.trim().length === 0 || !merchantId || !apiKeyId}
            className="px-4 py-2 bg-[#017ea7] text-white text-sm font-medium rounded-lg hover:bg-[#016690] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "Creating\u2026" : "Create cert run"}
          </button>
        </div>
      </div>
    </div>
  );
}
