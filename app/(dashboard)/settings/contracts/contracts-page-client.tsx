"use client";

import { ContractsSection } from "@/components/contracts-section";

interface Props {
  merchantId: string;
  currentUserId: string;
  currentUserRole: string;
}

export function ContractsPageClient({
  merchantId,
  currentUserId,
  currentUserRole,
}: Props) {
  return (
    <ContractsSection
      merchantId={merchantId}
      currentUserId={currentUserId}
      currentUserRole={currentUserRole}
      title="Your documents"
      description="Upload and manage contracts, W-9s, voided checks, ID verification, and other supporting documents."
    />
  );
}
