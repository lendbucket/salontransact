import { requireAdmin } from '@/lib/admin'
import { AdminNav } from './admin-nav'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requireAdmin()

  return (
    <div className="flex min-h-screen" style={{ background: '#0a0f1a' }}>
      <AdminNav email={session.user!.email!} />
      <main className="flex-1 pb-20 md:pb-0">{children}</main>
    </div>
  )
}
