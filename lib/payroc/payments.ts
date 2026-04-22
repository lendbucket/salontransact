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
