'use client'

import { useState, useEffect } from 'react'
import { Mail, Check, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import type { InviteRow } from '@/types'

function statusOf(inv: InviteRow): { label: string; color: string } {
  if (inv.used) return { label: 'Accepted', color: 'green' }
  if (inv.isExpired) return { label: 'Expired', color: 'red' }
  return { label: 'Pending', color: 'yellow' }
}

function Badge({ label, color }: { label: string; color: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    green: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
    yellow: { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' },
    red: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' },
  }
  const c = colors[color] ?? colors.red
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium"
      style={{ background: c.bg, color: c.text }}
    >
      {label}
    </span>
  )
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sendSuccess, setSendSuccess] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  async function loadInvites() {
    const res = await fetch('/api/admin/invite')
    if (res.ok) {
      const data = await res.json()
      setInvites(data)
    }
    setLoading(false)
  }

  useEffect(() => {
    loadInvites()
  }, [])

  const pending = invites.filter((i) => !i.used && !i.isExpired).length
  const used = invites.filter((i) => i.used).length
  const expired = invites.filter((i) => !i.used && i.isExpired).length

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setSendError(null)
    setSendSuccess(null)

    const res = await fetch('/api/admin/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()

    if (!res.ok) {
      setSendError(data.error || 'Failed to send invite')
      setSending(false)
      return
    }

    setSendSuccess(email)
    setEmail('')
    setSending(false)
    await loadInvites()
    setTimeout(() => {
      setSendSuccess(null)
      setShowForm(false)
    }, 3000)
  }

  async function handleResend(inviteId: string) {
    setActionLoading(inviteId)
    await fetch('/api/admin/invite/resend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId }),
    })
    await loadInvites()
    setActionLoading(null)
  }

  async function handleRevoke(inviteId: string) {
    setActionLoading(inviteId)
    // Optimistic update
    setInvites((prev) =>
      prev.map((i) =>
        i.id === inviteId ? { ...i, used: true, usedAt: new Date().toISOString() } : i
      )
    )
    const res = await fetch('/api/admin/invite/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId }),
    })
    if (!res.ok) {
      await loadInvites() // revert on error
    }
    setActionLoading(null)
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-semibold text-white">Invites</h1>
          <span className="text-sm" style={{ color: '#6b7280' }}>
            {pending} pending · {used} used · {expired} expired
          </span>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm)
            setSendError(null)
            setSendSuccess(null)
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer"
          style={{ background: '#635bff' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = '#4f46e5')}
          onMouseLeave={(e) => (e.currentTarget.style.background = '#635bff')}
        >
          <Mail size={16} strokeWidth={1.5} />
          Send Invite
        </button>
      </div>

      {/* Invite form */}
      {showForm && (
        <div
          className="rounded-xl p-6 mb-6"
          style={{
            background: '#111827',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {sendSuccess ? (
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.12)' }}
              >
                <Check size={16} style={{ color: '#22c55e' }} />
              </div>
              <p className="text-sm text-white">
                Invite sent to <strong>{sendSuccess}</strong>
              </p>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex flex-col sm:flex-row gap-3">
              <input
                type="email"
                required
                placeholder="merchant@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm"
                style={{
                  background: '#0a0f1a',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#f9fafb',
                }}
              />
              <button
                type="submit"
                disabled={sending}
                className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer"
                style={{ background: '#635bff', minWidth: '160px' }}
              >
                {sending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  'Send Invitation'
                )}
              </button>
            </form>
          )}
          {sendError && (
            <p className="text-sm mt-3" style={{ color: '#ef4444' }}>
              {sendError}
            </p>
          )}
        </div>
      )}

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
                {['Email', 'Sent', 'Expires', 'Status', 'Actions'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-6 py-3 text-[11px] uppercase tracking-wider font-medium"
                    style={{ color: '#6b7280' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  {[0, 1, 2].map((i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                      {[0, 1, 2, 3, 4].map((j) => (
                        <td key={j} className="px-6 py-3">
                          <div
                            className="h-4 rounded animate-pulse"
                            style={{ background: 'rgba(255,255,255,0.06)', width: j === 0 ? '180px' : '80px' }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ) : invites.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="flex flex-col items-center justify-center py-16">
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                        style={{ background: 'rgba(99,91,255,0.1)' }}
                      >
                        <Mail size={20} style={{ color: '#635bff' }} />
                      </div>
                      <p className="text-sm text-white font-medium mb-1">
                        No invites sent yet
                      </p>
                      <p className="text-xs" style={{ color: '#6b7280' }}>
                        Invite your first merchant.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                invites.map((inv) => {
                  const s = statusOf(inv)
                  const isPending = !inv.used && !inv.isExpired
                  return (
                    <tr
                      key={inv.id}
                      style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <td className="px-6 py-3 text-sm text-white">{inv.email}</td>
                      <td className="px-6 py-3 text-sm" style={{ color: '#6b7280' }}>
                        {format(new Date(inv.createdAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-3 text-sm" style={{ color: '#6b7280' }}>
                        {format(new Date(inv.expiresAt), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-3">
                        <Badge label={s.label} color={s.color} />
                      </td>
                      <td className="px-6 py-3">
                        {isPending ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleResend(inv.id)}
                              disabled={actionLoading === inv.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                              style={{
                                border: '1px solid rgba(99,91,255,0.3)',
                                color: '#635bff',
                                background: 'transparent',
                              }}
                            >
                              {actionLoading === inv.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                'Resend'
                              )}
                            </button>
                            <button
                              onClick={() => handleRevoke(inv.id)}
                              disabled={actionLoading === inv.id}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                              style={{
                                border: '1px solid rgba(239,68,68,0.3)',
                                color: '#ef4444',
                                background: 'transparent',
                              }}
                            >
                              Revoke
                            </button>
                          </div>
                        ) : (
                          <span className="text-sm" style={{ color: '#4b5563' }}>
                            —
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
