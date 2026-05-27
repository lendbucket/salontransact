"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlanForm } from "../../_components/plan-form";
import { Toast } from "@/components/ui/toast";
import type { SerializedPlan } from "../../plans-list-client";

type Plan = Omit<SerializedPlan, "activeSubscriptionCount">;

interface Props {
  plan: Plan;
  activeSubscriptionCount: number;
  merchantTaxRateBasisPoints: number;
  merchantTaxEnabled: boolean;
  merchantTaxJurisdiction: string | null;
}

export function PlanEditClient({
  plan,
  activeSubscriptionCount,
  merchantTaxRateBasisPoints,
  merchantTaxEnabled,
  merchantTaxJurisdiction,
}: Props) {
  const router = useRouter();
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSubmit(data: {
    name: string;
    description: string;
    amountCents: number;
    currency: string;
    taxable: boolean;
    interval: "WEEKLY" | "MONTHLY" | "ANNUAL";
    intervalCount: number;
    trialDays: number | null;
    publicSignupEnabled: boolean;
    publicSignupSlug: string;
  }) {
    const body: Record<string, unknown> = {};

    // Always send mutable fields
    if (data.name !== plan.name) body.name = data.name;
    if (data.description !== (plan.description ?? ""))
      body.description = data.description || null;

    // Immutable fields — only send if changed and not disabled
    if (activeSubscriptionCount === 0) {
      if (data.amountCents !== plan.amountCents)
        body.amountCents = data.amountCents;
      if (data.currency !== plan.currency) body.currency = data.currency;
      if (data.taxable !== plan.taxable) body.taxable = data.taxable;
      if (data.interval !== plan.interval) body.interval = data.interval;
      if (data.intervalCount !== plan.intervalCount)
        body.intervalCount = data.intervalCount;
    }

    // Status change for archive/reactivate is handled on detail page
    // but we also support status if it changes here (shouldn't in normal flow)

    if (Object.keys(body).length === 0) {
      showToast("success", "No changes to save");
      return;
    }

    const res = await fetch(`/api/subscription-plans/${plan.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      showToast("success", "Plan updated");
      router.refresh();
      router.push(`/subscriptions/plans/${plan.id}`);
      return;
    }

    if (res.status === 409) {
      const json = await res.json().catch(() => null);
      showToast("error", json?.error ?? "Cannot modify immutable fields");
      return;
    }

    const json = await res.json().catch(() => null);
    showToast("error", json?.error ?? "Failed to update plan");
  }

  return (
    <div>
      <h2
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: "#1A1313",
          letterSpacing: "-0.31px",
          margin: "0 0 24px",
        }}
      >
        Edit Plan
      </h2>

      <PlanForm
        mode="edit"
        initialValues={{
          name: plan.name,
          description: plan.description ?? "",
          amountCents: plan.amountCents,
          currency: plan.currency,
          taxable: plan.taxable,
          interval: plan.interval as "WEEKLY" | "MONTHLY" | "ANNUAL",
          intervalCount: plan.intervalCount,
          trialDays: plan.trialDays,
          publicSignupEnabled: plan.publicSignupEnabled,
          publicSignupSlug: plan.publicSignupSlug ?? "",
        }}
        immutableFieldsDisabled={activeSubscriptionCount > 0}
        merchantTaxRateBasisPoints={merchantTaxRateBasisPoints}
        merchantTaxEnabled={merchantTaxEnabled}
        merchantTaxJurisdiction={merchantTaxJurisdiction}
        onSubmit={handleSubmit}
        onCancel={() => router.push(`/subscriptions/plans/${plan.id}`)}
      />

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
