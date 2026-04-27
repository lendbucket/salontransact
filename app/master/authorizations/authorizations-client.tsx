"use client";

import { useState, useEffect, useCallback } from "react";
import { Lock, ArrowLeft, RefreshCw } from "lucide-react";
import type { PayrocAuthorization } from "@/lib/authorizations/types";
import AuthorizationCard from "@/components/authorizations/authorization-card";

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
  if (["approved", "authorized", "complete", "settled"].includes(s))
    return "bg-[#DCFCE7] text-[#15803D]";
  if (["pending", "processing", "open"].includes(s))
    return "bg-[#FEF3C7] text-[#92400E]";
  if (["declined", "voided", "expired", "reversed", "failed"].includes(s))
    return "bg-[#FEF2F2] text-[#DC2626]";
  return "bg-[#F4F5F7] text-[#4A4A4A]";
}

export default function AuthorizationsClient() {
  const [date, setDate] = useState(formatToday());
  const [authorizations, setAuthorizations] = useState<PayrocAuthorization[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<PayrocAuthorization | null>(null);
  const [detail, setDetail] = useState<PayrocAuthorization | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const loadAuthorizations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`/api/authorizations?date=${date}&limit=25`);
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || "Failed to load authorizations");
        setAuthorizations([]);
      } else {
        setAuthorizations(Array.isArray(j.data) ? j.data : []);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      setAuthorizations([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  const loadDetail = useCallback(async (authorizationId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const r = await fetch(
        `/api/authorizations/${encodeURIComponent(authorizationId)}`
      );
      const j = await r.json();
      if (!r.ok) {
        setDetailError(j.error || "Failed to load authorization detail");
        setDetail(null);
      } else {
        setDetail(j);
      }
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : "Network error");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAuthorizations();
  }, [loadAuthorizations]);

  function selectAuth(a: PayrocAuthorization) {
    setSelected(a);
    void loadDetail(a.authorizationId);
  }

  function clearSelection() {
    setSelected(null);
    setDetail(null);
    setDetailError(null);
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
                Authorizations
              </h2>
              <p className="text-sm text-[#878787] mt-0.5">
                Card authorization requests and their approval status.
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
                onClick={() => void loadAuthorizations()}
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
              Loading authorizations...
            </div>
          ) : authorizations.length === 0 && !error ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#F4F5F7] flex items-center justify-center mb-4">
                <Lock
                  size={24}
                  strokeWidth={1.5}
                  className="text-[#878787]"
                />
              </div>
              <h3 className="text-base font-semibold text-[#1A1313] mb-1">
                No authorizations for this date
              </h3>
              <p className="text-[13px] text-[#878787] max-w-sm">
                Authorization records will appear here when card transactions
                are processed.
              </p>
            </div>
          ) : (
            <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E8EAED]">
                    {[
                      "Authorization ID",
                      "Payment ID",
                      "Date",
                      "Card",
                      "Amount",
                      "Response",
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
                  {authorizations.map((a) => (
                    <tr
                      key={a.authorizationId}
                      onClick={() => selectAuth(a)}
                      className="border-b border-[#F4F5F7] hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-3 text-[13px] text-[#1A1313] font-mono">
                        {a.authorizationId}
                      </td>
                      <td className="px-6 py-3 text-[13px] text-[#4A4A4A] font-mono">
                        {a.paymentId ?? "\u2014"}
                      </td>
                      <td className="px-6 py-3 text-[13px] text-[#1A1313]">
                        {a.date ?? fmtDate(a.dateTime)}
                      </td>
                      <td className="px-6 py-3 text-[13px] text-[#4A4A4A]">
                        {a.cardScheme && a.last4
                          ? `${a.cardScheme} \u00B7\u00B7\u00B7\u00B7${a.last4}`
                          : "\u2014"}
                      </td>
                      <td className="px-6 py-3 text-[13px] text-[#1A1313] text-right font-medium">
                        {fmtMoney(a.amount)}
                      </td>
                      <td className="px-6 py-3 text-[13px] text-[#4A4A4A] font-mono">
                        {a.responseCode ?? a.approvalCode ?? "\u2014"}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${statusPill(a.status)}`}
                        >
                          {a.status ?? "unknown"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y" style={{ borderColor: "#E8EAED" }}>
              {authorizations.map((a) => (
                <AuthorizationCard
                  key={a.authorizationId}
                  authorization={a}
                  onClick={() => selectAuth(a)}
                />
              ))}
            </div>
            </>
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
                All authorizations
              </button>
              <div>
                <h2 className="text-lg font-semibold text-[#1A1313]">
                  Authorization {selected.authorizationId}
                </h2>
                <p className="text-sm text-[#878787] mt-0.5">
                  {selected.cardScheme && selected.last4
                    ? `${selected.cardScheme} ····${selected.last4}`
                    : "Card authorization"}{" "}
                  · {fmtMoney(selected.amount)}
                </p>
              </div>
            </div>
          </div>

          {detailError && (
            <div className="mx-6 my-4 p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[13px] text-[#DC2626]">
              {detailError}
            </div>
          )}

          {detailLoading ? (
            <div className="px-6 py-12 text-center text-sm text-[#878787]">
              Loading authorization detail...
            </div>
          ) : (
            <div className="px-6 pb-6">
              {/* Authorization summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 py-4">
                {[
                  { label: "Payment ID", value: (detail ?? selected).paymentId ?? "\u2014" },
                  { label: "Date", value: fmtDate((detail ?? selected).dateTime) || (detail ?? selected).date || "\u2014" },
                  {
                    label: "Card",
                    value:
                      (detail ?? selected).cardScheme && (detail ?? selected).last4
                        ? `${(detail ?? selected).cardScheme} \u00B7\u00B7\u00B7\u00B7${(detail ?? selected).last4}`
                        : "\u2014",
                  },
                  { label: "Amount", value: fmtMoney((detail ?? selected).amount) },
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

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pb-4">
                {[
                  { label: "Response Code", value: (detail ?? selected).responseCode ?? "\u2014" },
                  { label: "Approval Code", value: (detail ?? selected).approvalCode ?? "\u2014" },
                  { label: "Merchant Ref", value: (detail ?? selected).merchantReference ?? "\u2014" },
                  { label: "Currency", value: (detail ?? selected).currency ?? "\u2014" },
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

              {/* Status */}
              <div className="pb-4">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#878787] mb-1">
                  Status
                </p>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${statusPill((detail ?? selected).status)}`}
                >
                  {(detail ?? selected).status ?? "unknown"}
                </span>
              </div>

              {/* Raw detail (if detail has extra fields beyond the list view) */}
              {detail && Object.keys(detail).length > 8 && (
                <div className="mt-4 pt-4 border-t border-[#E8EAED]">
                  <h3 className="text-base font-semibold text-[#1A1313] mb-3">
                    All Fields
                  </h3>
                  <div className="bg-[#F9FAFB] rounded-lg border border-[#F4F5F7] p-4 overflow-x-auto">
                    <pre className="text-[12px] text-[#4A4A4A] font-mono whitespace-pre-wrap">
                      {JSON.stringify(detail, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
