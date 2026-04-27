/**
 * UI/API contract types for saved payment methods.
 * Mirrors Prisma's SavedPaymentMethod with select fields safe to expose to clients.
 */
export interface SavedCardPublic {
  id: string;
  customerEmail: string;
  payrocSecureTokenId: string;
  cardScheme: string | null;
  last4: string | null;
  expiryMonth: string | null;
  expiryYear: string | null;
  cardholderName: string | null;
  label: string | null;
  status: string;
  mitAgreement: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface SavedCardListResponse {
  data: SavedCardPublic[];
  count: number;
}
