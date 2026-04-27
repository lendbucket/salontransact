"use client";

import { useState, useEffect, useCallback } from "react";
import { Wallet, ArrowLeft, RefreshCw } from "lucide-react";
import type {
  PayrocBatch,
  PayrocSettlementTransaction,
} from "@/lib/settlements/types";

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

function statusPillClasses(status: string | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (["closed", "funded", "settled", "complete"].includes(s))
    return "bg-[#DCFCE7] text-[#15803D]";
  if (["open", "pending", "processing"].includes(s))
    return "bg-[#FEF3C7] text-[#92400E]";
  return "bg-[#F4F5F7] text-[#4A4A4A]";
}

export default function SettlementsClient() {
  const [date, setDate] = useState(formatToday());
  const [batches, setBatches] = useState<PayrocBatch[]>([]);
  const [batchesLoading, setBatchesLoading] = useState(false);
  const [batchesError, setBatchesError] = useState<string | null>(null);

  const [selectedBatch, setSelectedBatch] = useState<PayrocBatch | null>(null);
  const [transactions, setTransactions] = useState<PayrocSettlementTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);

  const loadBatches = useCallback(async () => {
    setBatchesLoading(true);
    setBatchesError(null);
    try {
      const r = await fetch(`/api/settlements/batches?date=${date}&limit=25`);
      const j = await r.json();
      if (!r.ok) {
        setBatchesError(j.error || "Failed to load batches");
        setBatches([]);
      } else {
        setBatches(Array.isArray(j.data) ? j.data : []);
      }
    } catch (e) {
      setBatchesError(e instanceof Error ? e.message : "Network error");
      setBatches([]);
    } finally {
      setBatchesLoading(false);
    }
  }, [date]);

  const loadTransactions = useCallback(async (batchId: string) => {
    setTxLoading(true);
    setTxError(null);
    try {
      const r = await fetch(
        `/api/settlements/transactions?batchId=${encodeURIComponent(batchId)}&limit=100`
      );
      const j = await r.json();
      if (!r.ok) {
        setTxError(j.error || "Failed to load transactions");
        setTransactions([]);
      } else {
        setTransactions(Array.isArray(j.data) ? j.data : []);
      }
    } catch (e) {
      setTxError(e instanceof Error ? e.message : "Network error");
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

  function selectBatch(b: PayrocBatch) {
    setSelectedBatch(b);
    void loadTransactions(b.batchId);
  }

  function clearBatch() {
    setSelectedBatch(null);
    setTransactions([]);
    setTxError(null);
  }

  return (
    <div className="space-y-8">
      {!selectedBatch && (
        <div
          className="bg-white border border-[#E8EAED] rounded-xl overflow-hidden"
          style={{ boxShadow: SHADOW }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EAED]">
            <div>
              <h2 className="text-lg font-semibold text-[#1A1313]">
                Settlements
              </h2>
              <p className="text-sm text-[#878787] mt-0.5">
                Daily settlement batches from your payment processor.
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
                onClick={() => void loadBatches()}
                disabled={batchesLoading}
                className="inline-flex items-center gap-2 h-9 px-3 bg-white border border-[#D1D5DB] text-[#1A1313] rounded-lg text-[14px] font-medium hover:bg-[#F4F5F7] disabled:opacity-50 cursor-pointer transition-all"
              >
                <RefreshCw
                  size={14}
                  strokeWidth={1.5}
                  className={batchesLoading ? "animate-spin" : ""}
                />
                Refresh
              </button>
            </div>
          </div>

          {batchesError && (
            <div className="mx-6 my-4 p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[13px] text-[#DC2626]">
              {batchesError}
            </div>
          )}

          {batchesLoading ? (
            <div className="px-6 py-12 text-center text-sm text-[#878787]">
              Loading batches...
            </div>
          ) : batches.length === 0 && !batchesError ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#F4F5F7] flex items-center justify-center mb-4">
                <Wallet
                  size={24}
                  strokeWidth={1.5}
                  className="text-[#878787]"
                />
              </div>
              <h3 className="text-base font-semibold text-[#1A1313] mb-1">
                No batches for this date
              </h3>
              <p className="text-[13px] text-[#878787] max-w-sm">
                Settlement records will appear here once your processor closes
                daily batches.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E8EAED]">
                  {[
                    "Batch ID",
                    "Date",
                    "Closed",
                    "Transactions",
                    "Total",
                    "Status",
                  ].map((h) => (
                    <th
                      key={h}
                      className={`px-6 py-3 text-[10px] font-semibold uppercase tracking-wider text-[#878787] ${h === "Total" ? "text-right" : "text-left"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr
                    key={b.batchId}
                    onClick={() => selectBatch(b)}
                    className="border-b border-[#F4F5F7] hover:bg-[#F9FAFB] cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-3 text-[13px] text-[#1A1313] font-mono">
                      {b.batchId}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#1A1313]">
                      {b.date ?? "\u2014"}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#4A4A4A]">
                      {fmtDate(b.closedAt)}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#4A4A4A]">
                      {typeof b.transactionCount === "number"
                        ? b.transactionCount
                        : "\u2014"}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#1A1313] text-right font-medium">
                      {fmtMoney(b.totalAmount)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${statusPillClasses(b.status)}`}
                      >
                        {b.status ?? "unknown"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedBatch && (
        <div
          className="bg-white border border-[#E8EAED] rounded-xl overflow-hidden"
          style={{ boxShadow: SHADOW }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EAED]">
            <div className="flex items-center gap-3">
              <button
                onClick={clearBatch}
                className="inline-flex items-center gap-2 h-9 px-3 bg-white border border-[#D1D5DB] text-[#1A1313] rounded-lg text-[14px] font-medium hover:bg-[#F4F5F7] cursor-pointer transition-all"
              >
                <ArrowLeft size={14} strokeWidth={1.5} />
                All batches
              </button>
              <div>
                <h2 className="text-lg font-semibold text-[#1A1313]">
                  Batch {selectedBatch.batchId}
                </h2>
                <p className="text-sm text-[#878787] mt-0.5">
                  {selectedBatch.date ?? "Unknown date"} ·{" "}
                  {fmtMoney(selectedBatch.totalAmount)} total
                </p>
              </div>
            </div>
          </div>

          {txError && (
            <div className="mx-6 my-4 p-3 bg-[#FEF2F2] border border-[#FCA5A5] rounded-lg text-[13px] text-[#DC2626]">
              {txError}
            </div>
          )}

          {txLoading ? (
            <div className="px-6 py-12 text-center text-sm text-[#878787]">
              Loading transactions...
            </div>
          ) : transactions.length === 0 && !txError ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-[#F4F5F7] flex items-center justify-center mb-4">
                <Wallet
                  size={24}
                  strokeWidth={1.5}
                  className="text-[#878787]"
                />
              </div>
              <h3 className="text-base font-semibold text-[#1A1313] mb-1">
                No transactions in this batch
              </h3>
              <p className="text-[13px] text-[#878787] max-w-sm">
                Either no transactions match your filters or none belong to this
                account.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E8EAED]">
                  {[
                    "Transaction ID",
                    "Payment ID",
                    "Type",
                    "Card",
                    "Amount",
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
                {transactions.map((t) => (
                  <tr
                    key={t.transactionId}
                    className="border-b border-[#F4F5F7]"
                  >
                    <td className="px-6 py-3 text-[13px] text-[#1A1313] font-mono">
                      {t.transactionId}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#4A4A4A] font-mono">
                      {t.paymentId ?? "\u2014"}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#4A4A4A]">
                      {t.type ?? "\u2014"}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#4A4A4A]">
                      {t.cardScheme && t.last4
                        ? `${t.cardScheme} \u00B7\u00B7\u00B7\u00B7${t.last4}`
                        : "\u2014"}
                    </td>
                    <td className="px-6 py-3 text-[13px] text-[#1A1313] text-right font-medium">
                      {fmtMoney(t.amount)}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${statusPillClasses(t.status)}`}
                      >
                        {t.status ?? "unknown"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
