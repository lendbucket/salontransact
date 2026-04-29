"use client";

import { ContractsSection } from "@/components/contracts-section";

interface Props {
  merchantId: string;
  merchantName: string;
  currentUserId: string;
  currentUserRole: string;
}

export function ContractsTab({ merchantId, merchantName, currentUserId, currentUserRole }: Props) {
  return (
    <ContractsSection
      merchantId={merchantId}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      title={`Documents for ${merchantName}`}
      description="Upload and manage contracts, W-9s, voided checks, and other supporting documents."
    />
  );
}
