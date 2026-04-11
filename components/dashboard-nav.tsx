"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CreditCard,
  Wallet,
  KeyRound,
  Webhook,
  Settings,
  LogOut,
} from "lucide-react";

type NavLink = { href: string; label: string; icon: typeof LayoutDashboard };

const links: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", icon: CreditCard },
  { href: "/payouts", label: "Payouts", icon: Wallet },
  { href: "/api-keys", label: "API Keys", icon: KeyRound },
  { href: "/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  businessName,
  plan,
}: {
  businessName: string;
  plan: string;
}) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:flex-col w-64 border-r min-h-screen p-4 gap-2">
      <div className="px-3 py-4 mb-2">
        <h1 className="text-lg font-semibold text-white">SalonTransact</h1>
        <p className="text-xs mt-0.5" style={{ color: "#606E74" }}>
          Powered by Reyna Pay
        </p>
      </div>

      <div className="card p-3 mb-4">
        <p className="text-sm font-medium text-white truncate">
          {businessName}
        </p>
        <span
          className="inline-block mt-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
          style={{
            color: "#7a8f96",
            background: "rgba(122,143,150,0.12)",
            border: "1px solid #1a2332",
          }}
        >
          {plan} plan
        </span>
      </div>

      <nav className="flex flex-col gap-1 flex-1">
        {links.map((link: NavLink) => {
          const Icon = link.icon;
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: active ? "rgba(122,143,150,0.1)" : "transparent",
                color: active ? "#e6edf3" : "#8b949e",
              }}
            >
              <Icon className="w-4 h-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted hover:text-white transition-colors"
      >
        <LogOut className="w-4 h-4" />
        Sign out
      </button>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const mobileLinks = links.slice(0, 5);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 border-t flex justify-around z-50"
      style={{ background: "#0d1117" }}
    >
      {mobileLinks.map((link: NavLink) => {
        const Icon = link.icon;
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center justify-center py-3 px-2 flex-1 text-[10px] font-medium"
            style={{ color: active ? "#7a8f96" : "#8b949e" }}
          >
            <Icon className="w-5 h-5 mb-1" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
