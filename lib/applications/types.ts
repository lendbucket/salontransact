export type ApplicationStatus =
  | "submitted"
  | "approved"
  | "submitted_to_payroc"
  | "active"
  | "rejected";

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: "Pending Review",
  approved: "Approved",
  submitted_to_payroc: "Submitted to Payroc",
  active: "Active",
  rejected: "Rejected",
};

export const APPLICATION_STATUS_FILTERS = ["all", "submitted", "approved", "submitted_to_payroc", "active", "rejected"] as const;
export type ApplicationStatusFilter = typeof APPLICATION_STATUS_FILTERS[number];

export function isValidStatusFilter(v: string): v is ApplicationStatusFilter {
  return (APPLICATION_STATUS_FILTERS as readonly string[]).includes(v);
}

export interface ApplicationSummary {
  id: string;
  userId: string;
  legalBusinessName: string;
  dba: string | null;
  ownerFullName: string;
  ownerEmail: string;
  status: ApplicationStatus;
  submittedAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  hasSignedAgreement: boolean;
}

export interface ApplicationDetail {
  id: string;
  userId: string;
  legalBusinessName: string;
  dba: string | null;
  businessType: string;
  ein: string;
  businessPhone: string;
  website: string | null;
  addressStreet: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  addressCountry: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerTitle: string;
  bankName: string;
  accountHolderName: string;
  routingNumberLast4: string;
  accountNumberLast4: string;
  accountType: string;
  monthlyVolume: string;
  averageTicket: string;
  mccCode: string;
  agreementAccepted: boolean;
  signedAgreementContractId: string | null;
  internalNotes: string | null;
  status: ApplicationStatus;
  approvedAt: string | null;
  approvedByEmail: string | null;
  rejectedAt: string | null;
  rejectedByEmail: string | null;
  rejectionReason: string | null;
  submittedAt: string;
  updatedAt: string;
}

export interface ApplicationListResponse {
  data: ApplicationSummary[];
  count: number;
  pendingCount: number;
}
