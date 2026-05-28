"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Archive,
  RotateCcw,
  DollarSign,
  CalendarClock,
  Globe,
  Users,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Toast } from "@/components/ui/toast";
import { TaxPreview } from "../_components/tax-preview";
import type { SerializedPlan } from "../plans-list-client";

type Plan = Omit<SerializedPlan, "activeSubscriptionCount">;

interface Props {
  plan: Plan;
  activeSubscriptionCount: number;
  merchantTaxRateBasisPoints: number;
  merchantTaxEnabled: boolean;
  merchantTaxJurisdiction: string | null;
}

function fmtAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtInterval(interval: string, count: number): string {
  const unit = interval.toLowerCase();
  return `Every ${count} ${unit}${count > 1 ? "s" : ""}`;
}

export function PlanDetailClient({
  plan,
  activeSubscriptionCount,
  merchantTaxRateBasisPoints,
  merchantTaxEnabled,
  merchantTaxJurisdiction,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleStatusChange(newStatus: "archived" | "active") {
    const action = newStatus === "archived" ? "Archive" : "Reactivate";
    const msg =
      newStatus === "archived"
        ? `Archive '${plan.name}'? Existing subscribers continue billing. New subscribers cannot use this plan.`
        : `Reactivate '${plan.name}'? It will be available for new subscribers again.`;

    if (!confirm(msg)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/subscription-plans/${plan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        showToast("success", `Plan ${newStatus === "archived" ? "archived" : "reactivated"}`);
        router.refresh();
      } else {
        const json = await res.json().catch(() => null);
        showToast("error", json?.error ?? `Failed to ${action.toLowerCase()} plan`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleCopyLink() {
    const url = `https://portal.salontransact.com/subscribe/${plan.publicSignupSlug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("error", "Could not copy link. Copy it manually from the URL field.");
    }
  }

  const detailRow = (label: string, value: React.ReactNode) => (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid #F4F5F7",
      }}
    >
      <span style={{ fontSize: 13, color: "#878787" }}>{label}</span>
      <span style={{ fontSize: 14, color: "#1A1313", fontWeight: 500 }}>
        {value}
      </span>
    </div>
  );

  return (
    <div>
      {/* Back link */}
      <button
        onClick={() => router.push("/subscriptions/plans")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 14,
          color: "#017ea7",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={14} />
        Back to Plans
      </button>

      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: "#1A1313",
              letterSpacing: "-0.31px",
              margin: 0,
            }}
          >
            {plan.name}
          </h2>
          <StatusPill status={plan.status} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button
            variant="secondary"
            leadingIcon={<Pencil size={14} />}
            onClick={() =>
              router.push(`/subscriptions/plans/${plan.id}/edit`)
            }
          >
            Edit Plan
          </Button>
          {plan.status === "active" ? (
            <Button
              variant="danger"
              leadingIcon={<Archive size={14} />}
              loading={loading}
              onClick={() => handleStatusChange("archived")}
            >
              Archive
            </Button>
          ) : (
            <Button
              variant="secondary"
              leadingIcon={<RotateCcw size={14} />}
              loading={loading}
              onClick={() => handleStatusChange("active")}
            >
              Reactivate
            </Button>
          )}
        </div>
      </div>

      {/* Detail cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-2"
        style={{ gap: 16, marginBottom: 24 }}
      >
        {/* Pricing */}
        <Card padding={20}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <DollarSign size={16} color="#878787" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#878787",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Pricing
            </span>
          </div>
          {detailRow("Amount", fmtAmount(plan.amountCents))}
          {detailRow("Currency", plan.currency.toUpperCase())}
          {detailRow(
            "Taxable",
            plan.taxable ? (
              <StatusPill status="active" label="Yes" />
            ) : (
              <StatusPill status="neutral" label="No" />
            )
          )}
        </Card>

        {/* Schedule */}
        <Card padding={20}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <CalendarClock size={16} color="#878787" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#878787",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Schedule
            </span>
          </div>
          {detailRow("Interval", fmtInterval(plan.interval, plan.intervalCount))}
          {detailRow(
            "Trial days",
            plan.trialDays != null ? `${plan.trialDays} days` : "None"
          )}
        </Card>

        {/* Public signup */}
        <Card padding={20}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Globe size={16} color="#878787" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#878787",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Public Signup
            </span>
          </div>
          {detailRow(
            "Enabled",
            plan.publicSignupEnabled ? (
              <StatusPill status="active" label="Yes" />
            ) : (
              <StatusPill status="neutral" label="No" />
            )
          )}
          {plan.publicSignupEnabled && plan.publicSignupSlug && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "8px 0",
              }}
            >
              <span style={{ fontSize: 13, color: "#878787" }}>URL</span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  color: "#017ea7",
                }}
              >
                portal.salontransact.com/subscribe/{plan.publicSignupSlug}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyLink();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#878787",
                    padding: 2,
                  }}
                  title="Copy link"
                >
                  {copied ? <Check size={14} color="#15803D" /> : <Copy size={14} />}
                </button>
              </span>
            </div>
          )}
        </Card>

        {/* Subscribers */}
        <Card padding={20}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <Users size={16} color="#878787" />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#878787",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Subscribers
            </span>
          </div>
          {detailRow(
            "Active subscriptions",
            <span style={{ fontWeight: activeSubscriptionCount > 0 ? 600 : 400 }}>
              {activeSubscriptionCount}
            </span>
          )}
          {activeSubscriptionCount > 0 && (
            <p
              style={{
                fontSize: 12,
                color: "#92400E",
                background: "#FEF3C7",
                padding: "6px 10px",
                borderRadius: 6,
                marginTop: 8,
              }}
            >
              This plan has active subscribers. Pricing and interval changes
              are restricted.
            </p>
          )}
        </Card>
      </div>

      {/* Tax preview */}
      <Card padding={20}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
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
            Tax Preview
          </span>
        </div>
        <TaxPreview
          amountCents={plan.amountCents}
          taxable={plan.taxable}
          merchantTaxEnabled={merchantTaxEnabled}
          merchantTaxRateBasisPoints={merchantTaxRateBasisPoints}
          merchantTaxJurisdiction={merchantTaxJurisdiction}
        />
      </Card>

      {/* Description */}
      {plan.description && (
        <Card padding={20} style={{ marginTop: 16 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#878787",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Description
          </span>
          <p style={{ fontSize: 14, color: "#4A4A4A", marginTop: 8 }}>
            {plan.description}
          </p>
        </Card>
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            zIndex: 100,
            maxWidth: 400,
          }}
        >
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}
    </div>
  );
}
