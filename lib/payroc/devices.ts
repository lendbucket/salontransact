import { payrocRequest } from './client'
import type {
  PayrocPaymentInstruction,
  PayrocPaymentInstructionResponse,
} from './types'

export async function sendPaymentInstruction(
  serialNumber: string,
  instruction: Omit<PayrocPaymentInstruction, 'processingTerminalId'>
): Promise<PayrocPaymentInstructionResponse> {
  return payrocRequest<PayrocPaymentInstructionResponse>(
    'POST',
    `/devices/${serialNumber}/payment-instructions`,
    {
      ...instruction,
      processingTerminalId: process.env.PAYROC_TERMINAL_ID,
    }
  )
}

export async function getPaymentInstruction(
  instructionId: string
): Promise<PayrocPaymentInstructionResponse> {
  return payrocRequest<PayrocPaymentInstructionResponse>(
    'GET',
    `/payment-instructions/${instructionId}`
  )
}

export async function sendRefundInstruction(
  serialNumber: string,
  paymentId: string,
  amount?: number
): Promise<PayrocPaymentInstructionResponse> {
  return payrocRequest<PayrocPaymentInstructionResponse>(
    'POST',
    `/devices/${serialNumber}/refund-instructions`,
    { paymentId, amount }
  )
}

export async function cancelPaymentInstruction(
  instructionId: string
): Promise<void> {
  return payrocRequest<void>(
    'DELETE',
    `/payment-instructions/${instructionId}`
  )
}
