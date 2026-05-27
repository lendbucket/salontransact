// ---------------------------------------------------------------------------
// Subscription Tax Calculation — lib/subscriptions/tax.ts
//
// Pure function. No DB, no async, no side effects. Computes tax for a
// subscription invoice using the merchant's configured rate.
//
// Design doc: docs/subscriptions-platform-design.md Section 10.3
// ---------------------------------------------------------------------------

export interface TaxInput {
  subtotalCents: number
  merchant: {
    taxEnabled: boolean
    taxRateBasisPoints: number
    taxJurisdiction: string | null
  }
  plan: {
    taxable: boolean
  }
  customer: {
    taxExempt: boolean
  }
}

export interface TaxResult {
  taxCents: number
  taxRateApplied: number | null
  taxJurisdictionApplied: string | null
}

const ZERO_TAX: Readonly<TaxResult> = Object.freeze({
  taxCents: 0,
  taxRateApplied: null,
  taxJurisdictionApplied: null,
});

export function calculateTax(input: TaxInput): TaxResult {
  if (input.customer.taxExempt) return ZERO_TAX;
  if (!input.plan.taxable) return ZERO_TAX;
  if (!input.merchant.taxEnabled) return ZERO_TAX;

  const taxCents = Math.round(
    input.subtotalCents * input.merchant.taxRateBasisPoints / 10000
  );

  return {
    taxCents,
    taxRateApplied: input.merchant.taxRateBasisPoints,
    taxJurisdictionApplied: input.merchant.taxJurisdiction,
  };
}
