'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Loader2, ShieldX } from 'lucide-react'

export default function MagicLinkPage() {
  const params = useParams<{ token: string }>()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function verify() {
      try {
        const res = await fetch('/api/auth/magic-verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: params.token }),
        })
        const data = await res.json()

        if (!res.ok) {
          setError(data.error || 'This link is invalid')
          return
        }

        // Sign in using the MAGIC: prefix flow
        const signInRes = await signIn('credentials', {
          email: data.email,
          password: `MAGIC:${data.code}`,
          redirect: false,
        })

        if (signInRes?.error) {
          setError('Sign in failed. Please try again.')
          return
        }

        // Redirect based on role — the home page handles this
        window.location.href = '/dashboard'
      } catch {
        setError('Something went wrong. Please try again.')
      }
    }

    verify()
  }, [params.token])

  if (error) {
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
        <h1 className="text-2xl font-bold text-white mb-2">Link Invalid</h1>
        <p
          className="text-sm text-center mb-6"
          style={{ color: '#6b7280', maxWidth: 360 }}
        >
          {error}
        </p>
        <a
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white"
          style={{ background: '#635bff' }}
        >
          Request a new link
        </a>
      </div>
    )
  }

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
        Signing you in...
      </p>
    </div>
  )
}
