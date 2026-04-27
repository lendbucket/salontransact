import { payrocRequest } from './client'
import type {
  PayrocPaymentRequest,
  PayrocPaymentResponse,
  PayrocRefundRequest,
} from './types'

const TERMINAL_ID = process.env.PAYROC_TERMINAL_ID!

export async function createPayment(
  request: Omit<PayrocPaymentRequest, 'processingTerminalId'>
): Promise<PayrocPaymentResponse> {
  return payrocRequest<PayrocPaymentResponse>('POST', '/payments', {
    ...request,
    processingTerminalId: TERMINAL_ID,
  })
}

export async function getPayment(
  paymentId: string
): Promise<PayrocPaymentResponse> {
  return payrocRequest<PayrocPaymentResponse>('GET', `/payments/${paymentId}`)
}

export async function listPayments(params?: {
  startDate?: string
  endDate?: string
  status?: string
  limit?: number
}): Promise<{ payments: PayrocPaymentResponse[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  if (params?.status) query.set('status', params.status)
  if (params?.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return payrocRequest('GET', `/payments${qs ? `?${qs}` : ''}`)
}

export async function refundPayment(
  paymentId: string,
  request?: PayrocRefundRequest
): Promise<PayrocPaymentResponse> {
  return payrocRequest<PayrocPaymentResponse>(
    'POST',
    `/payments/${paymentId}/refund`,
    request ?? {}
  )
}

export async function reversePayment(
  paymentId: string
): Promise<PayrocPaymentResponse> {
  return payrocRequest<PayrocPaymentResponse>(
    'POST',
    `/payments/${paymentId}/reverse`,
    {}
  )
}

/**
 * Adjustment variant for adjustPayment.
 * Per Payroc docs: polymorphic object whose `type` field selects the variant.
 * https://docs.payroc.com/api/schema/card-payments/payments/adjust
 */
export type PaymentAdjustment =
  | { type: 'order'; amount?: number; tipAmount?: number }
  | { type: 'status'; status: 'ready' | 'pending' }
  | {
      type: 'customer'
      firstName?: string
      lastName?: string
      contactMethods?: Array<{ type: 'mobile' | 'email'; value: string }>
      shippingAddress?: {
        recipientName?: string
        address: {
          address1: string
          address2?: string
          address3?: string
          city: string
          state: string
          country: string
          postalCode: string
        }
      }
    }
  | { type: 'signature'; data: string; format: 'png' | 'svg' }

export interface AdjustPaymentRequest {
  adjustments: PaymentAdjustment[]
  operator?: string
}

/**
 * Adjust a payment in an open batch.
 * Per docs, body must be { adjustments: [...] } where each item is a polymorphic object.
 * https://docs.payroc.com/api/schema/card-payments/payments/adjust
 */
export async function adjustPayment(
  paymentId: string,
  request: AdjustPaymentRequest
): Promise<PayrocPaymentResponse> {
  return payrocRequest<PayrocPaymentResponse>(
    'POST',
    `/payments/${paymentId}/adjust`,
    request
  )
}

export interface CapturePaymentRequest {
  amount?: number
  operator?: string
  processingTerminalId?: string
}

/**
 * Capture a pre-authorization.
 * - Omit `amount` to capture the full authorized amount.
 * - Provide `amount` to capture less than the authorized amount.
 * https://docs.payroc.com/api/schema/card-payments/payments/capture
 */
export async function capturePayment(
  paymentId: string,
  request: CapturePaymentRequest = {}
): Promise<PayrocPaymentResponse> {
  return payrocRequest<PayrocPaymentResponse>(
    'POST',
    `/payments/${paymentId}/capture`,
    request
  )
}
