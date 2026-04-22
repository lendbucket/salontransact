import { payrocRequest } from './client'
import type { PayrocTransaction, PayrocBatch } from './types'

export async function listTransactions(params?: {
  startDate?: string
  endDate?: string
  batchId?: string
  limit?: number
}): Promise<{ transactions: PayrocTransaction[]; total: number }> {
  const query = new URLSearchParams()
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  if (params?.batchId) query.set('batchId', params.batchId)
  if (params?.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  return payrocRequest('GET', `/transactions${qs ? `?${qs}` : ''}`)
}

export async function getTransaction(
  transactionId: string
): Promise<PayrocTransaction> {
  return payrocRequest<PayrocTransaction>(
    'GET',
    `/transactions/${transactionId}`
  )
}

export async function listBatches(params?: {
  startDate?: string
  endDate?: string
}): Promise<{ batches: PayrocBatch[] }> {
  const query = new URLSearchParams()
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  const qs = query.toString()
  return payrocRequest('GET', `/batches${qs ? `?${qs}` : ''}`)
}

export async function getBatch(batchId: string): Promise<PayrocBatch> {
  return payrocRequest<PayrocBatch>('GET', `/batches/${batchId}`)
}
