'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Store,
  Mail,
  Settings,
  LogOut,
} from 'lucide-react'

const navItems = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/merchants', label: 'Merchants', icon: Store },
  { href: '/admin/invites', label: 'Invites', icon: Mail },
  { href: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname()

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex md:flex-col w-60 min-h-screen p-4 gap-1"
        style={{
          background: '#0d1117',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-3 pt-2 pb-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: '#635bff' }}
          >
            <span className="text-white font-bold text-sm">ST</span>
          </div>
          <span className="text-white font-semibold text-[16px]">SalonTransact</span>
        </div>

        {/* Admin badge */}
        <div className="px-3 mb-4">
          <span
            className="inline-block text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium"
            style={{
              color: '#ef4444',
              background: 'rgba(239,68,68,0.12)',
            }}
          >
            Admin Panel
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium relative"
                style={{
                  background: active ? 'rgba(99,91,255,0.12)' : 'transparent',
                  color: active ? '#635bff' : '#9ca3af',
                  transition: 'all 150ms ease',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                {active && (
                  <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r"
                    style={{ background: '#635bff' }}
                  />
                )}
                <Icon size={16} strokeWidth={1.5} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div
          className="pt-3 mt-2"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-white truncate">{email}</p>
              <p className="text-[10px]" style={{ color: '#6b7280' }}>
                Admin
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="cursor-pointer"
              style={{ color: '#6b7280' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#f9fafb')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
              aria-label="Sign out"
            >
              <LogOut size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around z-50"
        style={{
          background: '#0d1117',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const active =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center py-3 px-2 flex-1 text-[10px] font-medium"
              style={{ color: active ? '#635bff' : '#6b7280' }}
            >
              <Icon size={20} strokeWidth={1.5} className="mb-1" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </>
  )
}
