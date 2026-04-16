import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const ADMIN_EMAIL = 'ceo@36west.org'

export async function requireAdmin() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) redirect('/login')
  if (session.user.email !== ADMIN_EMAIL) redirect('/dashboard')
  return session
}

export function isAdminEmail(email: string): boolean {
  return email === ADMIN_EMAIL
}
