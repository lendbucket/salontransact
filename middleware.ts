import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import { ADMIN_EMAIL } from '@/lib/admin'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname

    // Admin routes — must be admin email
    if (path.startsWith('/admin') || path.startsWith('/merchants') || path.startsWith('/invites')) {
      if (token?.email !== ADMIN_EMAIL) {
        return NextResponse.redirect(new URL('/dashboard', req.url))
      }
    }
    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const path = req.nextUrl.pathname
        // Public paths
        if (
          path.startsWith('/login') ||
          path.startsWith('/register') ||
          path.startsWith('/invite') ||
          path.startsWith('/api/auth') ||
          path.startsWith('/api/invite')
        ) return true
        // All other paths require auth
        return !!token
      }
    }
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)']
}
