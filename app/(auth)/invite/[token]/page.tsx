'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2, Eye, EyeOff, ShieldX, Shield, Lock, Check } from 'lucide-react'

export default function InviteRedeemPage() {
  const params = useParams<{ token: string }>()
  const router = useRouter()

  const [status, setStatus] = useState<'loading' | 'valid' | 'error'>('loading')
  const [inviteEmail, setInviteEmail] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const [businessName, setBusinessName] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/invite/validate/${params.token}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) {
          setStatus('error')
          setErrorMessage(data.error || 'Invalid invitation')
          return
        }
        setInviteEmail(data.email)
        setStatus('valid')
      })
      .catch(() => {
        setStatus('error')
        setErrorMessage('Failed to validate invitation')
      })
  }, [params.token])

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    if (password !== confirm) {
      setFormError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters')
      return
    }

    setSubmitting(true)

    const res = await fetch('/api/invite/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: params.token, businessName, password }),
    })
    const data = await res.json()

    if (!res.ok) {
      setFormError(data.error || 'Failed to create account')
      setSubmitting(false)
      return
    }

    const signInRes = await signIn('credentials', {
      email: inviteEmail,
      password,
      redirect: false,
    })

    if (signInRes?.error) {
      router.push('/login')
      return
    }

    router.push('/onboarding')
    router.refresh()
  }

  // Loading state
  if (status === 'loading') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: '#0a0f1a' }}
      >
        <Loader2
          size={32}
          className="animate-spin mb-4"
          style={{ color: '#635bff' }}
        />
        <p className="text-sm" style={{ color: '#6b7280' }}>
          Validating your invitation...
        </p>
      </div>
    )
  }

  // Error state
  if (status === 'error') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4"
        style={{ background: '#0a0f1a' }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
          style={{ background: 'rgba(239,68,68,0.12)' }}
        >
          <ShieldX size={28} style={{ color: '#ef4444' }} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Invalid Invitation</h1>
        <p className="text-sm text-center mb-6" style={{ color: '#6b7280', maxWidth: 360 }}>
          {errorMessage}
        </p>
        <a
          href="mailto:ceo@36west.org"
          className="text-xs font-medium"
          style={{ color: '#635bff' }}
        >
          Contact your administrator at ceo@36west.org
        </a>
      </div>
    )
  }

  // Valid — show form
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative overflow-hidden"
      style={{ background: '#0a0f1a' }}
    >
      {/* Animated orbs */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: '#635bff',
              filter: 'drop-shadow(0 0 20px rgba(99,91,255,0.4))',
            }}
          >
            <span className="text-white font-bold text-lg">ST</span>
          </div>
          <span className="text-white font-semibold text-xl">SalonTransact</span>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1
            className="text-[32px] font-bold text-white mb-2"
            style={{ letterSpacing: '-0.5px' }}
          >
            You&apos;ve been invited
          </h1>
          <p className="text-[15px]" style={{ color: '#6b7280' }}>
            Create your SalonTransact merchant account
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {/* Email (disabled) */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#9ca3af' }}
            >
              Email address
            </label>
            <input
              type="email"
              disabled
              value={inviteEmail}
              className="auth-input"
              style={{
                background: 'rgba(255,255,255,0.04)',
                color: '#4b5563',
                cursor: 'not-allowed',
              }}
            />
          </div>

          {/* Business name */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#9ca3af' }}
            >
              Business name
            </label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="auth-input"
              placeholder="Your salon name"
            />
          </div>

          {/* Password */}
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#9ca3af' }}
            >
              Password
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
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
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
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirm.length > 0 && password !== confirm && (
              <p className="text-xs mt-1.5" style={{ color: '#ef4444' }}>
                Passwords do not match
              </p>
            )}
          </div>

          {formError && (
            <div
              className="text-sm rounded-xl px-3 py-2.5"
              style={{
                color: '#ef4444',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.15)',
              }}
            >
              {formError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="auth-btn-primary"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Create Account
          </button>
        </form>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-3 mt-10">
          {[
            { icon: Shield, label: 'PCI DSS' },
            { icon: Lock, label: '256-bit SSL' },
            { icon: Check, label: 'Stripe Verified' },
          ].map((b) => {
            const Icon = b.icon
            return (
              <div
                key={b.label}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Icon className="w-3 h-3" style={{ color: '#635bff' }} />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: '#4b5563' }}
                >
                  {b.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
