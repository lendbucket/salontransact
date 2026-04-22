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

export interface PayrocApiError {
  code: string
  message: string
  details?: string
}
