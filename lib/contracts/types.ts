export type ContractDocType =
  | "master_services_agreement"
  | "w9"
  | "voided_check"
  | "id"
  | "tax_form"
  | "addendum"
  | "other";

export const CONTRACT_DOC_TYPES: ContractDocType[] = [
  "master_services_agreement",
  "w9",
  "voided_check",
  "id",
  "tax_form",
  "addendum",
  "other",
];

export const CONTRACT_DOC_TYPE_LABELS: Record<ContractDocType, string> = {
  master_services_agreement: "Master Services Agreement",
  w9: "W-9",
  voided_check: "Voided Check",
  id: "ID Verification",
  tax_form: "Tax Form",
  addendum: "Addendum",
  other: "Other",
};

export function isValidDocType(v: string): v is ContractDocType {
  return CONTRACT_DOC_TYPES.includes(v as ContractDocType);
}

export interface ContractPublic {
  id: string;
  merchantId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  docType: ContractDocType;
  uploadedById: string;
  uploadedByEmail: string;
  uploadedByRole: string;
  notes: string | null;
  createdAt: string;
}

export interface ContractListResponse {
  data: ContractPublic[];
  count: number;
}
