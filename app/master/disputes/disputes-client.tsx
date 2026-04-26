"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, ArrowLeft, RefreshCw } from "lucide-react";
import type {
  PayrocDispute,
  PayrocDisputeStatus,
} from "@/lib/disputes/types";

const SHADOW =
  "0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05), 0 16px 16px rgba(0,0,0,0.05)";

function formatToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmtMoney(cents: number | undefined): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "\u2014";
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtDate(iso: string | undefined): string {
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function statusPill(status: string | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (["won", "closed", "resolved", "accepted"].includes(s))
    return "bg-[#DCFCE7] text-[#15803D]";
  if (["open", "inquiry", "pending", "reviewing"].includes(s))
    return "bg-[#FEF3C7] text-[#92400E]";
  if (["lost", "expired", "declined"].includes(s))
    return "bg-[#FEF2F2] text-[#DC2626]";
  return "bg-[#F4F5F7] text-[#4A4A4A]";
}

export default function DisputesClient() {
  const [date, setDate] = useState(formatToday());
  const [disputes, setDisputes] = useState<PayrocDispute[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<PayrocDispute | null>(null);
  const [statuses, setStatuses] = useState<PayrocDisputeStatus[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/disputes?date=${date}&limit=25`);
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Failed to load disputes");
        setDisputes([]);
      } else {
        setDisputes(Array.isArray(j.data) ? j.data : []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setDisputes([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const loadStatuses = useCallback(async (disputeId: string) => {
    setStatusLoading(true);
    setStatusError(null);
    try {
      const r = await fetch(
        `/api/disputes/${encodeURIComponent(disputeId)}/statuses`
      );
      const j = await r.json();
      if (!r.ok) {
        setStatusError(j.error || "Failed to load statuses");
        setStatuses([]);
      } else {
        setStatuses(Array.isArray(j.data) ? j.data : []);
      }
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : "Network error");
      setStatuses([]);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDisputes();
  }, [loadDisputes]);

  function selectDispute(d: PayrocDispute) {
    setSelected(d);
    void loadStatuses(d.disputeId);
  }

  function clearSelection() {
    setSelected(null);
    setStatuses([]);
    setStatusError(null);
  }

  return (
    <div className="space-y-8">
      {!selected && (
        <div
          className="bg-white border border-[#E8EAED] rounded-xl overflow-hidden"
          style={{ boxShadow: SHADOW }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EAED]">
            <div>
              <h2 className="text-lg font-semibold text-[#1A1313]">
                Disputes
              </h2>
              <p className="text-sm text-[#878787] mt-0.5">
                Customer-initiated payment disputes and chargebacks.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-9 px-3 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg text-[14px] text-[#1A1313] focus:outline-none focus:border-[#017ea7] focus:bg-white focus:shadow-[0_0_0_3px_rgba(1,126,167,0.1)]"
              />
              <button
                onClick={() => void loadDisputes()}
                disabled={loading}
                className="inline-flex items-center gap-2 h-9 px-3 bg-white border border-[#D1D5DB] text-[#1A1313] rounded-lg text-[14px] font-medium hover:bg-[#F4F5F7] disabled:opacity-50 cursor-pointer transition-all"
              >
                <RefreshCw
                  size={14}
                  strokeWidth={1.5}
                  className={loading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>

          {error && (
            <div className="mx-6 my-4 p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[13px] text-[#DC2626]">
              {error}
            </div>
          )}

          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-[#878787]">
              Loading disputes...
            </div>
          ) : disputes.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#F4F5F7] flex items-center justify-center mb-4">
                <AlertCircle
                  size={24}
                  strokeWidth={1.5}
                  className="text-[#878787]"
                />
              </div>
              <h3 className="text-base font-semibold text-[#1A1313] mb-1">
                No disputes for this date
              </h3>
              <p className="text-[13px] text-[#878787] max-w-sm">
                Disputes will appear here when customers challenge a
                transaction.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E8EAED]">
                  {[
                    "Dispute ID",
                    "Payment ID",
                    "Date",
                    "Reason",
                    "Amount",
                    "Deadline",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#878787] ${h === "Amount" ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr
                    key={d.disputeId}
                    onClick={() => selectDispute(d)}
                    className="border-b border-[#F4F5F7] hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 text-[13px] text-[#1A1313] font-mono">
                      {d.disputeId}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#4A4A4A] font-mono">
                      {d.paymentId ?? "\u2014"}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#1A1313]">
                      {d.date ?? "\u2014"}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#4A4A4A]">
                      {d.reasonDescription ?? d.reasonCode ?? "\u2014"}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#1A1313] text-right font-medium">
                      {fmtMoney(d.amount)}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#4A4A4A]">
                      {fmtDate(d.responseDeadline)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${statusPill(d.status)}`}
                      >
                        {d.status ?? "unknown"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selected && (
        <div
          className="bg-white border border-[#E8EAED] rounded-xl overflow-hidden"
          style={{ boxShadow: SHADOW }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EAED]">
            <div className="flex items-center gap-3">
              <button
                onClick={clearSelection}
                className="inline-flex items-center gap-2 h-9 px-3 bg-white border border-[#D1D5DB] text-[#1A1313] rounded-lg text-[14px] font-medium hover:bg-[#F4F5F7] cursor-pointer transition-all"
              >
                <ArrowLeft size={14} strokeWidth={1.5} />
                All disputes
              </button>
              <div>
                <h2 className="text-lg font-semibold text-[#1A1313]">
                  Dispute {selected.disputeId}
                </h2>
                <p className="text-sm text-[#878787] mt-0.5">
                  {selected.reasonDescription ?? selected.reasonCode ?? "Unknown reason"}{" "}
                  · {fmtMoney(selected.amount)}
                </p>
              </div>
            </div>
          </div>

          {/* Read-only notice */}
          <div className="mx-6 my-4 p-3 bg-[#DBEAFE] border border-[#3B82F6]/30 rounded-lg text-[13px] text-[#1E40AF]">
            To submit evidence or respond to this dispute, log into the
            payment gateway directly. SalonTransact currently provides
            read-only dispute monitoring.
          </div>

          {/* Dispute summary */}
          <div className="px-6 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Payment ID", value: selected.paymentId ?? "\u2014" },
              { label: "Date", value: selected.date ?? "\u2014" },
              {
                label: "Card",
                value:
                  selected.cardScheme && selected.last4
                    ? `${selected.cardScheme} \u00B7\u00B7\u00B7\u00B7${selected.last4}`
                    : "\u2014",
              },
              {
                label: "Deadline",
                value: fmtDate(selected.responseDeadline),
              },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#878787] mb-1">
                  {item.label}
                </p>
                <p className="text-[13px] text-[#1A1313] font-mono">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          {/* Status history */}
          <div className="px-6 pb-6">
            <h3 className="text-base font-semibold text-[#1A1313] mb-4">
              Status History
            </h3>

            {statusError && (
              <div className="p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[13px] text-[#DC2626] mb-4">
                {statusError}
              </div>
            )}

            {statusLoading ? (
              <p className="text-sm text-[#878787]">Loading statuses...</p>
            ) : statuses.length === 0 && !statusError ? (
              <p className="text-sm text-[#878787]">
                No status history available.
              </p>
            ) : (
              <div className="space-y-3">
                {statuses.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 p-3 bg-[#F9FAFB] rounded-lg border border-[#F4F5F7]"
                  >
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider shrink-0 mt-0.5 ${statusPill(s.status)}`}
                    >
                      {s.status}
                    </span>
                    <div>
                      <p className="text-[13px] text-[#1A1313]">
                        {fmtDate(s.dateTime)}
                      </p>
                      {s.notes && (
                        <p className="text-[12px] text-[#878787] mt-1">
                          {s.notes}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
