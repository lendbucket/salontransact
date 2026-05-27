"use client";

import { calculateTax } from "@/lib/subscriptions/tax";

interface TaxPreviewProps {
  amountCents: number;
  taxable: boolean;
  merchantTaxEnabled: boolean;
  merchantTaxRateBasisPoints: number;
  merchantTaxJurisdiction: string | null;
}

function fmtDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function TaxPreview({
  amountCents,
  taxable,
  merchantTaxEnabled,
  merchantTaxRateBasisPoints,
  merchantTaxJurisdiction,
}: TaxPreviewProps) {
  const result = calculateTax({
    subtotalCents: amountCents,
    merchant: {
      taxEnabled: merchantTaxEnabled,
      taxRateBasisPoints: merchantTaxRateBasisPoints,
      taxJurisdiction: merchantTaxJurisdiction,
    },
    plan: { taxable },
    customer: { taxExempt: false },
  });

  const totalCents = amountCents + result.taxCents;
  const ratePercent = merchantTaxRateBasisPoints / 100;

  if (!taxable) {
    return (
      <div
        style={{
          padding: 12,
          background: "#F9FAFB",
          borderRadius: 8,
          border: "1px solid #E8EAED",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4A4A4A" }}>
          <span>Subtotal</span>
          <span>{fmtDollars(amountCents)}</span>
        </div>
        <p style={{ fontSize: 12, color: "#878787", marginTop: 8 }}>
          Tax exempt — total will be {fmtDollars(amountCents)}.
        </p>
      </div>
    );
  }

  if (taxable && !merchantTaxEnabled) {
    return (
      <div
        style={{
          padding: 12,
          background: "#F9FAFB",
          borderRadius: 8,
          border: "1px solid #E8EAED",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4A4A4A" }}>
          <span>Subtotal</span>
          <span>{fmtDollars(amountCents)}</span>
        </div>
        <p style={{ fontSize: 12, color: "#878787", marginTop: 8 }}>
          Merchant tax disabled — total will be {fmtDollars(amountCents)}.
          Enable tax in Settings.
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 12,
        background: "#F9FAFB",
        borderRadius: 8,
        border: "1px solid #E8EAED",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4A4A4A", marginBottom: 4 }}>
        <span>Subtotal</span>
        <span>{fmtDollars(amountCents)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#4A4A4A", marginBottom: 4 }}>
        <span>
          Tax ({ratePercent}%){merchantTaxJurisdiction ? ` ${merchantTaxJurisdiction}` : ""}
        </span>
        <span>{fmtDollars(result.taxCents)}</span>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 14,
          fontWeight: 600,
          color: "#1A1313",
          borderTop: "1px solid #E8EAED",
          paddingTop: 4,
          marginTop: 4,
        }}
      >
        <span>Total</span>
        <span>{fmtDollars(totalCents)}</span>
      </div>
    </div>
  );
}
