import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ADMIN_EMAIL } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import type { MerchantRow } from '@/types'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.user?.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const merchants = await prisma.merchant.findMany({
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const rows: MerchantRow[] = merchants.map((m) => ({
    id: m.id,
    businessName: m.businessName,
    email: m.user.email,
    stripeAccountStatus: m.stripeAccountStatus,
    plan: m.plan,
    totalVolume: m.totalVolume,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
  }))

  return Response.json(rows)
}
