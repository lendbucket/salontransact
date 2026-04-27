import { payrocRequest } from './client'
import type {
  SubmitPaymentInstructionRequest,
  SubmitRefundInstructionRequest,
  PaymentInstructionResponse,
} from './types'

const TERMINAL_ID = process.env.PAYROC_TERMINAL_ID!

/**
 * Submit a payment instruction to a paired Pay-by-Cloud device.
 * The device prompts the customer to tap, insert, or swipe.
 *
 * https://docs.payroc.com/api/schema/payroc-cloud/payment-instructions/submit
 */
export async function sendPaymentInstruction(
  serialNumber: string,
  request: Omit<SubmitPaymentInstructionRequest, 'processingTerminalId'> & {
    processingTerminalId?: string
  }
): Promise<PaymentInstructionResponse> {
  const body: SubmitPaymentInstructionRequest = {
    processingTerminalId: request.processingTerminalId ?? TERMINAL_ID,
    order: request.order,
    autoCapture: request.autoCapture,
    processAsSale: request.processAsSale,
    operator: request.operator,
    customizationOptions: request.customizationOptions,
    credentialOnFile: request.credentialOnFile,
  }
  return payrocRequest<PaymentInstructionResponse>(
    'POST',
    `/devices/${encodeURIComponent(serialNumber)}/payment-instructions`,
    body
  )
}

/**
 * Retrieve the current status of a payment instruction.
 * On status=completed, the link object points to the payment resource.
 *
 * https://docs.payroc.com/api/schema/payroc-cloud/payment-instructions/retrieve
 */
export async function getPaymentInstruction(
  paymentInstructionId: string
): Promise<PaymentInstructionResponse> {
  return payrocRequest<PaymentInstructionResponse>(
    'GET',
    `/payment-instructions/${encodeURIComponent(paymentInstructionId)}`
  )
}

/**
 * Cancel a payment instruction (customer walked away, etc.).
 *
 * https://docs.payroc.com/api/schema/payroc-cloud/payment-instructions/delete
 */
export async function cancelPaymentInstruction(
  paymentInstructionId: string
): Promise<void> {
  return payrocRequest<void>(
    'DELETE',
    `/payment-instructions/${encodeURIComponent(paymentInstructionId)}`
  )
}

/**
 * Submit a refund instruction to a paired device. The device prompts the
 * customer for the same card to refund to.
 *
 * https://docs.payroc.com/api/schema/payroc-cloud/refund-instructions/submit
 */
export async function sendRefundInstruction(
  serialNumber: string,
  request: Omit<SubmitRefundInstructionRequest, 'processingTerminalId'> & {
    processingTerminalId?: string
  }
): Promise<PaymentInstructionResponse> {
  const body: SubmitRefundInstructionRequest = {
    processingTerminalId: request.processingTerminalId ?? TERMINAL_ID,
    paymentId: request.paymentId,
    amount: request.amount,
    currency: request.currency,
    operator: request.operator,
  }
  return payrocRequest<PaymentInstructionResponse>(
    'POST',
    `/devices/${encodeURIComponent(serialNumber)}/refund-instructions`,
    body
  )
}
