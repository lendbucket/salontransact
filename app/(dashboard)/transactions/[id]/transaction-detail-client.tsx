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
} from "lucide-react";
import { Card, CardSection } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Toast } from "@/components/ui/toast";
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

  function copyToClipboard(text: string, kind: string) {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(kind);
    setToast(`${kind} copied to clipboard`);
    setTimeout(() => setCopiedId(null), 1500);
    setTimeout(() => setToast(null), 2500);
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
