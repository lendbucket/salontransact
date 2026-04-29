"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CreditCard,
  User,
  Building2,
  FileText,
  Clock,
  Copy,
  Check,
  AlertCircle,
  Mail,
  Send,
  X,
} from "lucide-react";
import { Card, CardSection } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Toast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import type { TransactionDetail } from "@/app/master/transactions/_lib/transaction-types";

function fmtMoney(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    n
  );
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

interface Props {
  transaction: TransactionDetail;
  isMaster: boolean;
}

export function TransactionDetailClient({
  transaction: t,
  isMaster,
}: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [resendModalOpen, setResendModalOpen] = useState(false);
  const [resendEmail, setResendEmail] = useState(t.customerEmail ?? "");
  const [resendLoading, setResendLoading] = useState(false);

  function copyToClipboard(text: string, kind: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(kind);
    setToast(`${kind} copied to clipboard`);
    setTimeout(() => setCopiedId(null), 1500);
    setTimeout(() => setToast(null), 2500);
  }

  async function handleResendReceipt() {
    const trimmed = resendEmail.trim().toLowerCase();
    if (!trimmed.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setErrorToast("Please enter a valid email address");
      setTimeout(() => setErrorToast(null), 3000);
      return;
    }
    setResendLoading(true);
    try {
      const res = await fetch(`/api/transactions/${t.id}/receipt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorToast((data as { error?: string }).error ?? `Failed (${res.status})`);
        setTimeout(() => setErrorToast(null), 4000);
        return;
      }
      setToast(`Receipt sent to ${trimmed}`);
      setTimeout(() => setToast(null), 3500);
      setResendModalOpen(false);
    } catch (e) {
      setErrorToast(e instanceof Error ? e.message : "Failed to send receipt");
      setTimeout(() => setErrorToast(null), 4000);
    } finally {
      setResendLoading(false);
    }
  }

  const remainingAmount = Math.max(0, t.amount - t.refundAmount);

  return (
    <>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 80,
            right: 24,
            zIndex: 100,
            minWidth: 280,
          }}
        >
          <Toast kind="success" message={toast} />
        </div>
      )}

      {errorToast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind="error" message={errorToast} />
        </div>
      )}

      {/* Quick actions */}
      <div className="flex flex-col sm:flex-row" style={{ gap: 8, marginBottom: 24 }}>
        <Button
          variant="secondary"
          leadingIcon={<Mail size={14} />}
          onClick={() => { setResendEmail(t.customerEmail ?? ""); setResendModalOpen(true); }}
        >
          Resend Receipt
        </Button>
      </div>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              marginBottom: 6,
            }}
          >
            <h1
              style={{
                fontSize: 32,
                fontWeight: 600,
                color: "#1A1313",
                letterSpacing: "-0.31px",
              }}
            >
              {fmtMoney(t.amount, t.currency.toUpperCase())}
            </h1>
            <StatusPill status={t.refunded ? "refunded" : t.status} />
          </div>
          <p style={{ fontSize: 13, color: "#878787" }}>
            {t.description ?? "Payment"} &middot; {fmtDateTime(t.createdAt)}
          </p>
        </div>
      </div>

      {/* Master merchant callout */}
      {isMaster && (
        <Card
          style={{
            marginBottom: 16,
            background: "#E6F4F8",
            border: "1px solid #BAE6FD",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Building2 size={18} style={{ color: "#015f80" }} />
              <div>
                <p
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#015f80",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Merchant
                </p>
                <p
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#1A1313",
                  }}
                >
                  {t.merchantBusinessName}
                  {(t.merchantCity || t.merchantState) && (
                    <span
                      style={{
                        fontSize: 13,
                        color: "#878787",
                        fontWeight: 400,
                      }}
                    >
                      {" \u00B7 "}
                      {[t.merchantCity, t.merchantState]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  )}
                </p>
              </div>
            </div>
            <Link
              href={`/master/merchants/${t.merchantId}`}
              style={{ fontSize: 13, color: "#017ea7", fontWeight: 500 }}
            >
              View merchant &rarr;
            </Link>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CardSection
          icon={<CreditCard size={16} style={{ color: "#017ea7" }} />}
          title="Payment"
        >
          <Field
            label="Amount"
            value={fmtMoney(t.amount, t.currency.toUpperCase())}
            bold
          />
          <Field
            label="Fee"
            value={fmtMoney(t.fee, t.currency.toUpperCase())}
            muted
          />
          <Field
            label="Net"
            value={fmtMoney(t.net, t.currency.toUpperCase())}
            bold
          />
          {t.refunded && (
            <div
              style={{
                borderTop: "1px solid #F4F5F7",
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <Field
                label="Refunded"
                value={fmtMoney(t.refundAmount, t.currency.toUpperCase())}
                muted
              />
              <Field
                label="Remaining"
                value={fmtMoney(remainingAmount, t.currency.toUpperCase())}
                muted
              />
            </div>
          )}
          <Field label="Currency" value={t.currency.toUpperCase()} muted />
        </CardSection>

        <CardSection
          icon={<User size={16} style={{ color: "#017ea7" }} />}
          title="Customer"
        >
          {t.customerName || t.customerEmail ? (
            <>
              {t.customerName && (
                <Field label="Name" value={t.customerName} />
              )}
              {t.customerEmail && (
                <Field label="Email" value={t.customerEmail} />
              )}
            </>
          ) : (
            <p style={{ fontSize: 13, color: "#878787" }}>
              No customer info captured
            </p>
          )}
        </CardSection>

        <CardSection
          icon={<FileText size={16} style={{ color: "#017ea7" }} />}
          title="Identifiers"
        >
          <CopyableField
            label="Transaction ID"
            value={t.id}
            display={`${t.id.slice(0, 12)}\u2026`}
            copied={copiedId === "Transaction ID"}
            onCopy={() => copyToClipboard(t.id, "Transaction ID")}
          />
          {t.stripePaymentId && (
            <CopyableField
              label="Payment ID"
              value={t.stripePaymentId}
              display={`${t.stripePaymentId.slice(0, 12)}\u2026`}
              copied={copiedId === "Payment ID"}
              onCopy={() =>
                copyToClipboard(t.stripePaymentId!, "Payment ID")
              }
            />
          )}
        </CardSection>

        <CardSection
          icon={<Clock size={16} style={{ color: "#017ea7" }} />}
          title="Timeline"
        >
          <Field label="Created" value={fmtDateTime(t.createdAt)} />
          <Field label="Updated" value={fmtDateTime(t.updatedAt)} />
          <Field label="Status" value={t.status} />
          {t.refunded && <Field label="Refund Status" value="Refunded" />}
        </CardSection>

        {t.metadata && Object.keys(t.metadata).length > 0 && (
          <CardSection
            icon={<FileText size={16} style={{ color: "#017ea7" }} />}
            title="Metadata"
            className="md:col-span-2"
          >
            <pre
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                color: "#4A4A4A",
                background: "#F4F5F7",
                padding: 12,
                borderRadius: 8,
                overflow: "auto",
                maxHeight: 200,
              }}
            >
              {JSON.stringify(t.metadata, null, 2)}
            </pre>
          </CardSection>
        )}
      </div>

      {!t.refunded && t.status === "succeeded" && (
        <Card style={{ marginTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <AlertCircle size={16} style={{ color: "#92400E" }} />
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "#1A1313",
                }}
              >
                Need to refund this transaction?
              </p>
              <p style={{ fontSize: 13, color: "#878787" }}>
                Use the refunds tool to issue a partial or full refund.
              </p>
            </div>
            <Link
              href={isMaster ? "/master/refunds" : "/master/refunds"}
              style={{ fontSize: 13, color: "#017ea7", fontWeight: 500 }}
            >
              Open Refunds &rarr;
            </Link>
          </div>
        </Card>
      )}

      {resendModalOpen && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 12, WebkitOverflowScrolling: "touch" }}
          onClick={() => setResendModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#FFFFFF", borderRadius: 12, padding: 20, maxWidth: 480, width: "100%", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.1)", maxHeight: "calc(100vh - 24px)", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", margin: 0, marginBottom: 4, letterSpacing: "-0.31px" }}>
                  Resend Receipt
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: "#878787" }}>
                  Send a SalonTransact-branded receipt for this transaction.
                </p>
              </div>
              <button
                onClick={() => setResendModalOpen(false)}
                style={{ background: "transparent", border: "none", color: "#878787", cursor: "pointer", padding: 4, lineHeight: 0 }}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>
              Recipient email
            </label>
            <input
              type="email"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="customer@example.com"
              autoComplete="email"
              style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E8EAED", background: "#F4F5F7", fontSize: 14, color: "#1A1313", boxSizing: "border-box", marginBottom: 16, outline: "none" }}
            />

            <div className="flex flex-col-reverse sm:flex-row" style={{ gap: 8, justifyContent: "flex-end" }}>
              <Button variant="ghost" onClick={() => setResendModalOpen(false)} disabled={resendLoading}>
                Cancel
              </Button>
              <Button variant="primary" leadingIcon={<Send size={14} />} onClick={handleResendReceipt} loading={resendLoading}>
                Send Receipt
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#878787",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: bold ? 600 : 400,
          color: muted ? "#4A4A4A" : "#1A1313",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function CopyableField({
  label,
  value,
  display,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  display: string;
  copied: boolean;
  onCopy: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "#878787",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        {label}
      </span>
      <button
        onClick={onCopy}
        title={`Copy ${value}`}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 13,
          color: "#1A1313",
          fontFamily: "monospace",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {display}
        {copied ? (
          <Check size={12} style={{ color: "#15803D" }} />
        ) : (
          <Copy size={12} style={{ color: "#878787" }} />
        )}
      </button>
    </div>
  );
}
