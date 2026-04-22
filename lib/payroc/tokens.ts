import { payrocRequest } from './client'
import type {
  PayrocSecureTokenRequest,
  PayrocSecureTokenResponse,
} from './types'

const TERMINAL_ID = process.env.PAYROC_TERMINAL_ID!

export async function createSecureToken(
  request: Omit<PayrocSecureTokenRequest, 'processingTerminalId'>
): Promise<PayrocSecureTokenResponse> {
  return payrocRequest<PayrocSecureTokenResponse>(
    'POST',
    `/processing-terminals/${TERMINAL_ID}/secure-tokens`,
    { ...request, processingTerminalId: TERMINAL_ID }
  )
}

export async function getSecureToken(
  tokenId: string
): Promise<PayrocSecureTokenResponse> {
  return payrocRequest<PayrocSecureTokenResponse>(
    'GET',
    `/processing-terminals/${TERMINAL_ID}/secure-tokens/${tokenId}`
  )
}

export async function updateSecureToken(
  tokenId: string,
  updates: Partial<PayrocSecureTokenRequest>
): Promise<PayrocSecureTokenResponse> {
  return payrocRequest<PayrocSecureTokenResponse>(
    'PATCH',
    `/processing-terminals/${TERMINAL_ID}/secure-tokens/${tokenId}`,
    updates
  )
}

export async function deleteSecureToken(tokenId: string): Promise<void> {
  return payrocRequest<void>(
    'DELETE',
    `/processing-terminals/${TERMINAL_ID}/secure-tokens/${tokenId}`
  )
}
