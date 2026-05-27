"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlanForm } from "../_components/plan-form";
import { Toast } from "@/components/ui/toast";

interface Props {
  merchantTaxRateBasisPoints: number;
  merchantTaxEnabled: boolean;
  merchantTaxJurisdiction: string | null;
}

export function PlanNewClient({
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
    const body: Record<string, unknown> = {
      name: data.name,
      amountCents: data.amountCents,
      currency: data.currency,
      taxable: data.taxable,
      interval: data.interval,
      intervalCount: data.intervalCount,
      publicSignupEnabled: data.publicSignupEnabled,
    };
    if (data.description) body.description = data.description;
    if (data.trialDays != null) body.trialDays = data.trialDays;
    if (data.publicSignupEnabled && data.publicSignupSlug) {
      body.publicSignupSlug = data.publicSignupSlug;
    }

    const res = await fetch("/api/subscription-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.status === 201) {
      const json = await res.json();
      router.push(`/subscriptions/plans/${json.plan.id}`);
      return;
    }

    if (res.status === 409) {
      showToast(
        "error",
        "A plan with this public signup URL already exists. Choose a different slug."
      );
      return;
    }

    const json = await res.json().catch(() => null);
    showToast("error", json?.error ?? "Failed to create plan");
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
        New Plan
      </h2>

      <PlanForm
        mode="new"
        merchantTaxRateBasisPoints={merchantTaxRateBasisPoints}
        merchantTaxEnabled={merchantTaxEnabled}
        merchantTaxJurisdiction={merchantTaxJurisdiction}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/subscriptions/plans")}
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
