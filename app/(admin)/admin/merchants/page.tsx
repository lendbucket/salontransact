'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Store, Search, Mail, Loader2 } from 'lucide-react'
import type { MerchantRow } from '@/types'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    green: { bg: '#F0FDF4', text: '#166534', border: '#BBF7D0' },
    yellow: { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
    red: { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA' },
    gray: { bg: '#F9FAFB', text: '#374151', border: '#D1D5DB' },
    purple: { bg: '#E6F4F8', text: '#017ea7', border: '#B0DDE9' },
  }
  const c = colors[color] ?? colors.gray
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
      style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
    >
      {label}
    </span>
  )
}

function stripeColor(status: string): string {
  if (status === 'active') return 'green'
  if (status === 'pending' || status === 'pending_verification') return 'yellow'
  if (status === 'restricted') return 'red'
  return 'gray'
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i} style={{ borderTop: '1px solid #E8EAED' }}>
          {Array.from({ length: 7 }).map((_, j) => (
            <td key={j} className="px-6 py-3">
              <div
                className="h-4 rounded animate-pulse"
                style={{ background: '#E8EAED', width: j === 0 ? '140px' : '80px' }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function MerchantsPage() {
  const router = useRouter()
  const [merchants, setMerchants] = useState<MerchantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<MerchantRow | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/merchants')
      .then((r) => r.json())
      .then((data) => {
        setMerchants(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    if (!search.trim()) return merchants
    const q = search.toLowerCase()
    return merchants.filter(
      (m) =>
        m.businessName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    )
  }, [merchants, search])

  async function handleSuspendActivate(merchant: MerchantRow) {
    const action = merchant.status === 'active' ? 'suspend' : 'activate'
    setActionLoading(merchant.id)
    const res = await fetch(`/api/admin/merchants/${merchant.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      setMerchants((prev) =>
        prev.map((m) =>
          m.id === merchant.id
            ? { ...m, status: action === 'suspend' ? 'suspended' : 'active' }
            : m
        )
      )
    }
    setActionLoading(null)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setActionLoading(deleteTarget.id)
    const res = await fetch(`/api/admin/merchants/${deleteTarget.id}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      setMerchants((prev) => prev.filter((m) => m.id !== deleteTarget.id))
    }
    setDeleteTarget(null)
    setActionLoading(null)
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold" style={{ color: '#1A1313' }}>Merchants</h1>
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ background: '#E6F4F8', color: '#017ea7' }}
          >
            {merchants.length}
          </span>
        </div>
        <button
          onClick={() => router.push('/admin/invites')}
          className="btn-primary btn-md"
        >
          <Mail size={16} strokeWidth={1.5} />
          Send Invite
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: '#878787' }}
        />
        <input
          type="text"
          placeholder="Search merchants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
          style={{
            background: '#FBFBFB',
            border: '1px solid #E8EAED',
            color: '#1A1313',
          }}
        />
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: '#FFFFFF',
          border: '1px solid #E8EAED',
          boxShadow:
            '0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05), 0 16px 16px rgba(0,0,0,0.05)',
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                {['Business Name', 'Email', 'Stripe Status', 'Plan', 'Total Volume', 'Status', 'Actions'].map(
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
              {loading ? (
                <SkeletonRows />
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-16">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                        style={{ background: '#E6F4F8' }}
                      >
                        <Store size={20} style={{ color: '#017ea7' }} />
                      </div>
                      <p className="text-sm font-medium mb-1" style={{ color: '#1A1313' }}>No merchants yet</p>
                      <p className="text-xs" style={{ color: '#878787' }}>
                        Send your first invite to get started.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    style={{ borderTop: '1px solid #E8EAED' }}
                  >
                    <td className="px-6 py-3 text-sm font-medium" style={{ color: '#1A1313' }}>
                      {m.businessName}
                    </td>
                    <td className="px-6 py-3 text-sm" style={{ color: '#878787' }}>
                      {m.email}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        label={m.stripeAccountStatus}
                        color={stripeColor(m.stripeAccountStatus)}
                      />
                    </td>
                    <td className="px-6 py-3">
                      <Badge label={m.plan} color="purple" />
                    </td>
                    <td className="px-6 py-3 text-sm" style={{ color: '#1A1313' }}>
                      {formatCurrency(m.totalVolume)}
                    </td>
                    <td className="px-6 py-3">
                      <Badge
                        label={m.status}
                        color={m.status === 'active' ? 'green' : 'red'}
                      />
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSuspendActivate(m)}
                          disabled={actionLoading === m.id}
                          className={m.status === 'active' ? 'btn-warning btn-sm' : 'btn-secondary btn-sm'}
                        >
                          {actionLoading === m.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : m.status === 'active' ? (
                            'Suspend'
                          ) : (
                            'Activate'
                          )}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(m)}
                          className="btn-danger btn-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
        >
          <div
            className="w-full max-w-md rounded-xl p-6"
            style={{
              background: '#FFFFFF',
              border: '1px solid #E8EAED',
            }}
          >
            <h3 className="text-lg font-semibold mb-2" style={{ color: '#1A1313' }}>Are you sure?</h3>
            <p className="text-sm mb-1" style={{ color: '#878787' }}>
              You are about to permanently delete{' '}
              <strong style={{ color: '#1A1313' }}>{deleteTarget.businessName}</strong>.
            </p>
            <p className="text-sm mb-6" style={{ color: '#ef4444' }}>
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="btn-secondary btn-md"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading === deleteTarget.id}
                className="btn-danger btn-md"
              >
                {actionLoading === deleteTarget.id && (
                  <Loader2 size={14} className="animate-spin" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
