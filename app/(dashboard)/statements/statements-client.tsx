"use client";

import { useState } from "react";
import { Download, FileText, Calendar, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";

const MONTH_OPTIONS = (() => {
  const out: Array<{ value: string; label: string }> = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    out.push({ value, label });
  }
  return out;
})();

export function StatementsClient() {
  const [selectedMonth, setSelectedMonth] = useState<string>(MONTH_OPTIONS[0].value);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  function showToast(kind: "success" | "error", message: string, ms = 3500) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), ms);
  }

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/statements?month=${selectedMonth}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Download failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `statement-${selectedMonth}.pdf`;

      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      showToast("success", `Downloaded ${filename}`);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Download failed");
    } finally {
      setLoading(false);
    }
  }

  const selectedLabel = MONTH_OPTIONS.find((o) => o.value === selectedMonth)?.label ?? selectedMonth;

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <Card padding={24}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 8, background: "#E6F4F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <FileText size={20} strokeWidth={1.5} color="#017ea7" />
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>Generate a statement</h2>
            <p style={{ fontSize: 13, color: "#878787", lineHeight: 1.5 }}>
              Choose a month and download a PDF showing total volume, fees, net deposits, and a daily breakdown of your processing activity.
            </p>
          </div>
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6 }}>
          Statement Period
        </label>
        <div className="flex flex-col sm:flex-row" style={{ gap: 8, marginBottom: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Calendar size={14} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#878787", pointerEvents: "none" }} />
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ width: "100%", height: 44, paddingLeft: 36, paddingRight: 12, background: "#FFFFFF", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, color: "#1A1313", outline: "none", cursor: "pointer" }}
            >
              {MONTH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <Button
            variant="primary"
            leadingIcon={loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            onClick={handleDownload}
            disabled={loading}
          >
            {loading ? "Generating\u2026" : "Download PDF"}
          </Button>
        </div>

        <p style={{ fontSize: 12, color: "#878787", marginTop: 12, lineHeight: 1.5 }}>
          Statement for <strong style={{ color: "#1A1313" }}>{selectedLabel}</strong> includes all successful transactions, fees, and refunds for the period.
        </p>
      </Card>
    </>
  );
}
