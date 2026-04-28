"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Loader2 } from "lucide-react";
import type { DigestFrequency } from "@/lib/notifications/preferences";

const OPTIONS: Array<{ id: DigestFrequency; title: string; description: string }> = [
  { id: "off", title: "Off", description: "Don't send digest emails. You can still see notifications in-app." },
  { id: "daily", title: "Daily", description: "Once per day at 8am Central, summarizing the last 24 hours." },
  { id: "weekly", title: "Weekly", description: "Once per week on Mondays, summarizing the last 7 days." },
];

export function NotificationsSection() {
  const [frequency, setFrequency] = useState<DigestFrequency>("off");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/notifications/digest-frequency");
        if (!res.ok) {
          setError("Failed to load preferences");
          return;
        }
        const data = (await res.json()) as { frequency: DigestFrequency };
        if (!cancelled) setFrequency(data.frequency ?? "off");
      } catch {
        if (!cancelled) setError("Failed to load preferences");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/notifications/digest-frequency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? `Save failed (${res.status})`);
        return;
      }
      setSavedAt(Date.now());
      setTimeout(() => setSavedAt(null), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ marginBottom: 4, fontSize: 16, fontWeight: 600, color: "#1A1313" }}>
        Email digest
      </h3>
      <p style={{ marginBottom: 20, fontSize: 13, color: "#878787" }}>
        Receive a summary of your notifications by email. You&apos;ll always see them in-app.
      </p>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#878787", fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" />
          Loading…
        </div>
      ) : (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 540 }}>
            {OPTIONS.map((opt) => {
              const selected = frequency === opt.id;
              return (
                <label
                  key={opt.id}
                  htmlFor={`digest-${opt.id}`}
                  style={{
                    display: "flex",
                    gap: 12,
                    padding: 14,
                    borderRadius: 8,
                    border: selected ? "2px solid #017ea7" : "1px solid #E8EAED",
                    background: selected ? "#F0F9FF" : "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  <input
                    id={`digest-${opt.id}`}
                    type="radio"
                    name="digestFrequency"
                    checked={selected}
                    onChange={() => setFrequency(opt.id)}
                    style={{ marginTop: 2, flexShrink: 0, accentColor: "#017ea7" }}
                  />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", marginBottom: 2 }}>
                      {opt.title}
                    </div>
                    <div style={{ fontSize: 12, color: "#4A4A4A" }}>
                      {opt.description}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {error && (
            <p style={{ color: "#DC2626", fontSize: 13, marginTop: 12 }}>{error}</p>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 h-9 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer mt-5"
            style={{ opacity: saving ? 0.6 : 1 }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {savedAt && <CheckCircle size={14} />}
            {saving ? "Saving…" : savedAt ? "Saved" : "Save Preferences"}
          </button>
        </>
      )}
    </div>
  );
}
