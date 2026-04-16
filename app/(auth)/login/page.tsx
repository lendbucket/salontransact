'use client'

import { useState, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2, Eye, EyeOff, Shield, Lock, Check, Mail, Zap } from 'lucide-react'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4" />
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853" />
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z" fill="#FBBC05" />
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.166 6.656 3.58 9 3.58Z" fill="#EA4335" />
    </svg>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const passwordUpdated = searchParams.get('message') === 'password-updated'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)
  const [magicError, setMagicError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    })

    setLoading(false)

    if (res?.error) {
      setError('Invalid email or password')
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  function handleGoogleSignIn() {
    setGoogleLoading(true)
    signIn('google', { callbackUrl: '/dashboard' })
  }

  async function handleMagicLink() {
    if (!email) {
      setMagicError('Enter your email first')
      return
    }
    setMagicError(null)
    setMagicLoading(true)

    const res = await fetch('/api/auth/magic-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    setMagicLoading(false)

    if (!res.ok) {
      setMagicError(data.error || 'Failed to send magic link')
      return
    }

    setMagicSent(true)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 relative overflow-hidden"
      style={{ background: '#0a0f1a' }}
    >
      {/* Animated orbs */}
      <div className="auth-orb auth-orb-1" />
      <div className="auth-orb auth-orb-2" />
      <div className="auth-orb auth-orb-3" />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Logo */}
        <div className="flex flex-col items-center gap-1 mb-10">
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{
                background: '#635bff',
                filter: 'drop-shadow(0 0 24px rgba(99,91,255,0.5))',
              }}
            >
              <span className="text-white font-bold text-xl">ST</span>
            </div>
            <span
              className="text-white font-semibold text-[22px]"
              style={{ letterSpacing: '-0.5px' }}
            >
              SalonTransact
            </span>
          </div>
          <span className="text-xs" style={{ color: '#6b7280' }}>
            by Reyna Pay
          </span>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1
            className="text-[32px] font-bold text-white mb-2"
            style={{ letterSpacing: '-0.8px' }}
          >
            Welcome back
          </h1>
          <p className="text-[15px]" style={{ color: '#6b7280' }}>
            Sign in to your merchant portal
          </p>
        </div>

        {/* Password updated success */}
        {passwordUpdated && (
          <div
            className="text-sm rounded-xl px-3 py-2.5 mb-4 text-center"
            style={{
              color: '#22c55e',
              background: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.15)',
            }}
          >
            Password updated. Sign in with your new password.
          </div>
        )}

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="auth-btn-google"
        >
          {googleLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          Continue with Google
        </button>

        {/* Divider */}
        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* Form */}
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label
              className="block text-sm font-medium mb-1.5"
              style={{ color: '#9ca3af' }}
            >
              Email address
            </label>
            <div className="relative">
              <Mail
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2"
                style={{ color: '#4b5563' }}
              />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="auth-input"
                style={{ paddingLeft: 40 }}
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                className="block text-sm font-medium"
                style={{ color: '#9ca3af' }}
              >
                Password
              </label>
              <a
                href="/forgot-password"
                className="text-[13px] font-medium"
                style={{ color: '#635bff' }}
              >
                Forgot password?
              </a>
            </div>
            <div className="relative">
              <Lock
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2"
                style={{ color: '#4b5563' }}
              />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="auth-input"
                style={{ paddingLeft: 40, paddingRight: 44 }}
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer"
                style={{ color: '#6b7280' }}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-[13px] text-center" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="auth-btn-primary"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Sign in
          </button>
        </form>

        {/* Magic link divider */}
        <div className="auth-divider">
          <span>or</span>
        </div>

        {/* Magic link */}
        {magicSent ? (
          <div
            className="flex flex-col items-center gap-3 py-6 rounded-xl"
            style={{
              background: '#111827',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(99,91,255,0.12)' }}
            >
              <Mail className="w-5 h-5" style={{ color: '#635bff' }} />
            </div>
            <p className="text-sm text-center px-4" style={{ color: '#22c55e' }}>
              Magic link sent! Check your inbox.
            </p>
            <p className="text-xs text-center px-4" style={{ color: '#6b7280' }}>
              Sent to <strong className="text-white">{email}</strong>
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={handleMagicLink}
              disabled={magicLoading}
              className="w-full flex items-center justify-center gap-2 cursor-pointer"
              style={{
                height: 48,
                borderRadius: '0.75rem',
                border: '1px solid rgba(255,255,255,0.08)',
                background: 'transparent',
                color: '#f9fafb',
                fontWeight: 600,
                fontSize: 14,
              }}
            >
              {magicLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap size={16} style={{ color: '#635bff' }} />
              )}
              Send magic link
            </button>
            {magicError && (
              <p
                className="text-[13px] text-center mt-2"
                style={{ color: '#ef4444' }}
              >
                {magicError}
              </p>
            )}
          </>
        )}

        {/* Footer */}
        <p
          className="text-xs text-center mt-8"
          style={{ color: '#4b5563' }}
        >
          Access is by invitation only.
        </p>

        {/* Trust badges */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {[
            { icon: Shield, label: 'PCI DSS' },
            { icon: Lock, label: '256-bit SSL' },
            { icon: Check, label: 'Stripe Verified' },
          ].map((b) => {
            const Icon = b.icon
            return (
              <div
                key={b.label}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{
                  background: '#111827',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <Icon className="w-3 h-3" style={{ color: '#6b7280' }} />
                <span
                  className="text-[11px] font-medium"
                  style={{ color: '#6b7280' }}
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
