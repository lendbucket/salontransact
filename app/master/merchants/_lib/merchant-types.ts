export interface MerchantSummary {
  id: string;
  businessName: string;
  dbaName: string | null;
  email: string;
  phone: string | null;
  status: string;
  plan: string;
  totalVolume: number;
  totalTransactions: number;
  createdAt: string;
  city: string | null;
  state: string | null;
  applicationSubmittedAt: string | null;
}

export interface MerchantListResponse {
  merchants: MerchantSummary[];
  total: number;
}

export interface MerchantDetail extends MerchantSummary {
  userId: string;
  businessType: string | null;
  address: string | null;
  zip: string | null;
  ein: string | null;
  ownerFirstName: string | null;
  ownerLastName: string | null;
  ownerTitle: string | null;
  ownerDob: string | null;
  ownerSsnLast4: string | null;
  ownerAddress: string | null;
  ownershipPercentage: number | null;
  bankAccountHolder: string | null;
  bankRoutingNumber: string | null;
  bankAccountNumber: string | null;
  bankAccountType: string | null;
  fundingSpeed: string | null;
  avgTransaction: string | null;
  paymentMethods: string[];
  monthlyVolume: number;
  payoutsEnabled: boolean;
  chargesEnabled: boolean;
  stripeAccountStatus: string;
  updatedAt: string;
}

export interface MerchantPatchRequest {
  status?: "active" | "suspended" | "pending";
  plan?: string;
}

export type MerchantStatusFilter = "all" | "active" | "pending" | "suspended";
