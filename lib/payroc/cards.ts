import { payrocRequest } from './client'
import type {
  VerifyCardRequest,
  VerifyCardResponse,
  BinLookupRequest,
  BinLookupResponse,
} from './types'

const TERMINAL_ID = process.env.PAYROC_TERMINAL_ID!

/**
 * Verify a customer's card details.
 * Returns whether the card is valid and can be used for transactions.
 *
 * Per docs: https://docs.payroc.com/api/schema/payment-features/cards/verify-card
 */
export async function verifyCard(
  request: Omit<VerifyCardRequest, 'processingTerminalId'>
): Promise<VerifyCardResponse> {
  const body: VerifyCardRequest = {
    processingTerminalId: TERMINAL_ID,
    ...request,
  }
  return payrocRequest<VerifyCardResponse>('POST', '/cards/verify', body)
}

/**
 * Look up BIN information for a card.
 * Accepts any of: full card number, 6-8 digit BIN, secure token, or digital wallet ref.
 * Returns card brand, country, currency, debit/credit status, and optional surcharging info.
 *
 * Per docs: https://docs.payroc.com/api/schema/payment-features/cards/lookup-bin
 */
export async function binLookup(
  request: BinLookupRequest
): Promise<BinLookupResponse> {
  return payrocRequest<BinLookupResponse>(
    'POST',
    '/cards/bin-lookup',
    request
  )
}
