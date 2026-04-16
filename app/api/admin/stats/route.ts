import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ADMIN_EMAIL } from '@/lib/admin'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.user?.email !== ADMIN_EMAIL) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [totalMerchants, activeMerchants, pendingInvites, volumeAgg, monthlyAgg] =
    await Promise.all([
      prisma.merchant.count(),
      prisma.merchant.count({ where: { status: 'active' } }),
      prisma.invite.count({
        where: { used: false, expiresAt: { gt: new Date() } },
      }),
      prisma.merchant.aggregate({ _sum: { totalVolume: true } }),
      prisma.merchant.aggregate({ _sum: { monthlyVolume: true } }),
    ])

  return Response.json({
    totalMerchants,
    activeMerchants,
    pendingInvites,
    totalVolume: volumeAgg._sum.totalVolume ?? 0,
    monthlyVolume: monthlyAgg._sum.monthlyVolume ?? 0,
  })
}
