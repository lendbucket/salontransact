"use client";

import { useCallback, useEffect, useState } from "react";
import {
  RefreshCw,
  ArrowDownCircle,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Clock,
  CreditCard,
  Inbox,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PayrocRefundSummary { refundId: string; dateTime: string; amount: number; currency: string; status: string }
interface PayrocCard { type: string; cardNumber: string; expiryDate: string; cardholderName?: string }
interface PayrocOrder { orderId: string; amount: number; currency: string; dateTime: string; description?: string }
interface PayrocTransactionResult { status: string; type?: string; authorizedAmount?: number }
type SupportedOperation = "capture" | "refund" | "fullyReverse" | "partiallyReverse" | "incrementAuthorization" | "adjustTip" | "addSignature" | "setAsReady" | "setAsPending";
interface PayrocPayment { paymentId: string; processingTerminalId: string; order: PayrocOrder; card: PayrocCard; transactionResult: PayrocTransactionResult; supportedOperations?: SupportedOperation[]; refunds?: PayrocRefundSummary[] }
interface PayrocListResponse { limit: number; count: number; hasMore: boolean; data: PayrocPayment[] }
interface AuditRow { id: string; operation: "refund" | "reverse"; payrocPaymentId: string; payrocRefundId: string | null; amountCents: number; description: string | null; operatorEmail: string; status: "pending" | "success" | "failed"; payrocStatusCode: number | null; errorMessage: string | null; createdAt: string }
type Operation = "refund" | "reverse";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function fmt(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const SHADOW = "0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05), 0 16px 16px rgba(0,0,0,0.05)";

function refundedCents(p: PayrocPayment): number {
  return (p.refunds ?? []).reduce((s, r) => s + Math.abs(r.amount), 0);
}

function friendlyError(raw: string): string {
  const l = raw.toLowerCase();
  if (l.includes("refund amount exceeds")) return "The refund amount is more than what remains on this payment. Check the refund history and try a smaller amount.";
  if (l.includes("payment not found") || l.includes("not found")) return "We couldn't find that payment. Double-check the payment ID.";
  if (l.includes("search too broad")) return "Too many results. Please narrow your search.";
  if (l.includes("missing required field")) return "There was a problem with the request. Please try again, and contact support if it persists.";
  if (l.includes("batch") && l.includes("closed")) return "This payment has already settled. Try a refund instead of a reversal.";
  if (l.includes("network") || l.includes("timeout") || l.includes("econnrefused")) return "Couldn't reach the payment processor. Check your connection and try again.";
  return `Something went wrong: ${raw.slice(0, 200)}. Please try again or contact support.`;
}

function statusPillStyles(status: string): { bg: string; text: string; dot: string } {
  const s = status.toLowerCase().trim();
  if (["complete", "succeeded", "success", "approved", "captured"].includes(s)) return { bg: "#DCFCE7", text: "#15803D", dot: "#22c55e" };
  if (["pending", "processing"].includes(s)) return { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" };
  if (["failed", "declined", "error"].includes(s)) return { bg: "#FEF2F2", text: "#DC2626", dot: "#EF4444" };
  if (s === "refunded") return { bg: "#F4F5F7", text: "#4A4A4A", dot: "#878787" };
  return { bg: "#F4F5F7", text: "#4A4A4A", dot: "#878787" };
}

function StatusPill({ status }: { status: string }) {
  const c = statusPillStyles(status);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5" style={{ background: c.bg, color: c.text, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {status}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
  const [submitResult, setSubmitResult] = useState<{ ok: true; message: string } | { ok: false; message: string } | null>(null);

  // Confirmation modal state
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedCard, setSelectedCard] = useState<{ type: string; last4: string } | null>(null);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true); setPaymentsError(null);
    try {
      const res = await fetch("/api/refunds/recent-payments?limit=25", { cache: "no-store" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setPaymentsError(j.error || `HTTP ${res.status}`); return; }
      const j = (await res.json()) as PayrocListResponse;
      setPayments(j.data ?? []);
    } catch (e) { setPaymentsError((e as Error).message); }
    finally { setPaymentsLoading(false); }
  }, []);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true); setAuditError(null);
    try {
      const res = await fetch("/api/refunds/audit-log", { cache: "no-store" });
      if (!res.ok) { const j = await res.json().catch(() => ({})); setAuditError(j.error || `HTTP ${res.status}`); return; }
      const j = (await res.json()) as { rows: AuditRow[] };
      setAuditRows(j.rows ?? []);
    } catch (e) { setAuditError((e as Error).message); }
    finally { setAuditLoading(false); }
  }, []);

  useEffect(() => { void loadPayments(); void loadAudit(); }, [loadPayments, loadAudit]);

  const fillFromPayment = (p: PayrocPayment, op: Operation) => {
    const totalRefunded = refundedCents(p);
    const remainingCents = Math.max(0, p.order.amount - totalRefunded);
    setOperation(op);
    setPaymentId(p.paymentId);
    setAmount((op === "refund" ? remainingCents / 100 : p.order.amount / 100).toFixed(2));
    if (op === "refund") { setDescription(`Refund for ${p.order.orderId || p.paymentId}`.slice(0, 100)); }
    else { setDescription(""); setIsFullReverse(true); }
    setSelectedCard({ type: p.card.type, last4: p.card.cardNumber.slice(-4) });
    setSubmitResult(null);
    requestAnimationFrame(() => { document.getElementById("refund-form")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  };

  // Validate and open confirmation modal
  const handleSubmitClick = () => {
    setSubmitResult(null);
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (!paymentId.trim()) { setSubmitResult({ ok: false, message: "paymentId is required" }); return; }
    if (!Number.isFinite(amountCents) || amountCents <= 0) { setSubmitResult({ ok: false, message: "amount must be a positive number" }); return; }
    if (operation === "refund") {
      if (!description.trim()) { setSubmitResult({ ok: false, message: "description is required for refunds" }); return; }
      if (description.length > 100) { setSubmitResult({ ok: false, message: "description must be 100 characters or fewer" }); return; }
    }
    setShowConfirm(true);
  };

  // Actual submit after confirmation
  const confirmSubmit = async () => {
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const amountCents = Math.round(parseFloat(amount) * 100);
      const path = operation === "refund" ? "/api/refunds/refund" : "/api/refunds/reverse";
      const body = operation === "refund"
        ? { paymentId: paymentId.trim(), amountCents, description: description.trim() }
        : { paymentId: paymentId.trim(), amountCents, isFullReverse };
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { setSubmitResult({ ok: true, message: `${operation === "refund" ? "Refund" : "Reverse"} succeeded. Audit ID: ${j.refundOperationId}` }); }
      else { setSubmitResult({ ok: false, message: friendlyError(j.error || `Request failed: HTTP ${res.status}`) }); }
    } catch (e) { setSubmitResult({ ok: false, message: friendlyError((e as Error).message) }); }
    finally { setSubmitting(false); void loadAudit(); void loadPayments(); }
  };

  const SecBtn = ({ onClick, disabled, children, className = "" }: { onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) => (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-2 bg-white border border-[#D1D5DB] text-[#1A1313] text-sm font-medium rounded-lg h-9 px-3 hover:bg-[#F4F5F7] disabled:opacity-50 transition-all duration-150 cursor-pointer disabled:cursor-not-allowed ${className}`}
    >{children}</button>
  );

  return (
    <div className="space-y-8">
      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }} onClick={() => setShowConfirm(false)}>
          <div className="w-full max-w-[480px] bg-white rounded-2xl p-6" style={{ boxShadow: SHADOW }} onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[#1A1313] mb-4">
              Confirm {operation === "refund" ? "Refund" : "Reversal"}
            </h3>
            <div className="space-y-2 text-sm text-[#4A4A4A] mb-4">
              <p><span className="text-[#878787]">Payment:</span> <span className="font-mono">{paymentId}</span></p>
              <p><span className="text-[#878787]">Amount:</span> <span className="font-medium text-[#1A1313]">${parseFloat(amount).toFixed(2)}</span></p>
              {selectedCard ? (
                <p><span className="text-[#878787]">Card:</span> {selectedCard.type} ending in {selectedCard.last4}</p>
              ) : (
                <p><span className="text-[#878787]">Card:</span> not available</p>
              )}
              {operation === "refund" && description && (
                <p><span className="text-[#878787]">Reason:</span> {description}</p>
              )}
              {operation === "reverse" && isFullReverse && (
                <p><span className="text-[#878787]">Type:</span> Full reversal</p>
              )}
            </div>
            <div className="bg-[#FEF3C7] border border-[#FDE68A] rounded-lg p-3 mb-5">
              <p className="text-[13px] text-[#92400E] font-medium">This action cannot be undone.</p>
            </div>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setShowConfirm(false)} autoFocus
                className="h-9 px-4 text-sm font-medium bg-white border border-[#D1D5DB] text-[#1A1313] rounded-lg hover:bg-[#F4F5F7] cursor-pointer transition-all">
                Cancel
              </button>
              <button type="button" onClick={() => void confirmSubmit()} disabled={submitting}
                className="h-9 px-5 text-sm font-medium text-white rounded-lg border border-[#015f80] disabled:opacity-50 cursor-pointer transition-all"
                style={{ background: "linear-gradient(180deg, #0290be 0%, #017ea7 100%)", boxShadow: "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)" }}>
                {submitting ? "Processing\u2026" : `Confirm ${operation}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payments list */}
      <div className="bg-white border border-[#E8EAED] rounded-xl overflow-hidden" style={{ boxShadow: SHADOW }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EAED]">
          <div>
            <h2 className="text-base font-semibold text-[#1A1313]">Recent Payments</h2>
            <p className="text-[13px] text-[#878787] mt-0.5">Click Refund or Reverse to populate the form below.</p>
          </div>
          <SecBtn onClick={() => void loadPayments()} disabled={paymentsLoading}>
            <RefreshCw size={16} strokeWidth={1.5} className={paymentsLoading ? "animate-spin" : ""} /> Refresh
          </SecBtn>
        </div>

        {paymentsError ? (
          <div className="px-6 py-4 flex items-start gap-2 text-sm text-[#DC2626]">
            <AlertCircle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" /> {friendlyError(paymentsError)}
          </div>
        ) : payments.length === 0 && !paymentsLoading ? (
          <div className="py-16 px-6 flex flex-col items-center justify-center max-w-[400px] mx-auto text-center">
            <CreditCard size={48} strokeWidth={1} style={{ color: "#ABABAB" }} className="mb-4" />
            <p className="text-sm font-medium text-[#1A1313] mb-1">No payments in the last 30 days</p>
            <p className="text-[13px] text-[#878787]">When you process payments, they'll appear here for refund management.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F9FAFB]">
                  {["Payment ID", "Date", "Amount", "Refunded", "Card", "Status", ""].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#878787] border-b border-[#E8EAED]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map(p => {
                  const ops = p.supportedOperations || [];
                  const totalRefunded = refundedCents(p);
                  const fullyRefunded = totalRefunded >= p.order.amount;
                  const hasRefunds = totalRefunded > 0;
                  const canRefund = ops.includes("refund") && !fullyRefunded;
                  const canReverse = (ops.includes("fullyReverse") || ops.includes("partiallyReverse")) && !hasRefunds;
                  return (
                    <tr key={p.paymentId} className="border-b border-[#F4F5F7] hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-3 font-mono text-[12px] text-[#4A4A4A]">{p.paymentId}</td>
                      <td className="px-4 py-3 text-[#878787]">{fmtDate(p.order.dateTime)}</td>
                      <td className="px-4 py-3 font-medium text-[#1A1313]">{fmt(p.order.amount, p.order.currency)}</td>
                      <td className="px-4 py-3">
                        {totalRefunded === 0 ? (
                          <span className="text-[#878787]">{"\u2014"}</span>
                        ) : fullyRefunded ? (
                          <span className="text-[#4A4A4A]">{fmt(totalRefunded, p.order.currency)} <span className="text-[#878787]">(full)</span></span>
                        ) : (
                          <span className="text-[#1A1313]">{fmt(totalRefunded, p.order.currency)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#4A4A4A]">{p.card.type} ····{p.card.cardNumber.slice(-4)}</td>
                      <td className="px-4 py-3"><StatusPill status={p.transactionResult.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <button type="button" onClick={() => fillFromPayment(p, "refund")} disabled={!canRefund}
                            title={fullyRefunded ? "Already fully refunded" : undefined}
                            className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded-md border border-[#D1D5DB] bg-white hover:bg-[#F4F5F7] disabled:opacity-30 disabled:cursor-not-allowed text-[#1A1313] transition-all cursor-pointer">
                            <ArrowDownCircle size={14} strokeWidth={1.5} /> Refund
                          </button>
                          <button type="button" onClick={() => fillFromPayment(p, "reverse")} disabled={!canReverse}
                            title={hasRefunds ? "Cannot reverse after refund" : undefined}
                            className="inline-flex items-center gap-1 text-[12px] font-medium px-2 py-1 rounded-md border border-[#D1D5DB] bg-white hover:bg-[#F4F5F7] disabled:opacity-30 disabled:cursor-not-allowed text-[#1A1313] transition-all cursor-pointer">
                            <RotateCcw size={14} strokeWidth={1.5} /> Reverse
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
      </div>

      {/* Form */}
      <div id="refund-form" className="bg-white border border-[#E8EAED] rounded-xl overflow-hidden sticky top-4 z-10" style={{ boxShadow: SHADOW }}>
        <div className="px-6 py-4 border-b border-[#E8EAED]">
          <h2 className="text-base font-semibold text-[#1A1313]">Submit Refund or Reverse</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="flex gap-2">
            {(["refund", "reverse"] as Operation[]).map(op => (
              <button key={op} type="button" onClick={() => setOperation(op)}
                className={`h-9 px-4 text-sm font-medium rounded-lg border transition-all duration-150 cursor-pointer capitalize ${
                  operation === op ? "text-white border-[#015f80]" : "bg-white border-[#D1D5DB] text-[#1A1313] hover:bg-[#F4F5F7]"
                }`}
                style={operation === op ? { background: "linear-gradient(180deg, #0290be 0%, #017ea7 100%)", boxShadow: "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)" } : undefined}
              >{op}</button>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[13px] font-medium text-[#1A1313] mb-1.5">Payment ID</label>
              <input type="text" value={paymentId} onChange={e => setPaymentId(e.target.value)} placeholder="e.g. M2MJOG6O2Y"
                className="w-full h-10 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg px-3 text-[14px] text-[#1A1313] font-mono outline-none focus:border-[#017ea7] focus:bg-white focus:shadow-[0_0_0_3px_rgba(1,126,167,0.1)] transition-all" />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-[#1A1313] mb-1.5">
                Amount (USD){operation === "reverse" && isFullReverse ? " \u2014 ignored on full reverse" : ""}
              </label>
              <input type="number" step="0.01" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                className="w-full h-10 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg px-3 text-[14px] text-[#1A1313] outline-none focus:border-[#017ea7] focus:bg-white focus:shadow-[0_0_0_3px_rgba(1,126,167,0.1)] transition-all" />
            </div>
          </div>
          {operation === "refund" ? (
            <div>
              <label className="block text-[13px] font-medium text-[#1A1313] mb-1.5">Description ({description.length}/100)</label>
              <input type="text" value={description} onChange={e => setDescription(e.target.value.slice(0, 100))} placeholder="Reason for refund" maxLength={100}
                className="w-full h-10 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg px-3 text-[14px] text-[#1A1313] outline-none focus:border-[#017ea7] focus:bg-white focus:shadow-[0_0_0_3px_rgba(1,126,167,0.1)] transition-all" />
            </div>
          ) : (
            <label className="inline-flex items-center gap-2 text-sm text-[#1A1313] cursor-pointer">
              <input type="checkbox" checked={isFullReverse} onChange={e => setIsFullReverse(e.target.checked)} className="rounded accent-[#017ea7]" />
              Full reverse (omit amount)
            </label>
          )}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-[#878787]">{operation === "refund" ? "POST /api/refunds/refund" : "POST /api/refunds/reverse"}</span>
            <button type="button" onClick={handleSubmitClick} disabled={submitting}
              className="h-9 px-5 text-sm font-medium text-white rounded-lg border border-[#015f80] disabled:opacity-50 cursor-pointer hover:-translate-y-px active:translate-y-0 transition-all duration-150"
              style={{ background: "linear-gradient(180deg, #0290be 0%, #017ea7 100%)", boxShadow: "0 1px 2px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.12)" }}
            >{submitting ? "Submitting\u2026" : `Submit ${operation}`}</button>
          </div>
          {submitResult && (
            <div className={`flex items-start gap-2 text-sm rounded-lg p-3 border ${submitResult.ok ? "bg-[#DCFCE7] border-[#22c55e]/30 text-[#15803D]" : "bg-[#FEF2F2] border-[#FCA5A5] text-[#DC2626]"}`}>
              {submitResult.ok ? <CheckCircle2 size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" /> : <AlertCircle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" />}
              <span>{submitResult.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Audit log */}
      <div className="bg-white border border-[#E8EAED] rounded-xl overflow-hidden" style={{ boxShadow: SHADOW }}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8EAED]">
          <div>
            <h2 className="text-base font-semibold text-[#1A1313]">Audit Log</h2>
            <p className="text-[13px] text-[#878787] mt-0.5">Last 50 refund operations.</p>
          </div>
          <SecBtn onClick={() => void loadAudit()} disabled={auditLoading}>
            <RefreshCw size={16} strokeWidth={1.5} className={auditLoading ? "animate-spin" : ""} /> Refresh
          </SecBtn>
        </div>
        {auditError ? (
          <div className="px-6 py-4 flex items-start gap-2 text-sm text-[#DC2626]">
            <AlertCircle size={16} strokeWidth={1.5} className="mt-0.5 shrink-0" /> {friendlyError(auditError)}
          </div>
        ) : auditRows.length === 0 && !auditLoading ? (
          <div className="py-16 px-6 flex flex-col items-center justify-center max-w-[400px] mx-auto text-center">
            <ArrowDownCircle size={48} strokeWidth={1} style={{ color: "#ABABAB" }} className="mb-4" />
            <p className="text-sm font-medium text-[#1A1313] mb-1">No refunds yet</p>
            <p className="text-[13px] text-[#878787]">When you refund a payment, the operation will be recorded here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#F9FAFB]">
                  {["When", "Op", "Payment ID", "Amount", "Status", "Operator", "Detail"].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[#878787] border-b border-[#E8EAED]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {auditRows.map(r => (
                  <tr key={r.id} className="border-b border-[#F4F5F7] hover:bg-[#F9FAFB] transition-colors">
                    <td className="px-4 py-3 text-[#878787] whitespace-nowrap">{fmtDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-[#1A1313] capitalize">{r.operation}</td>
                    <td className="px-4 py-3 font-mono text-[12px] text-[#4A4A4A]">{r.payrocPaymentId}</td>
                    <td className="px-4 py-3 font-medium text-[#1A1313]">{fmt(r.amountCents)}</td>
                    <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-3 text-[11px] text-[#878787]">{r.operatorEmail}</td>
                    <td className="px-4 py-3 text-[12px] text-[#878787] max-w-xs truncate">{r.errorMessage || r.description || "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
