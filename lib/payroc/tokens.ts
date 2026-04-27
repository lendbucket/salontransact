import { payrocRequest } from './client'
import type {
  CreateSecureTokenRequest,
  CreateSecureTokenResponse,
  UpdateSecureTokenRequest,
} from './types'

const TERMINAL_ID = process.env.PAYROC_TERMINAL_ID!

/**
 * Create a Secure Token representing a customer's payment method.
 *
 * Lets Payroc generate the secureTokenId (returned in response with MREF_ prefix
 * unless the caller explicitly supplies their own).
 *
 * https://docs.payroc.com/api/schema/tokenization/secure-tokens/create
 */
export async function createSecureToken(
  request: CreateSecureTokenRequest
): Promise<CreateSecureTokenResponse> {
  return payrocRequest<CreateSecureTokenResponse>(
    'POST',
    `/processing-terminals/${TERMINAL_ID}/secure-tokens`,
    request
  )
}

/**
 * Retrieve a Secure Token by its merchant-assigned (or Payroc-generated) ID.
 *
 * https://docs.payroc.com/api/schema/tokenization/secure-tokens/retrieve
 */
export async function getSecureToken(
  secureTokenId: string
): Promise<CreateSecureTokenResponse> {
  return payrocRequest<CreateSecureTokenResponse>(
    'GET',
    `/processing-terminals/${TERMINAL_ID}/secure-tokens/${encodeURIComponent(secureTokenId)}`
  )
}

/**
 * Partially update a Secure Token. PATCH per docs.
 *
 * https://docs.payroc.com/api/schema/tokenization/secure-tokens/partially-update
 */
export async function updateSecureToken(
  secureTokenId: string,
  updates: UpdateSecureTokenRequest
): Promise<CreateSecureTokenResponse> {
  return payrocRequest<CreateSecureTokenResponse>(
    'PATCH',
    `/processing-terminals/${TERMINAL_ID}/secure-tokens/${encodeURIComponent(secureTokenId)}`,
    updates
  )
}

/**
 * Delete a Secure Token. Cannot be recovered; the secureTokenId cannot be reused.
 *
 * https://docs.payroc.com/api/schema/tokenization/secure-tokens/delete
 */
export async function deleteSecureToken(secureTokenId: string): Promise<void> {
  return payrocRequest<void>(
    'DELETE',
    `/processing-terminals/${TERMINAL_ID}/secure-tokens/${encodeURIComponent(secureTokenId)}`
  )
}

/**
 * Create a Single-Use Token for raw card data.
 * For Hosted Fields integrations, single-use tokens are produced client-side by the SDK,
 * not by this function. This is here for server-side scenarios (MOTO, batch enrollment).
 *
 * https://docs.payroc.com/api/schema/tokenization/single-use-tokens/create
 */
export async function createSingleUseToken(request: {
  cardNumber: string
  expiryDate: string
  cvv?: string
  cardholderName?: string
}): Promise<{ token: string; expiresAt: string }> {
  return payrocRequest(
    'POST',
    `/processing-terminals/${TERMINAL_ID}/single-use-tokens`,
    request
  )
}
