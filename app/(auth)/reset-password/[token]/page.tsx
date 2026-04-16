'use client'

import { useState, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Lock, Loader2, Eye, EyeOff } from 'lucide-react'

const STRENGTH_COLORS = ['#ef4444', '#f59e0b', '#635bff', '#22c55e']
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']

function passwordStrength(pw: string): number {
  if (pw.length === 0) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}

export default function ResetPasswordPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = useMemo(() => passwordStrength(password), [password])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: params.token,
        password,
        confirmPassword: confirm,
      }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Something went wrong')
      return
    }

    router.push('/login?message=password-updated')
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
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(99,91,255,0.12)' }}
          >
            <Lock size={24} style={{ color: '#635bff' }} />
          </div>
          <h1
            className="text-[28px] font-bold text-white mb-2"
            style={{ letterSpacing: '-0.5px' }}
          >
            Set new password
          </h1>
          <p className="text-[15px]" style={{ color: '#6b7280' }}>
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Password */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#9ca3af' }}
            >
              New password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                style={{ paddingRight: 44 }}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                style={{ color: '#6b7280' }}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {password.length > 0 && (
              <div className="mt-2.5 flex items-center gap-2">
                <div className="flex gap-1 flex-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="strength-segment"
                      style={{
                        background:
                          i < strength
                            ? STRENGTH_COLORS[strength - 1]
                            : 'rgba(255,255,255,0.06)',
                      }}
                    />
                  ))}
                </div>
                <span
                  className="text-[10px] font-medium"
                  style={{
                    color:
                      strength > 0
                        ? STRENGTH_COLORS[strength - 1]
                        : '#4b5563',
                  }}
                >
                  {STRENGTH_LABELS[strength]}
                </span>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#9ca3af' }}
            >
              Confirm password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="auth-input"
                style={{ paddingRight: 44 }}
                placeholder="Confirm your password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                style={{ color: '#6b7280' }}
              >
                {showConfirm ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {confirm.length > 0 && password !== confirm && (
              <p className="text-xs mt-1.5" style={{ color: '#ef4444' }}>
                Passwords do not match
              </p>
            )}
          </div>

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
              {(error.includes('expired') || error.includes('invalid')) && (
                <a
                  href="/forgot-password"
                  className="block mt-2 font-medium"
                  style={{ color: '#635bff' }}
                >
                  Request a new link
                </a>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-btn-primary"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Update Password
          </button>
        </form>
      </div>
    </div>
  )
}
