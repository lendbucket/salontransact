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
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    active: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
    pending: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
    restricted: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
    suspended: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
    incomplete: { bg: '#F9FAFB', text: '#374151', border: '#D1D5DB' },
  }
  const c = colors[status] ?? colors.incomplete
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
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
      color: '#017ea7',
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
      color: '#017ea7',
    },
  ]

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: '#1A1313' }}>Admin Overview</h1>
        <span className="text-sm" style={{ color: '#878787' }}>
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
                background: '#FFFFFF',
                border: '1px solid #E8EAED',
                boxShadow:
                  '0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05), 0 16px 16px rgba(0,0,0,0.05)',
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
                style={{ color: '#878787' }}
              >
                {stat.label}
              </p>
              <p className="text-[28px] font-bold" style={{ color: '#1A1313' }}>{stat.value}</p>
              <p className="text-xs mt-1" style={{ color: '#878787' }}>
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
          background: '#FFFFFF',
          border: '1px solid #E8EAED',
          boxShadow:
            '0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05), 0 16px 16px rgba(0,0,0,0.05)',
        }}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-sm font-semibold" style={{ color: '#1A1313' }}>Recent Merchants</h2>
          <a
            href="/admin/merchants"
            className="text-xs font-medium"
            style={{ color: '#017ea7' }}
          >
            View all →
          </a>
        </div>

        {recentMerchants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
              style={{ background: '#E6F4F8' }}
            >
              <Mail size={20} style={{ color: '#017ea7' }} />
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: '#1A1313' }}>No merchants yet</p>
            <a
              href="/admin/invites"
              className="text-xs font-medium"
              style={{ color: '#017ea7' }}
            >
              Send your first invite
            </a>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderTop: '1px solid #E8EAED' }}>
                  {['Business Name', 'Email', 'Status', 'Stripe Status', 'Volume', 'Joined'].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-6 py-3 text-[11px] uppercase tracking-wider font-medium"
                        style={{ color: '#878787' }}
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
                    style={{ borderTop: '1px solid #E8EAED' }}
                  >
                    <td className="px-6 py-3 text-sm font-medium" style={{ color: '#1A1313' }}>
                      {m.businessName}
                    </td>
                    <td className="px-6 py-3 text-sm" style={{ color: '#878787' }}>
                      {m.user.email}
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={m.status} />
                    </td>
                    <td className="px-6 py-3">
                      <StatusBadge status={m.stripeAccountStatus} />
                    </td>
                    <td className="px-6 py-3 text-sm" style={{ color: '#1A1313' }}>
                      {formatCurrency(m.totalVolume)}
                    </td>
                    <td className="px-6 py-3 text-sm" style={{ color: '#878787' }}>
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
