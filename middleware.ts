import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'ceo@36west.org'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const path = req.nextUrl.pathname
    if (path.startsWith('/admin')) {
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
        if (
          path.startsWith('/login') ||
          path.startsWith('/invite') ||
          path.startsWith('/api/auth') ||
          path.startsWith('/api/invite') ||
          path === '/'
        ) return true
        return !!token
      }
    }
  }
)

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
