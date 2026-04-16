import { requireAdmin } from '@/lib/admin'
import { prisma } from '@/lib/prisma'
import { Store, CheckCircle, Mail, DollarSign } from 'lucide-react'
import { format } from 'date-fns'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    active: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
    pending: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
    restricted: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
    suspended: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
    incomplete: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
  }
  const c = colors[status] ?? colors.incomplete
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
      style={{ background: c.bg, color: c.text }}
    >
      {status}
    </span>
  )
}

export default async function AdminOverviewPage() {
  await requireAdmin()

  const [totalMerchants, activeMerchants, pendingInvites, volumeAgg, recentMerchants] =
    await Promise.all([
      prisma.merchant.count(),
      prisma.merchant.count({ where: { status: 'active' } }),
      prisma.invite.count({
        where: { used: false, expiresAt: { gt: new Date() } },
      }),
      prisma.merchant.aggregate({ _sum: { totalVolume: true } }),
      prisma.merchant.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { email: true } } },
      }),
    ])

  const totalVolume = volumeAgg._sum.totalVolume ?? 0

  const stats = [
    {
      label: 'Total Merchants',
      value: totalMerchants.toString(),
      icon: Store,
      color: '#635bff',
    },
    {
      label: 'Active Merchants',
      value: activeMerchants.toString(),
      icon: CheckCircle,
      color: '#22c55e',
    },
    {
      label: 'Pending Invites',
      value: pendingInvites.toString(),
      icon: Mail,
      color: '#f59e0b',
    },
    {
      label: 'Total Volume',
      value: formatCurrency(totalVolume),
      icon: DollarSign,
      color: '#635bff',
    },
  ]

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-white">Admin Overview</h1>
        <span className="text-sm" style={{ color: '#6b7280' }}>
          {format(new Date(), 'MMMM d, yyyy')}
        </span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.label}
              className="rounded-xl p-6"
              style={{
                background: '#111827',
                border: '1px solid rgba(255,255,255,0.06)',
                boxShadow:
                  'inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.25), 0 2px 2px rgba(0,0,0,0.1), 0 4px 4px rgba(0,0,0,0.1), 0 8px 8px rgba(0,0,0,0.1)',
              }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                  style={{ background: `${stat.color}15` }}
                >
                  <Icon size={18} style={{ color: stat.color }} />
                </div>
              </div>
              <p
                className="text-[12px] uppercase tracking-wider font-medium mb-1"
                style={{ color: '#6b7280' }}
              >
                {stat.label}
              </p>
              <p className="text-[28px] font-bold text-white">{stat.value}</p>
              <p className="text-xs mt-1" style={{ color: '#4b5563' }}>
                —
              </p>
            </div>
          )
        })}
      </div>

      {/* Recent merchants table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: '#111827',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.25), 0 2px 2px rgba(0,0,0,0.1), 0 4px 4px rgba(0,0,0,0.1), 0 8px 8px rgba(0,0,0,0.1)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-sm font-semibold text-white">Recent Merchants</h2>
          <a
            href="/admin/merchants"
            className="text-xs font-medium"
            style={{ color: '#635bff' }}
          >
            View all →
          </a>
        </div>

        {recentMerchants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'rgba(99,91,255,0.1)' }}
            >
              <Mail size={20} style={{ color: '#635bff' }} />
            </div>
            <p className="text-sm text-white font-medium mb-1">No merchants yet</p>
            <a
              href="/admin/invites"
              className="text-xs font-medium"
              style={{ color: '#635bff' }}
            >
              Send your first invite
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Business Name', 'Email', 'Status', 'Stripe Status', 'Volume', 'Joined'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-6 py-3 text-[11px] uppercase tracking-wider font-medium"
                        style={{ color: '#6b7280' }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {recentMerchants.map((m) => (
                  <tr
                    key={m.id}
                    style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="px-6 py-3 text-sm text-white font-medium">
                      {m.businessName}
                    </td>
                    <td className="px-6 py-3 text-sm" style={{ color: '#9ca3af' }}>
                      {m.user.email}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={m.stripeAccountStatus} />
                    </td>
                    <td className="px-6 py-3 text-sm text-white">
                      {formatCurrency(m.totalVolume)}
                    </td>
                    <td className="px-6 py-3 text-sm" style={{ color: '#6b7280' }}>
                      {format(m.createdAt, 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
