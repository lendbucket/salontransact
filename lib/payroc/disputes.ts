import { payrocRequest } from './client'
import type { PayrocDispute, PayrocDisputeStatus } from './types'

export async function listDisputes(params?: {
  startDate?: string
  endDate?: string
  status?: string
}): Promise<{ disputes: PayrocDispute[] }> {
  const query = new URLSearchParams()
  if (params?.startDate) query.set('startDate', params.startDate)
  if (params?.endDate) query.set('endDate', params.endDate)
  if (params?.status) query.set('status', params.status)
  const qs = query.toString()
  return payrocRequest('GET', `/disputes${qs ? `?${qs}` : ''}`)
}

export async function getDisputeStatuses(
  disputeId: string
): Promise<{ statuses: PayrocDisputeStatus[] }> {
  return payrocRequest('GET', `/disputes/${disputeId}/statuses`)
}
