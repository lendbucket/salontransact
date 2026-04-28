export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface MerchantInvitePublic {
  id: string;
  email: string;
  businessName: string;
  note: string | null;
  invitedByEmail: string;
  status: InviteStatus;
  acceptedAt: string | null;
  applicationId: string | null;
  expiresAt: string;
  createdAt: string;
  isExpiredNow: boolean;
}

export interface MerchantInviteListResponse {
  data: MerchantInvitePublic[];
  count: number;
  pendingCount: number;
}

export interface MerchantInviteValidateResponse {
  valid: boolean;
  email?: string;
  businessName?: string;
  note?: string | null;
  invitedByEmail?: string;
  expiresAt?: string;
  reason?: "not-found" | "expired" | "revoked" | "already-accepted";
}
