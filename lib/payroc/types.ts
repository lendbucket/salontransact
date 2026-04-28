export interface PayrocTokenResponse {
  token: string
  expiresIn: number
  tokenType: string
}

export interface PayrocPaymentRequest {
  processingTerminalId: string
  order: {
    orderId: string
    orderDate: string
    description?: string
  }
  customer?: {
    firstName?: string
    lastName?: string
    email?: string
    phone?: string
  }
  payment: {
    type: 'sale' | 'auth'
    currency: 'USD'
    country: 'USA'
    amount: number
    tip?: number
    cardAccount?: {
      token: string
    }
  }
}

export interface PayrocPaymentResponse {
  paymentId: string
  status: 'approved' | 'declined' | 'error'
  amount: number
  tip?: number
  currency: string
  processingTerminalId: string
  order: {
    orderId: string
    orderDate: string
    description?: string
  }
  cardAccount?: {
    last4: string
    cardBrand: string
    token?: string
  }
  responseCode: string
  responseMessage: string
  approvalCode?: string
  createdAt: string
}

export interface PayrocSecureTokenRequest {
  processingTerminalId: string
  cardAccount: {
    cardNumber?: string
    expiryMonth?: string
    expiryYear?: string
    cvv?: string
  }
  customer?: {
    firstName?: string
    lastName?: string
    email?: string
  }
}

export interface PayrocSecureTokenResponse {
  secureTokenId: string
  last4: string
  cardBrand: string
  expiryMonth: string
  expiryYear: string
  customer?: {
    firstName?: string
    lastName?: string
    email?: string
  }
  createdAt: string
}

export interface PayrocPaymentInstruction {
  processingTerminalId: string
  order: {
    orderId: string
    orderDate: string
    description?: string
  }
  payment: {
    type: 'sale'
    currency: 'USD'
    country: 'USA'
    amount: number
    tip?: number
  }
  createToken?: boolean
}

export interface PayrocPaymentInstructionResponse {
  paymentInstructionId: string
  status: 'pending' | 'sent' | 'completed' | 'failed' | 'cancelled'
  paymentId?: string
  createdAt: string
}

export interface PayrocTransaction {
  transactionId: string
  paymentId: string
  type: string
  status: string
  amount: number
  currency: string
  cardBrand?: string
  last4?: string
  createdAt: string
  batchId?: string
}

export interface PayrocBatch {
  batchId: string
  status: string
  openedAt: string
  closedAt?: string
  totalAmount: number
  transactionCount: number
  currency: string
}

export interface PayrocDispute {
  disputeId: string
  paymentId: string
  status: string
  amount: number
  currency: string
  reason: string
  createdAt: string
  respondBy?: string
}

export interface PayrocDisputeStatus {
  status: string
  updatedAt: string
  note?: string
}

export interface PayrocRefundRequest {
  amount?: number
  reason?: string
}

export interface PayrocApiErrorBody {
  code: string
  message: string
  details?: string
}

// ===== Tokenization types (Phase 5) =====
// Per https://docs.payroc.com/api/schema/tokenization/secure-tokens/create

export interface TokenizationCardKeyedPlainText {
  type: 'plainText'
  cardNumber: string
  cvv?: string
  expiryDate: string
}

export interface TokenizationCardKeyed {
  type: 'keyed'
  keyedData: TokenizationCardKeyedPlainText
  cardholderName?: string
}

export interface TokenizationCardPayload {
  type: 'card'
  cardDetails: TokenizationCardKeyed
}

export interface TokenizationSingleUseTokenPayload {
  type: 'singleUseToken'
  token: string
}

export type TokenizationSource =
  | TokenizationCardPayload
  | TokenizationSingleUseTokenPayload

export type MitAgreement = 'unscheduled' | 'recurring' | 'installment'

export interface TokenizationCustomer {
  firstName?: string
  lastName?: string
  referenceNumber?: string
  contactMethods?: Array<{ type: 'mobile' | 'email'; value: string }>
}

export interface CreateSecureTokenRequest {
  source: TokenizationSource
  secureTokenId?: string
  operator?: string
  mitAgreement?: MitAgreement
  customer?: TokenizationCustomer
}

export interface SecureTokenSourceResponse {
  type: string
  cardNumber?: string
  cardholderName?: string
  expiryDate?: string
}

export interface CreateSecureTokenResponse {
  secureTokenId: string
  processingTerminalId: string
  source: SecureTokenSourceResponse
  token: string
  status: string
  mitAgreement?: MitAgreement
  customer?: TokenizationCustomer
}

export interface UpdateSecureTokenRequest {
  customer?: TokenizationCustomer
  mitAgreement?: MitAgreement
}

// ===== Payroc Cloud (Pay by Cloud) types — Phase 7 =====
// https://docs.payroc.com/api/schema/payroc-cloud/payment-instructions/submit

export interface PaymentInstructionOrder {
  orderId: string
  description?: string
  amount: number
  currency: 'USD'
  dateTime?: string
}

export interface PaymentInstructionCustomizationOptions {
  entryMethod?: 'deviceRead' | 'manual'
  promptForTip?: boolean
  promptForSignature?: boolean
}

export interface PaymentInstructionCredentialOnFile {
  storeCard?: boolean
  mitAgreement?: 'unscheduled' | 'recurring' | 'installment'
}

export interface SubmitPaymentInstructionRequest {
  processingTerminalId: string
  order: PaymentInstructionOrder
  autoCapture?: boolean
  processAsSale?: boolean
  operator?: string
  customizationOptions?: PaymentInstructionCustomizationOptions
  credentialOnFile?: PaymentInstructionCredentialOnFile
}

export type PaymentInstructionStatus =
  | 'inProgress'
  | 'completed'
  | 'canceled'
  | 'failure'

export interface PaymentInstructionLink {
  rel: string
  method: string
  href: string
}

export interface PaymentInstructionResponse {
  status: PaymentInstructionStatus
  paymentInstructionId: string
  errorMessage?: string
  link?: PaymentInstructionLink
}

export interface SubmitRefundInstructionRequest {
  processingTerminalId: string
  paymentId?: string
  amount?: number
  currency?: 'USD'
  operator?: string
}

// ===== Card features types (Phase 6) =====
// Per https://docs.payroc.com/api/schema/payment-features/cards/verify-card
// Per https://docs.payroc.com/api/schema/payment-features/cards/lookup-bin

export interface BinLookupCardBinPayload {
  type: 'cardBin'
  cardBin: string
}

export interface BinLookupSecureTokenPayload {
  type: 'secureToken'
  secureToken: string
}

export interface BinLookupDigitalWalletPayload {
  type: 'digitalWallet'
  digitalWallet: {
    type: string
    token: string
  }
}

export type VerifyCardSource = TokenizationCardPayload

export type BinLookupSource =
  | TokenizationCardPayload
  | BinLookupCardBinPayload
  | BinLookupSecureTokenPayload
  | BinLookupDigitalWalletPayload

export interface VerifyCardCustomer {
  firstName?: string
  lastName?: string
  emailAddress?: string
  phoneNumber?: string
}

export interface VerifyCardRequest {
  processingTerminalId: string
  card: VerifyCardSource
  operator?: string
  customer?: VerifyCardCustomer
}

export interface VerifyCardResponseCard {
  type?: string
  entryMethod?: string
  cardNumber?: string
  expiryDate?: string
  cardholderName?: string
}

export interface VerifyCardTransactionResult {
  status: string
  responseCode: string
  responseMessage: string
  processorResponseCode?: string
}

export interface VerifyCardResponse {
  processingTerminalId: string
  verified: boolean
  operator?: string
  card?: VerifyCardResponseCard
  transactionResult: VerifyCardTransactionResult
}

export interface BinLookupRequest {
  card: BinLookupSource
  processingTerminalId?: string
  amount?: number
  currency?: string
}

export interface BinLookupSurcharging {
  amount?: number
  currency?: string
  description?: string
}

export interface BinLookupResponse {
  type: string
  cardNumber: string
  country: string
  currency: string
  debit: boolean
  surcharging?: BinLookupSurcharging
}
