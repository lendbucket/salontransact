"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  ChevronLeft,
  Pause,
  Play,
  X,
  Zap,
  CreditCard,
  User,
  Repeat,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";

// ─────────────────────────────────────────────────────────────────
// Types — mirrors the GET /api/subscriptions/[id] response shape
// ─────────────────────────────────────────────────────────────────

interface SubscriptionDetail {
  id: string;
  merchantId: string;
  planId: string;
  customerId: string;
  savedCardId: string;
  status: string;
  anchorDay: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextBillingDate: string | null;
  trialEnd: string | null;
  cancelAt: string | null;
  canceledAt: string | null;
  cancellationReason: string | null;
  failedPaymentCount: number;
  lastFailureAt: string | null;
  firstPaymentId: string | null;
  source: string;
  mandateAcceptedAt: string;
  mandateText: string;
  createdAt: string;
  plan: {
    id: string;
    name: string;
    amountCents: number;
    interval: string;
    intervalCount: number;
  };
  savedCard: {
    id: string;
    last4: string | null;
    cardScheme: string | null;
    expiryMonth: string | null;
    expiryYear: string | null;
  };
  customer: {
    id: string;
    name: string | null;
    email: string;
  };
  currentInvoice: {
    id: string;
    periodStart: string;
    periodEnd: string;
    subtotalCents: number;
    taxCents: number;
    totalCents: number;
    status: string;
    attemptCount: number;
    failureReason: string | null;
    createdAt: string;
  } | null;
  recentEvents: Array<{
    id: string;
    eventType: string;
    actor: string;
    payload: unknown;
    createdAt: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function fmtInterval(plan: SubscriptionDetail["plan"]): string {
  const unit = plan.interval === "MONTHLY" ? "month" : plan.interval === "WEEKLY" ? "week" : "year";
  return plan.intervalCount === 1 ? `every ${unit}` : `every ${plan.intervalCount} ${unit}s`;
}

function statusBadgeStyle(status: string): { background: string; color: string } {
  switch (status) {
    case "active":
      return { background: "#E6F4EA", color: "#1E8E3E" };
    case "trialing":
      return { background: "#E8F0FE", color: "#1A73E8" };
    case "past_due":
      return { background: "#FCE8E6", color: "#C5221F" };
    case "paused":
      return { background: "#FEF7E0", color: "#B06000" };
    case "canceled":
    case "incomplete_expired":
      return { background: "#F4F5F7", color: "#878787" };
    case "incomplete":
      return { background: "#FEF7E0", color: "#B06000" };
    default:
      return { background: "#F4F5F7", color: "#4A4A4A" };
  }
}

// Which actions are available given the current status?
function availableActions(status: string): {
  canPause: boolean;
  canResume: boolean;
  canCancel: boolean;
} {
  return {
    canPause: status === "active" || status === "past_due",
    canResume: status === "paused",
    canCancel:
      status === "incomplete" ||
      status === "trialing" ||
      status === "active" ||
      status === "past_due" ||
      status === "paused",
  };
}

// ─────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────

interface Props {
  subscriptionId: string;
}

export function SubscriptionDetailClient({ subscriptionId }: Props) {
  const [detail, setDetail] = useState<SubscriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelMode, setCancelMode] = useState<"end_of_period" | "immediate">("end_of_period");
  const [cancelReason, setCancelReason] = useState("");

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/subscriptions/${subscriptionId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Load failed (${res.status})`);
        setDetail(null);
        return;
      }
      const json = (await res.json()) as { subscription: SubscriptionDetail };
      setDetail(json.subscription);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Load failed");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [subscriptionId, showToast]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ─── PATCH actions: pause / resume / cancel ──────────────────
  const doPatch = useCallback(
    async (body: Record<string, unknown>, actionLabel: string) => {
      setActionInFlight(actionLabel);
      try {
        const res = await fetch(`/api/subscriptions/${subscriptionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          showToast("error", (j as { error?: string }).error ?? `${actionLabel} failed (${res.status})`);
          return false;
        }
        showToast("success", `${actionLabel} successful`);
        await fetchDetail();
        return true;
      } catch (e) {
        showToast("error", e instanceof Error ? e.message : `${actionLabel} failed`);
        return false;
      } finally {
        setActionInFlight(null);
      }
    },
    [subscriptionId, showToast, fetchDetail]
  );

  // ─── Charge Now ───────────────────────────────────────────────
  const doChargeNow = useCallback(async () => {
    if (!detail || !detail.currentInvoice) return;

    const confirmed = confirm(
      `Charge ${fmtMoney(detail.currentInvoice.totalCents)} to card ending in ${detail.savedCard.last4 ?? "????"} now?`
    );
    if (!confirmed) return;

    setActionInFlight("Charge");
    try {
      const res = await fetch(`/api/subscriptions/${subscriptionId}/charge-now`, {
        method: "POST",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Charge failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as {
        result: { success: boolean; approvalCode?: string; declineReason?: string; error?: string };
      };
      if (json.result.success) {
        showToast("success", `Charge approved (${json.result.approvalCode ?? "no code"})`);
      } else {
        showToast("error", json.result.declineReason ?? json.result.error ?? "Charge declined");
      }
      await fetchDetail();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Charge failed");
    } finally {
      setActionInFlight(null);
    }
  }, [subscriptionId, detail, showToast, fetchDetail]);

  // ─── Cancel modal submit ───────────────────────────────────────
  const doCancel = useCallback(async () => {
    if (!detail) return;

    const body: Record<string, unknown> = { action: "cancel" };
    if (cancelMode === "end_of_period") {
      body.cancelAt = detail.currentPeriodEnd;
    }
    if (cancelReason.trim().length > 0) {
      body.reason = cancelReason.trim().slice(0, 500);
    }

    const success = await doPatch(body, cancelMode === "end_of_period" ? "Scheduled cancellation" : "Cancellation");
    if (success) {
      setCancelModalOpen(false);
      setCancelReason("");
      setCancelMode("end_of_period");
    }
  }, [detail, cancelMode, cancelReason, doPatch]);

  // ─── Loading state ────────────────────────────────────────────
  if (loading) {
    return (
      <Card padding={32}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#878787", gap: 8 }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: 13 }}>Loading subscription…</span>
        </div>
      </Card>
    );
  }

  if (!detail) {
    return (
      <Card padding={48}>
        <div style={{ textAlign: "center" }}>
          <AlertCircle size={32} strokeWidth={1.5} color="#C5221F" style={{ margin: "0 auto 12px" }} />
          <p style={{ fontSize: 15, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>
            Subscription not found
          </p>
          <p style={{ fontSize: 13, color: "#878787", marginBottom: 16 }}>
            It may have been deleted or you don&apos;t have access.
          </p>
          <Link
            href="/subscriptions/all"
            style={{ fontSize: 13, color: "#017ea7", textDecoration: "none", fontWeight: 500 }}
          >
            ← Back to subscriptions
          </Link>
        </div>
      </Card>
    );
  }

  const actions = availableActions(detail.status);
  const sty = statusBadgeStyle(detail.status);
  const cardLabel = detail.savedCard.last4
    ? `${detail.savedCard.cardScheme ?? "Card"} •••• ${detail.savedCard.last4}`
    : "Card on file";

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      {/* Back link */}
      <Link
        href="/subscriptions/all"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 13,
          color: "#878787",
          textDecoration: "none",
          marginBottom: 12,
        }}
      >
        <ChevronLeft size={14} />
        All subscriptions
      </Link>

      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: "#1A1313", margin: 0 }}>
              {detail.plan.name}
            </h2>
            <span
              style={{
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 600,
                background: sty.background,
                color: sty.color,
                borderRadius: 4,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {detail.status}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#878787" }}>
            {fmtMoney(detail.plan.amountCents)} {fmtInterval(detail.plan)} · Created {fmtDate(detail.createdAt)}
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {detail.currentInvoice && (
            <button
              onClick={doChargeNow}
              disabled={actionInFlight !== null}
              style={actionButtonStyle("primary", actionInFlight !== null)}
            >
              <Zap size={14} />
              {actionInFlight === "Charge" ? "Charging…" : "Charge Now"}
            </button>
          )}
          {actions.canPause && (
            <button
              onClick={() => doPatch({ action: "pause" }, "Pause")}
              disabled={actionInFlight !== null}
              style={actionButtonStyle("neutral", actionInFlight !== null)}
            >
              <Pause size={14} />
              {actionInFlight === "Pause" ? "Pausing…" : "Pause"}
            </button>
          )}
          {actions.canResume && (
            <button
              onClick={() => doPatch({ action: "resume" }, "Resume")}
              disabled={actionInFlight !== null}
              style={actionButtonStyle("primary", actionInFlight !== null)}
            >
              <Play size={14} />
              {actionInFlight === "Resume" ? "Resuming…" : "Resume"}
            </button>
          )}
          {actions.canCancel && (
            <button
              onClick={() => setCancelModalOpen(true)}
              disabled={actionInFlight !== null}
              style={actionButtonStyle("danger", actionInFlight !== null)}
            >
              <X size={14} />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Scheduled-cancel notice */}
      {detail.cancelAt && !detail.canceledAt && (
        <Card padding={16}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <AlertCircle size={18} color="#B06000" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 13, color: "#1A1313" }}>
              <strong>Scheduled to cancel on {fmtDate(detail.cancelAt)}.</strong>
              <div style={{ fontSize: 12, color: "#878787", marginTop: 2 }}>
                The subscription will remain active until then, then transition to canceled.
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Past-due notice */}
      {detail.failedPaymentCount > 0 && detail.status === "past_due" && (
        <div style={{ marginTop: detail.cancelAt && !detail.canceledAt ? 12 : 0 }}>
          <Card padding={16}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <AlertCircle size={18} color="#C5221F" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: "#1A1313" }}>
                <strong>{detail.failedPaymentCount} failed payment attempt{detail.failedPaymentCount === 1 ? "" : "s"}.</strong>
                {detail.lastFailureAt && (
                  <div style={{ fontSize: 12, color: "#878787", marginTop: 2 }}>
                    Last attempt: {fmtDateTime(detail.lastFailureAt)}
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Detail grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 16,
          marginTop: detail.cancelAt || detail.failedPaymentCount > 0 ? 16 : 0,
        }}
      >
        {/* Customer */}
        <Card padding={16}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <User size={12} />
            Customer
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#1A1313", marginBottom: 2 }}>
            {detail.customer.name ?? detail.customer.email}
          </div>
          {detail.customer.name && (
            <div style={{ fontSize: 12, color: "#878787" }}>{detail.customer.email}</div>
          )}
        </Card>

        {/* Payment Method */}
        <Card padding={16}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <CreditCard size={12} />
            Payment Method
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "#1A1313", marginBottom: 2 }}>{cardLabel}</div>
          {detail.savedCard.expiryMonth && detail.savedCard.expiryYear && (
            <div style={{ fontSize: 12, color: "#878787" }}>
              Expires {detail.savedCard.expiryMonth}/{detail.savedCard.expiryYear.slice(-2)}
            </div>
          )}
        </Card>

        {/* Billing schedule */}
        <Card padding={16}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            <Calendar size={12} />
            Billing Schedule
          </div>
          <div style={{ fontSize: 13, color: "#1A1313", marginBottom: 4 }}>
            <span style={{ color: "#878787" }}>Next billing:</span> {fmtDate(detail.nextBillingDate)}
          </div>
          <div style={{ fontSize: 13, color: "#1A1313", marginBottom: 4 }}>
            <span style={{ color: "#878787" }}>Current period:</span> {fmtDate(detail.currentPeriodStart)} – {fmtDate(detail.currentPeriodEnd)}
          </div>
          {detail.trialEnd && (
            <div style={{ fontSize: 13, color: "#1A1313" }}>
              <span style={{ color: "#878787" }}>Trial ends:</span> {fmtDate(detail.trialEnd)}
            </div>
          )}
          <div style={{ fontSize: 13, color: "#1A1313", marginTop: 4 }}>
            <span style={{ color: "#878787" }}>Anchor day:</span> {detail.anchorDay}
          </div>
        </Card>
      </div>

      {/* Current invoice */}
      {detail.currentInvoice && (
        <div style={{ marginTop: 16 }}>
          <Card padding={16}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              <Repeat size={12} />
              Current Open Invoice
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, fontSize: 13 }}>
              <div>
                <div style={{ color: "#878787", fontSize: 11, marginBottom: 2 }}>Status</div>
                <div style={{ color: "#1A1313", fontWeight: 500 }}>{detail.currentInvoice.status}</div>
              </div>
              <div>
                <div style={{ color: "#878787", fontSize: 11, marginBottom: 2 }}>Period</div>
                <div style={{ color: "#1A1313" }}>
                  {fmtDate(detail.currentInvoice.periodStart)} – {fmtDate(detail.currentInvoice.periodEnd)}
                </div>
              </div>
              <div>
                <div style={{ color: "#878787", fontSize: 11, marginBottom: 2 }}>Subtotal</div>
                <div style={{ color: "#1A1313" }}>{fmtMoney(detail.currentInvoice.subtotalCents)}</div>
              </div>
              <div>
                <div style={{ color: "#878787", fontSize: 11, marginBottom: 2 }}>Tax</div>
                <div style={{ color: "#1A1313" }}>{fmtMoney(detail.currentInvoice.taxCents)}</div>
              </div>
              <div>
                <div style={{ color: "#878787", fontSize: 11, marginBottom: 2 }}>Total</div>
                <div style={{ color: "#1A1313", fontWeight: 600 }}>{fmtMoney(detail.currentInvoice.totalCents)}</div>
              </div>
              <div>
                <div style={{ color: "#878787", fontSize: 11, marginBottom: 2 }}>Attempts</div>
                <div style={{ color: "#1A1313" }}>{detail.currentInvoice.attemptCount}</div>
              </div>
            </div>
            {detail.currentInvoice.failureReason && (
              <div style={{ marginTop: 12, padding: 10, background: "#FCE8E6", borderRadius: 6, fontSize: 12, color: "#C5221F" }}>
                <strong>Last failure:</strong> {detail.currentInvoice.failureReason}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Recent events */}
      {detail.recentEvents.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Card padding={16}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
              Recent Events
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {detail.recentEvents.map((event) => (
                <div key={event.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "6px 0", borderBottom: "1px solid #F4F5F7" }}>
                  <div>
                    <div style={{ color: "#1A1313", fontWeight: 500 }}>{event.eventType}</div>
                    <div style={{ color: "#878787", fontSize: 11, marginTop: 1 }}>by {event.actor}</div>
                  </div>
                  <div style={{ color: "#878787", textAlign: "right" }}>{fmtDateTime(event.createdAt)}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Cancel modal */}
      {cancelModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 16,
          }}
          onClick={() => actionInFlight === null && setCancelModalOpen(false)}
        >
          <div
            style={{
              background: "white",
              borderRadius: 8,
              padding: 24,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", margin: 0, marginBottom: 12 }}>
              Cancel subscription
            </h3>
            <p style={{ fontSize: 13, color: "#4A4A4A", marginBottom: 16 }}>
              Choose when this subscription should end:
            </p>

            <label style={{ display: "block", padding: 12, border: cancelMode === "end_of_period" ? "2px solid #017ea7" : "1px solid #E8EAED", borderRadius: 6, cursor: "pointer", marginBottom: 8 }}>
              <input
                type="radio"
                name="cancelMode"
                checked={cancelMode === "end_of_period"}
                onChange={() => setCancelMode("end_of_period")}
                style={{ marginRight: 8 }}
              />
              <strong style={{ fontSize: 13, color: "#1A1313" }}>Cancel at end of current period (recommended)</strong>
              <div style={{ fontSize: 12, color: "#878787", marginTop: 4, marginLeft: 22 }}>
                Customer keeps access until {fmtDate(detail.currentPeriodEnd)}. No more charges after that.
              </div>
            </label>

            <label style={{ display: "block", padding: 12, border: cancelMode === "immediate" ? "2px solid #C5221F" : "1px solid #E8EAED", borderRadius: 6, cursor: "pointer", marginBottom: 16 }}>
              <input
                type="radio"
                name="cancelMode"
                checked={cancelMode === "immediate"}
                onChange={() => setCancelMode("immediate")}
                style={{ marginRight: 8 }}
              />
              <strong style={{ fontSize: 13, color: "#1A1313" }}>Cancel immediately</strong>
              <div style={{ fontSize: 12, color: "#878787", marginTop: 4, marginLeft: 22 }}>
                Subscription ends right now. No more charges.
              </div>
            </label>

            <label style={{ display: "block", marginBottom: 16 }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 500, color: "#4A4A4A", marginBottom: 4 }}>
                Reason (optional, max 500 chars)
              </span>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value.slice(0, 500))}
                rows={2}
                style={{
                  width: "100%",
                  padding: 8,
                  fontSize: 13,
                  border: "1px solid #E8EAED",
                  borderRadius: 6,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
                placeholder="e.g. Customer requested cancellation"
              />
            </label>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                onClick={() => setCancelModalOpen(false)}
                disabled={actionInFlight !== null}
                style={actionButtonStyle("neutral", actionInFlight !== null)}
              >
                Never mind
              </button>
              <button
                onClick={doCancel}
                disabled={actionInFlight !== null}
                style={actionButtonStyle("danger", actionInFlight !== null)}
              >
                {actionInFlight !== null ? "Submitting…" : cancelMode === "end_of_period" ? "Schedule cancellation" : "Cancel now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// Button styles
// ─────────────────────────────────────────────────────────────────

function actionButtonStyle(
  kind: "primary" | "neutral" | "danger",
  disabled: boolean
): React.CSSProperties {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    fontSize: 13,
    fontWeight: 500,
    border: "1px solid",
    borderRadius: 6,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    whiteSpace: "nowrap",
  };

  if (kind === "primary") {
    return { ...base, background: "#017ea7", color: "white", borderColor: "#017ea7" };
  }
  if (kind === "danger") {
    return { ...base, background: "white", color: "#C5221F", borderColor: "#FCE8E6" };
  }
  return { ...base, background: "white", color: "#4A4A4A", borderColor: "#E8EAED" };
}
