export interface AdminStats {
  totalMerchants: number
  activeMerchants: number
  pendingInvites: number
  totalVolume: number
  monthlyVolume: number
}

export interface MerchantRow {
  id: string
  businessName: string
  email: string
  stripeAccountStatus: string
  plan: string
  totalVolume: number
  status: string
  createdAt: string
}

export interface InviteRow {
  id: string
  email: string
  used: boolean
  usedAt: string | null
  expiresAt: string
  createdAt: string
  isExpired: boolean
}

export type InviteStatus = 'pending' | 'used' | 'expired'
