"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
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
  const { data: session } = useSession();

  return (
    <aside
      className="hidden md:flex md:flex-col w-64 border-r border-[#1a2332] min-h-screen p-4 gap-2"
      style={{ background: "#0a2540" }}
    >
      <div className="px-3 py-4 mb-2">
        <h1 className="text-lg font-bold" style={{ color: "#635bff" }}>
          SalonTransact
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "#8898aa" }}>
          Powered by Reyna Pay
        </p>
      </div>

      <div
        className="p-3 mb-4 rounded-lg"
        style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <p className="text-sm font-medium text-white truncate">
          {businessName}
        </p>
        <span
          className="inline-block mt-1.5 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
          style={{
            color: "#8898aa",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
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
                background: active ? "rgba(99,91,255,0.1)" : "transparent",
                color: active ? "#635bff" : "#8898aa",
              }}
            >
              <Icon className="w-4 h-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[rgba(255,255,255,0.08)] pt-3 mt-2">
        {session?.user?.email && (
          <p
            className="text-xs truncate px-3 mb-2"
            style={{ color: "#8898aa" }}
          >
            {session.user.email}
          </p>
        )}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors w-full"
          style={{ color: "#8898aa" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#8898aa")}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const mobileLinks = links.slice(0, 5);

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 border-t border-[#1a2332] flex justify-around z-50"
      style={{ background: "#0a2540" }}
    >
      {mobileLinks.map((link: NavLink) => {
        const Icon = link.icon;
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center justify-center py-3 px-2 flex-1 text-[10px] font-medium"
            style={{ color: active ? "#635bff" : "#8898aa" }}
          >
            <Icon className="w-5 h-5 mb-1" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
