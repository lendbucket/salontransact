'use client'

import { useState } from 'react'
import { ArrowLeft, KeyRound, Loader2, CheckCircle } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      return
    }

    setSent(true)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: '#0a0f1a' }}
    >
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Back link */}
        <a
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium mb-8"
          style={{ color: '#635bff' }}
        >
          <ArrowLeft size={16} />
          Back to sign in
        </a>

        {sent ? (
          <div className="text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: 'rgba(34,197,94,0.12)' }}
            >
              <CheckCircle size={28} style={{ color: '#22c55e' }} />
            </div>
            <h1
              className="text-2xl font-bold text-white mb-3"
              style={{ letterSpacing: '-0.5px' }}
            >
              Check your email
            </h1>
            <p className="text-sm mb-8" style={{ color: '#6b7280' }}>
              We sent a password reset link to{' '}
              <strong className="text-white">{email}</strong>
            </p>
            <a
              href="/login"
              className="text-sm font-medium"
              style={{ color: '#635bff' }}
            >
              Back to sign in
            </a>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
                style={{ background: 'rgba(99,91,255,0.12)' }}
              >
                <KeyRound size={24} style={{ color: '#635bff' }} />
              </div>
              <h1
                className="text-[28px] font-bold text-white mb-2"
                style={{ letterSpacing: '-0.5px' }}
              >
                Forgot your password?
              </h1>
              <p className="text-[15px]" style={{ color: '#6b7280' }}>
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                placeholder="you@example.com"
              />

              {error && (
                <div
                  className="text-sm rounded-xl px-3 py-2.5"
                  style={{
                    color: '#ef4444',
                    background: 'rgba(239,68,68,0.08)',
                    border: '1px solid rgba(239,68,68,0.15)',
                  }}
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="auth-btn-primary"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Send Reset Link
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
