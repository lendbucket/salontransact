"use client";

import { useState } from "react";
import {
  Building2,
  CreditCard,
  Banknote,
  User,
  ShieldCheck,
  ShieldOff,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import type { MerchantDetail } from "../_lib/merchant-types";

const SHADOW =
  "0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05), 0 16px 16px rgba(0,0,0,0.05)";

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function statusPillStyles(status: string): {
  bg: string;
  text: string;
  dot: string;
} {
  const s = status.toLowerCase();
  if (s === "active")
    return { bg: "#DCFCE7", text: "#15803D", dot: "#22c55e" };
  if (s === "pending")
    return { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" };
  if (s === "suspended")
    return { bg: "#FEE2E2", text: "#991B1B", dot: "#ef4444" };
  return { bg: "#E8EAED", text: "#4A4A4A", dot: "#878787" };
}

function maskAccount(s: string | null): string {
  if (!s) return "\u2014";
  if (s.length <= 4) return s;
  return `\u2022\u2022\u2022\u2022${s.slice(-4)}`;
}

interface Props {
  merchant: MerchantDetail;
  counts: {
    transactions: number;
    payouts: number;
    devices: number;
    savedCards: number;
  };
}

export function MerchantDetailClient({ merchant, counts }: Props) {
  const [status, setStatus] = useState(merchant.status);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const pill = statusPillStyles(status);
  const ownerName =
    [merchant.ownerFirstName, merchant.ownerLastName]
      .filter(Boolean)
      .join(" ") || "\u2014";

  async function changeStatus(next: "active" | "suspended") {
    if (updating) return;
    if (
      next === "suspended" &&
      !confirm(
        `Suspend ${merchant.businessName}? They will not be able to process payments. You can reactivate later.`
      )
    )
      return;

    setUpdating(true);
    setToast(null);
    try {
      const res = await fetch(`/api/master/merchants/${merchant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Update failed (${res.status})`);
      }
      const j = await res.json();
      setStatus(j.status);
      setToast({
        kind: "success",
        message: `Merchant ${next === "active" ? "reactivated" : "suspended"}.`,
      });
    } catch (e) {
      setToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Update failed",
      });
    } finally {
      setUpdating(false);
      setTimeout(() => setToast(null), 4000);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-semibold text-[#1A1313]">
              {merchant.businessName}
            </h1>
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: pill.bg, color: pill.text }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: pill.dot }}
              />
              {status}
            </span>
          </div>
          <p className="text-sm text-[#878787]">
            {merchant.dbaName ? `dba ${merchant.dbaName} \u00B7 ` : ""}
            ID: <span className="font-mono">{merchant.id}</span>
          </p>
        </div>

        <div className="flex gap-2">
          {status !== "suspended" ? (
            <button
              onClick={() => changeStatus("suspended")}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-3 h-9 bg-white text-[#991B1B] text-sm font-medium rounded-lg border border-[#FECACA] hover:bg-[#FEF2F2] transition-all duration-150 cursor-pointer disabled:opacity-50"
            >
              {updating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ShieldOff size={14} />
              )}
              Suspend
            </button>
          ) : (
            <button
              onClick={() => changeStatus("active")}
              disabled={updating}
              className="inline-flex items-center gap-1.5 px-3 h-9 bg-[#017ea7] text-white text-sm font-medium rounded-lg hover:bg-[#0290be] transition-all duration-150 cursor-pointer disabled:opacity-50"
            >
              {updating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <ShieldCheck size={14} />
              )}
              Reactivate
            </button>
          )}
        </div>
      </div>

      {toast && (
        <div
          className="mb-4 px-4 py-3 rounded-lg flex items-center gap-2 text-sm"
          style={{
            background: toast.kind === "success" ? "#DCFCE7" : "#FEE2E2",
            color: toast.kind === "success" ? "#15803D" : "#991B1B",
          }}
        >
          {toast.kind === "success" ? (
            <CheckCircle2 size={16} />
          ) : (
            <XCircle size={16} />
          )}
          {toast.message}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatTile label="Total Volume" value={fmtMoney(merchant.totalVolume)} />
        <StatTile
          label="Transactions"
          value={merchant.totalTransactions.toLocaleString()}
        />
        <StatTile label="Devices" value={counts.devices.toString()} />
        <StatTile label="Saved Cards" value={counts.savedCards.toString()} />
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section icon={Building2} title="Business">
          <Field label="Legal Name" value={merchant.businessName} />
          {merchant.dbaName && <Field label="DBA" value={merchant.dbaName} />}
          {merchant.businessType && (
            <Field label="Type" value={merchant.businessType} />
          )}
          {merchant.ein && <Field label="EIN" value={merchant.ein} mono />}
          <Field label="Email" value={merchant.email} />
          {merchant.phone && <Field label="Phone" value={merchant.phone} />}
          {(merchant.address || merchant.city || merchant.state) && (
            <Field
              label="Address"
              value={
                [
                  merchant.address,
                  [merchant.city, merchant.state].filter(Boolean).join(", "),
                  merchant.zip,
                ]
                  .filter(Boolean)
                  .join(" \u00B7 ") || "\u2014"
              }
            />
          )}
        </Section>

        <Section icon={User} title="Owner">
          <Field label="Name" value={ownerName} />
          {merchant.ownerTitle && (
            <Field label="Title" value={merchant.ownerTitle} />
          )}
          {merchant.ownerDob && (
            <Field label="Date of Birth" value={merchant.ownerDob} />
          )}
          {merchant.ownerSsnLast4 && (
            <Field
              label="SSN (last 4)"
              value={`\u2022\u2022\u2022\u2022${merchant.ownerSsnLast4}`}
              mono
            />
          )}
          {merchant.ownershipPercentage !== null && (
            <Field
              label="Ownership"
              value={`${merchant.ownershipPercentage}%`}
            />
          )}
          {merchant.ownerAddress && (
            <Field label="Address" value={merchant.ownerAddress} />
          )}
        </Section>

        <Section icon={Banknote} title="Banking">
          <Field
            label="Account Holder"
            value={merchant.bankAccountHolder ?? "\u2014"}
          />
          <Field
            label="Routing #"
            value={maskAccount(merchant.bankRoutingNumber)}
            mono
          />
          <Field
            label="Account #"
            value={maskAccount(merchant.bankAccountNumber)}
            mono
          />
          {merchant.bankAccountType && (
            <Field label="Account Type" value={merchant.bankAccountType} />
          )}
          {merchant.fundingSpeed && (
            <Field label="Funding Speed" value={merchant.fundingSpeed} />
          )}
        </Section>

        <Section icon={CreditCard} title="Account">
          <Field label="Plan" value={merchant.plan} />
          <Field label="Status" value={status} />
          <Field
            label="Charges"
            value={merchant.chargesEnabled ? "Enabled" : "Disabled"}
          />
          <Field
            label="Payouts"
            value={merchant.payoutsEnabled ? "Enabled" : "Disabled"}
          />
          <Field
            label="Created"
            value={new Date(merchant.createdAt).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          />
          {merchant.applicationSubmittedAt && (
            <Field
              label="Applied"
              value={new Date(
                merchant.applicationSubmittedAt
              ).toLocaleString("en-US", { dateStyle: "medium" })}
            />
          )}
        </Section>
      </div>
    </>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ boxShadow: SHADOW }}>
      <p className="text-xs text-[#878787] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className="text-xl font-semibold text-[#1A1313]">{value}</p>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl p-5" style={{ boxShadow: SHADOW }}>
      <div className="flex items-center gap-2 mb-4">
        <Icon size={16} className="text-[#017ea7]" />
        <span className="text-base font-semibold text-[#1A1313]">{title}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between items-baseline gap-3">
      <span className="text-xs text-[#878787] uppercase tracking-wider">
        {label}
      </span>
      <span
        className="text-sm text-[#1A1313] text-right"
        style={mono ? { fontFamily: "monospace" } : undefined}
      >
        {value}
      </span>
    </div>
  );
}
