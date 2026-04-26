"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  ArrowDownCircle,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";

interface PayrocCard {
  type: string;
  cardNumber: string;
  expiryDate: string;
  cardholderName?: string;
}

interface PayrocOrder {
  orderId: string;
  amount: number;
  currency: string;
  dateTime: string;
  description?: string;
}

interface PayrocTransactionResult {
  status: string;
  type?: string;
  authorizedAmount?: number;
}

type SupportedOperation =
  | "capture"
  | "refund"
  | "fullyReverse"
  | "partiallyReverse"
  | "incrementAuthorization"
  | "adjustTip"
  | "addSignature"
  | "setAsReady"
  | "setAsPending";

interface PayrocPayment {
  paymentId: string;
  processingTerminalId: string;
  order: PayrocOrder;
  card: PayrocCard;
  transactionResult: PayrocTransactionResult;
  supportedOperations?: SupportedOperation[];
}

interface PayrocListResponse {
  limit: number;
  count: number;
  hasMore: boolean;
  data: PayrocPayment[];
}

interface AuditRow {
  id: string;
  operation: "refund" | "reverse";
  payrocPaymentId: string;
  payrocRefundId: string | null;
  amountCents: number;
  description: string | null;
  operatorEmail: string;
  status: "pending" | "success" | "failed";
  payrocStatusCode: number | null;
  errorMessage: string | null;
  createdAt: string;
}

type Operation = "refund" | "reverse";

function formatCurrency(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function RefundsDebugClient() {
  const [payments, setPayments] = useState<PayrocPayment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  const [operation, setOperation] = useState<Operation>("refund");
  const [paymentId, setPaymentId] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [isFullReverse, setIsFullReverse] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<
    { ok: true; message: string } | { ok: false; message: string } | null
  >(null);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    setPaymentsError(null);
    try {
      const res = await fetch("/api/refunds/recent-payments?limit=25", {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setPaymentsError(j.error || `HTTP ${res.status}`);
        return;
      }
      const j = (await res.json()) as PayrocListResponse;
      setPayments(j.data ?? []);
    } catch (e) {
      setPaymentsError((e as Error).message);
    } finally {
      setPaymentsLoading(false);
    }
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    setAuditError(null);
    try {
      const res = await fetch("/api/refunds/audit-log", {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setAuditError(j.error || `HTTP ${res.status}`);
        return;
      }
      const j = (await res.json()) as { rows: AuditRow[] };
      setAuditRows(j.rows ?? []);
    } catch (e) {
      setAuditError((e as Error).message);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPayments();
    void loadAudit();
  }, [loadPayments, loadAudit]);

  const fillFromPayment = (p: PayrocPayment, op: Operation) => {
    setOperation(op);
    setPaymentId(p.paymentId);
    setAmount((p.order.amount / 100).toFixed(2));
    if (op === "refund") {
      setDescription(
        `Refund for ${p.order.orderId || p.paymentId}`.slice(0, 100)
      );
    } else {
      setDescription("");
      setIsFullReverse(true);
    }
    setSubmitResult(null);
    requestAnimationFrame(() => {
      document
        .getElementById("refund-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const submit = async () => {
    setSubmitResult(null);
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!paymentId.trim()) {
      setSubmitResult({ ok: false, message: "paymentId is required" });
      return;
    }
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      setSubmitResult({
        ok: false,
        message: "amount must be a positive number",
      });
      return;
    }
    if (operation === "refund") {
      if (!description.trim()) {
        setSubmitResult({
          ok: false,
          message: "description is required for refunds",
        });
        return;
      }
      if (description.length > 100) {
        setSubmitResult({
          ok: false,
          message: "description must be 100 characters or fewer",
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const path =
        operation === "refund"
          ? "/api/refunds/refund"
          : "/api/refunds/reverse";
      const body =
        operation === "refund"
          ? {
              paymentId: paymentId.trim(),
              amountCents,
              description: description.trim(),
            }
          : { paymentId: paymentId.trim(), amountCents, isFullReverse };

      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));

      if (res.ok) {
        setSubmitResult({
          ok: true,
          message: `${operation === "refund" ? "Refund" : "Reverse"} succeeded. Audit ID: ${j.refundOperationId}`,
        });
      } else {
        setSubmitResult({
          ok: false,
          message: j.error || `Request failed: HTTP ${res.status}`,
        });
      }
    } catch (e) {
      setSubmitResult({ ok: false, message: (e as Error).message });
    } finally {
      setSubmitting(false);
      void loadAudit();
      void loadPayments();
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Refunds &amp; Reversals — Diagnostic
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          Master portal only. Operations are logged to the RefundOperation
          audit table.
        </p>
      </header>

      {/* Payments list */}
      <section className="bg-[#0d1117] rounded-lg border border-white/[0.06]">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-base font-medium">
              Recent Payroc payments
            </h2>
            <p className="text-xs text-gray-500">
              Click a row to populate the form below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadPayments()}
            disabled={paymentsLoading}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded border border-white/[0.06] hover:bg-white/[0.04] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              strokeWidth={1.5}
              className={paymentsLoading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {paymentsError ? (
          <div className="p-4 text-sm text-red-400 flex items-start gap-2">
            <AlertCircle
              size={16}
              strokeWidth={1.5}
              className="mt-0.5 shrink-0"
            />
            <span>{paymentsError}</span>
          </div>
        ) : payments.length === 0 && !paymentsLoading ? (
          <div className="p-4 text-sm text-gray-500">
            No payments returned.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">
                    Payment ID
                  </th>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="text-left px-4 py-2 font-medium">
                    Amount
                  </th>
                  <th className="text-left px-4 py-2 font-medium">Card</th>
                  <th className="text-left px-4 py-2 font-medium">
                    Status
                  </th>
                  <th className="text-left px-4 py-2 font-medium">
                    Operations
                  </th>
                  <th className="text-right px-4 py-2 font-medium">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => {
                  const supported = p.supportedOperations || [];
                  const canRefund = supported.includes("refund");
                  const canReverse =
                    supported.includes("fullyReverse") ||
                    supported.includes("partiallyReverse");
                  return (
                    <tr
                      key={p.paymentId}
                      className="border-t border-white/[0.04] hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3 font-mono text-xs">
                        {p.paymentId}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {formatDate(p.order.dateTime)}
                      </td>
                      <td className="px-4 py-3">
                        {formatCurrency(p.order.amount, p.order.currency)}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {p.card.type} {p.card.cardNumber.slice(-4)}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {p.transactionResult.status}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {supported.join(", ") || "\u2014"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => fillFromPayment(p, "refund")}
                            disabled={!canRefund}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-white/[0.06] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowDownCircle size={14} strokeWidth={1.5} />
                            Refund
                          </button>
                          <button
                            type="button"
                            onClick={() => fillFromPayment(p, "reverse")}
                            disabled={!canReverse}
                            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-white/[0.06] hover:bg-white/[0.04] disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <RotateCcw size={14} strokeWidth={1.5} />
                            Reverse
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Form */}
      <section
        id="refund-form"
        className="bg-[#0d1117] rounded-lg border border-white/[0.06] sticky top-4 z-10"
      >
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="text-base font-medium">
            Submit refund or reverse
          </h2>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOperation("refund")}
              className={`px-3 py-1.5 text-sm rounded border ${
                operation === "refund"
                  ? "bg-[#7a8f96] text-[#06080d] border-[#7a8f96]"
                  : "border-white/[0.06] hover:bg-white/[0.04]"
              }`}
            >
              Refund
            </button>
            <button
              type="button"
              onClick={() => setOperation("reverse")}
              className={`px-3 py-1.5 text-sm rounded border ${
                operation === "reverse"
                  ? "bg-[#7a8f96] text-[#06080d] border-[#7a8f96]"
                  : "border-white/[0.06] hover:bg-white/[0.04]"
              }`}
            >
              Reverse
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Payment ID
              </label>
              <input
                type="text"
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                className="w-full px-3 py-2 bg-[#06080d] border border-white/[0.06] rounded text-sm font-mono"
                placeholder="e.g. M2MJOG6O2Y"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Amount (USD)
                {operation === "reverse" && isFullReverse
                  ? " — ignored on full reverse"
                  : ""}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 bg-[#06080d] border border-white/[0.06] rounded text-sm"
                placeholder="0.00"
              />
            </div>
          </div>

          {operation === "refund" ? (
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Description ({description.length}/100)
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) =>
                  setDescription(e.target.value.slice(0, 100))
                }
                className="w-full px-3 py-2 bg-[#06080d] border border-white/[0.06] rounded text-sm"
                placeholder="Reason for refund"
                maxLength={100}
              />
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isFullReverse}
                onChange={(e) => setIsFullReverse(e.target.checked)}
                className="rounded"
              />
              <span>Full reverse (omit amount)</span>
            </label>
          )}

          <div className="flex items-center justify-between pt-2">
            <div className="text-xs text-gray-500">
              {operation === "refund"
                ? "POST /api/refunds/refund"
                : "POST /api/refunds/reverse"}
            </div>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={submitting}
              className="px-4 py-2 text-sm rounded bg-[#7a8f96] text-[#06080d] font-medium hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? "Submitting\u2026" : `Submit ${operation}`}
            </button>
          </div>

          {submitResult && (
            <div
              className={`flex items-start gap-2 text-sm rounded p-3 ${
                submitResult.ok
                  ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                  : "bg-red-500/10 text-red-300 border border-red-500/20"
              }`}
            >
              {submitResult.ok ? (
                <CheckCircle2
                  size={16}
                  strokeWidth={1.5}
                  className="mt-0.5 shrink-0"
                />
              ) : (
                <AlertCircle
                  size={16}
                  strokeWidth={1.5}
                  className="mt-0.5 shrink-0"
                />
              )}
              <span>{submitResult.message}</span>
            </div>
          )}
        </div>
      </section>

      {/* Audit log */}
      <section className="bg-[#0d1117] rounded-lg border border-white/[0.06]">
        <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
          <div>
            <h2 className="text-base font-medium">Audit log</h2>
            <p className="text-xs text-gray-500">
              Last 50 RefundOperation rows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadAudit()}
            disabled={auditLoading}
            className="inline-flex items-center gap-2 text-sm px-3 py-1.5 rounded border border-white/[0.06] hover:bg-white/[0.04] disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              strokeWidth={1.5}
              className={auditLoading ? "animate-spin" : ""}
            />
            Refresh
          </button>
        </div>

        {auditError ? (
          <div className="p-4 text-sm text-red-400 flex items-start gap-2">
            <AlertCircle
              size={16}
              strokeWidth={1.5}
              className="mt-0.5 shrink-0"
            />
            <span>{auditError}</span>
          </div>
        ) : auditRows.length === 0 && !auditLoading ? (
          <div className="p-4 text-sm text-gray-500">
            No operations yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2 font-medium">When</th>
                  <th className="text-left px-4 py-2 font-medium">Op</th>
                  <th className="text-left px-4 py-2 font-medium">
                    Payment ID
                  </th>
                  <th className="text-left px-4 py-2 font-medium">
                    Amount
                  </th>
                  <th className="text-left px-4 py-2 font-medium">
                    Status
                  </th>
                  <th className="text-left px-4 py-2 font-medium">
                    Operator
                  </th>
                  <th className="text-left px-4 py-2 font-medium">
                    Detail
                  </th>
                </tr>
              </thead>
              <tbody>
                {auditRows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-white/[0.04]"
                  >
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                      {formatDate(r.createdAt)}
                    </td>
                    <td className="px-4 py-3">{r.operation}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.payrocPaymentId}
                    </td>
                    <td className="px-4 py-3">
                      {formatCurrency(r.amountCents)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {r.status === "success" && (
                          <CheckCircle2
                            size={14}
                            strokeWidth={1.5}
                            className="text-emerald-400"
                          />
                        )}
                        {r.status === "failed" && (
                          <AlertCircle
                            size={14}
                            strokeWidth={1.5}
                            className="text-red-400"
                          />
                        )}
                        {r.status === "pending" && (
                          <Clock
                            size={14}
                            strokeWidth={1.5}
                            className="text-gray-400"
                          />
                        )}
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {r.operatorEmail}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-md truncate">
                      {r.errorMessage || r.description || "\u2014"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
