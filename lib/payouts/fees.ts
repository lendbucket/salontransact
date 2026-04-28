/**
 * Surcharge fee calculations (informational).
 * Customer pays 3.5% + $0.30 on top of merchant's sale.
 * Merchant receives 100% of their sale price.
 */

const SURCHARGE_PERCENT = 0.035;
const SURCHARGE_FLAT_CENTS = 30;

export function computeSurchargeCents(merchantAmountCents: number): number {
  if (!Number.isFinite(merchantAmountCents) || merchantAmountCents <= 0)
    return 0;
  return (
    Math.round(merchantAmountCents * SURCHARGE_PERCENT) + SURCHARGE_FLAT_CENTS
  );
}

export function computeCustomerTotalCents(
  merchantAmountCents: number
): number {
  return merchantAmountCents + computeSurchargeCents(merchantAmountCents);
}

export function feeDescription(): string {
  return "3.5% + $0.30 (paid by customer as surcharge)";
}
