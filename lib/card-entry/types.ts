export type CardEntryTokenStatus = "active" | "used" | "expired" | "cancelled";

export interface CardEntryTokenPayload {
  v: 1;
  tid: string;
  mid: string;
  exp: number;
}

export interface CardEntryTokenCreateInput {
  merchantId: string;
  customerPhone: string;
  customerName?: string;
  customerEmail?: string;
  bookingId?: string;
  expiresInMinutes?: number;
}

export interface CardEntryTokenCreateResult {
  tokenId: string;
  signedToken: string;
  url: string;
  expiresAt: string;
  smsSent: boolean;
  smsSid: string | null;
  smsError: string | null;
}
