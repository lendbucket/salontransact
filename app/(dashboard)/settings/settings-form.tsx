"use client";

import { useState } from "react";
import { Loader2, Check } from "lucide-react";

type Merchant = {
  businessName: string;
  businessType: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
};

export function SettingsForm({ merchant }: { merchant: Merchant }) {
  const [form, setForm] = useState({
    businessName: merchant.businessName,
    businessType: merchant.businessType ?? "",
    email: merchant.email,
    phone: merchant.phone ?? "",
    address: merchant.address ?? "",
    city: merchant.city ?? "",
    state: merchant.state ?? "",
    zip: merchant.zip ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch("/api/merchant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setSaving(false);

    if (!res.ok) {
      setError("Failed to save settings");
      return;
    }

    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="st-card p-6">
      <h2 className="text-base font-semibold text-foreground mb-1">
        Business Details
      </h2>
      <p className="text-sm text-secondary mb-6">
        Used on receipts and customer-facing screens
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-medium text-secondary mb-2">
            Business name
          </label>
          <input
            value={form.businessName}
            onChange={(e) => update("businessName", e.target.value)}
            className="st-input"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-2">
            Business type
          </label>
          <input
            value={form.businessType}
            onChange={(e) => update("businessType", e.target.value)}
            className="st-input"
            placeholder="Salon, Spa, ..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-2">
            Email
          </label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
            className="st-input"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-2">
            Phone
          </label>
          <input
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            className="st-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-2">
            Address
          </label>
          <input
            value={form.address}
            onChange={(e) => update("address", e.target.value)}
            className="st-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-secondary mb-2">
            City
          </label>
          <input
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            className="st-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              State
            </label>
            <input
              value={form.state}
              onChange={(e) => update("state", e.target.value)}
              className="st-input"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              ZIP
            </label>
            <input
              value={form.zip}
              onChange={(e) => update("zip", e.target.value)}
              className="st-input"
            />
          </div>
        </div>
      </div>

      {error && (
        <div
          className="mt-4 text-sm rounded-md px-3 py-2"
          style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)" }}
        >
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 mt-6">
        <button
          type="submit"
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Save changes
        </button>
        {saved && (
          <span
            className="flex items-center gap-1 text-sm"
            style={{ color: "#22c55e" }}
          >
            <Check className="w-4 h-4" />
            Saved
          </span>
        )}
      </div>
    </form>
  );
}
