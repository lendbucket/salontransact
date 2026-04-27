export interface OnboardingFormData {
  // Step 1
  legalBusinessName: string;
  dba: string;
  businessType: string;
  ein: string;
  businessPhone: string;
  website: string;
  // Step 2
  addressStreet: string;
  addressSuite: string;
  addressCity: string;
  addressState: string;
  addressZip: string;
  // Step 3
  ownerFullName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerTitle: string;
  // Step 4
  bankName: string;
  accountHolderName: string;
  routingNumber: string;
  accountNumber: string;
  confirmAccountNumber: string;
  accountType: string;
  // Step 5
  monthlyVolume: string;
  averageTicket: string;
  mccCode: string;
  agreementAccepted: boolean;
}
