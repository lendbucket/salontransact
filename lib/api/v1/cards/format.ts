import type { V1Card } from "./types";

export function savedPaymentMethodToCard(row: {
  id: string;
  customerId: string | null;
  customerEmail: string;
  last4: string | null;
  cardScheme: string | null;
  expiryMonth: string | null;
  expiryYear: string | null;
  cardholderName: string | null;
  label: string | null;
  status: string;
  lastUsedAt: Date | null;
  createdAt: Date;
}): V1Card {
  return {
    id: `card_${row.id}`,
    object: "card",
    customer_id: row.customerId,
    customer_email: row.customerEmail,
    last4: row.last4,
    brand: row.cardScheme,
    expiry_month: row.expiryMonth,
    expiry_year: row.expiryYear,
    cardholder_name: row.cardholderName,
    label: row.label,
    status: row.status,
    last_used_at: row.lastUsedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  };
}
