'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Store, Search, Mail, Loader2 } from 'lucide-react'
import type { MerchantRow } from '@/types'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    green: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
    yellow: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
    red: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
    gray: { bg: 'rgba(107,114,128,0.12)', text: '#6b7280' },
    purple: { bg: 'rgba(99,91,255,0.12)', text: '#635bff' },
  }
  const c = colors[color] ?? colors.gray
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium capitalize"
      style={{ background: c.bg, color: c.text }}
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
        <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          {Array.from({ length: 7 }).map((_, j) => (
            <td key={j} className="px-6 py-3">
              <div
                className="h-4 rounded animate-pulse"
                style={{ background: 'rgba(255,255,255,0.06)', width: j === 0 ? '140px' : '80px' }}
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
          <h1 className="text-2xl font-semibold text-white">Merchants</h1>
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
            style={{ background: 'rgba(99,91,255,0.12)', color: '#635bff' }}
          >
            {merchants.length}
          </span>
        </div>
        <button
          onClick={() => router.push('/admin/invites')}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer"
          style={{ background: '#635bff' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#4f46e5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#635bff')}
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
          style={{ color: '#6b7280' }}
        />
        <input
          type="text"
          placeholder="Search merchants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
          style={{
            background: '#111827',
            border: '1px solid rgba(255,255,255,0.06)',
            color: '#f9fafb',
          }}
        />
      </div>

      {/* Table */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: '#111827',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow:
            'inset 0 1px 0 rgba(255,255,255,0.02), inset 0 0 0 1px rgba(255,255,255,0.02), 0 0 0 1px rgba(0,0,0,0.25), 0 2px 2px rgba(0,0,0,0.1), 0 4px 4px rgba(0,0,0,0.1), 0 8px 8px rgba(0,0,0,0.1)',
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
                      style={{ color: '#6b7280' }}
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
                        style={{ background: 'rgba(99,91,255,0.1)' }}
                      >
                        <Store size={20} style={{ color: '#635bff' }} />
                      </div>
                      <p className="text-sm text-white font-medium mb-1">No merchants yet</p>
                      <p className="text-xs" style={{ color: '#6b7280' }}>
                        Send your first invite to get started.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <td className="px-6 py-3 text-sm text-white font-medium">
                      {m.businessName}
                    </td>
                    <td className="px-6 py-3 text-sm" style={{ color: '#9ca3af' }}>
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
                    <td className="px-6 py-3 text-sm text-white">
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
                          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                          style={{
                            border: `1px solid ${m.status === 'active' ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                            color: m.status === 'active' ? '#f59e0b' : '#22c55e',
                            background: 'transparent',
                          }}
                          onMouseEnter={(e) => {
                            if (m.status === 'active') {
                              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)'
                              e.currentTarget.style.color = '#ef4444'
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (m.status === 'active') {
                              e.currentTarget.style.borderColor = 'rgba(245,158,11,0.3)'
                              e.currentTarget.style.color = '#f59e0b'
                            }
                          }}
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
                          className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                          style={{
                            border: '1px solid rgba(239,68,68,0.3)',
                            color: '#ef4444',
                            background: 'transparent',
                          }}
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
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <h3 className="text-lg font-semibold text-white mb-2">Are you sure?</h3>
            <p className="text-sm mb-1" style={{ color: '#9ca3af' }}>
              You are about to permanently delete{' '}
              <strong className="text-white">{deleteTarget.businessName}</strong>.
            </p>
            <p className="text-sm mb-6" style={{ color: '#ef4444' }}>
              This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: '#9ca3af',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={actionLoading === deleteTarget.id}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer inline-flex items-center gap-2"
                style={{ background: '#ef4444' }}
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
