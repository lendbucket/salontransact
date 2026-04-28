import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'ceo@36west.org'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Admin gate
    if (path.startsWith('/admin')) {
      if (token?.email !== ADMIN_EMAIL) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }

    // Email verification gate — unverified users can only access verify-email pages
    if (token && !token.emailVerified) {
      if (
        !path.startsWith('/verify-email') &&
        !path.startsWith('/api/auth')
      ) {
        return NextResponse.redirect(new URL('/verify-email/sent', req.url))
      }
    }

    // Account suspended/rejected gate
    if (
      token?.approvalStatus === 'rejected' ||
      token?.approvalStatus === 'suspended'
    ) {
      if (path !== '/account-suspended' && !path.startsWith('/api/auth')) {
        return NextResponse.redirect(new URL('/account-suspended', req.url))
      }
    }

    // Pending approval gate — pending users can only access onboarding
    if (token?.emailVerified && token?.approvalStatus === 'pending') {
      if (
        !path.startsWith('/onboarding') &&
        !path.startsWith('/api/auth') &&
        !path.startsWith('/api/onboarding')
      ) {
        return NextResponse.redirect(new URL('/onboarding', req.url))
      }
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname
        if (
          path.startsWith('/login') ||
          path.startsWith('/signup') ||
          path.startsWith('/register') ||
          path.startsWith('/invite') ||
          path.startsWith('/forgot-password') ||
          path.startsWith('/reset-password') ||
          path.startsWith('/magic') ||
          path.startsWith('/verify-email') ||
          path.startsWith('/account-suspended') ||
          path.startsWith('/api/auth') ||
          path.startsWith('/api/invite') ||
          path.startsWith('/api/webhooks/payroc') ||
          path.startsWith('/api/cron') ||
          path === '/'
        ) return true
        return !!token
      }
    }
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',]
}
