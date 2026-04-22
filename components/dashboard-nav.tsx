"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard,
  CreditCard,
  TrendingUp,
  ArrowLeftRight,
  Wallet,
  AlertCircle,
  KeyRound,
  Webhook,
  FileText,
  Settings,
  HelpCircle,
  LogOut,
  Search,
  Menu,
} from "lucide-react";

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  section: string;
};

const links: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { href: "/checkout", label: "New Payment", icon: CreditCard, section: "Overview" },
  { href: "/analytics", label: "Analytics", icon: TrendingUp, section: "Overview" },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, section: "Payments" },
  { href: "/payouts", label: "Payouts", icon: Wallet, section: "Payments" },
  { href: "/disputes", label: "Disputes", icon: AlertCircle, section: "Payments" },
  { href: "/api-keys", label: "API Keys", icon: KeyRound, section: "Developers" },
  { href: "/webhooks", label: "Webhooks", icon: Webhook, section: "Developers" },
  { href: "/logs", label: "Logs", icon: FileText, section: "Developers" },
  { href: "/settings", label: "Settings", icon: Settings, section: "Account" },
  { href: "/support", label: "Support", icon: HelpCircle, section: "Account" },
];

const sections = ["Overview", "Payments", "Developers", "Account"];

export function Sidebar({
  businessName,
  plan,
}: {
  businessName: string;
  plan: string;
}) {
  const pathname = usePathname();
  const { data: session } = useSession();

  const initials = (session?.user?.name ?? session?.user?.email ?? "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      className="hidden md:flex md:flex-col w-60 min-h-screen p-4 gap-1"
      style={{
        background: "#0d1117",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 pt-2 pb-4">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: "#635bff" }}
        >
          <span className="text-white font-bold text-sm">ST</span>
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm">SalonTransact</p>
        </div>
      </div>

      {/* Business name + plan */}
      <div className="px-3 mb-3">
        <p className="text-xs text-secondary truncate">{businessName}</p>
        <span
          className="inline-block mt-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium"
          style={{
            color: "#635bff",
            background: "rgba(99,91,255,0.1)",
          }}
        >
          {plan}
        </span>
      </div>

      {/* Search */}
      <div className="px-1 mb-3">
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
          style={{ background: "#111827" }}
        >
          <Search className="w-4 h-4 text-muted" />
          <span className="text-xs text-muted flex-1">Search...</span>
          <kbd
            className="text-[9px] px-1 py-0.5 rounded font-mono"
            style={{
              color: "#4b5563",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            /
          </kbd>
        </div>
      </div>

      {/* Nav sections */}
      <nav className="flex flex-col gap-0.5 flex-1">
        {sections.map((section) => (
          <div key={section} className="mb-1">
            <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted font-medium">
              {section}
            </p>
            {links
              .filter((l) => l.section === section)
              .map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors relative"
                    style={{
                      background: active
                        ? "rgba(99,91,255,0.12)"
                        : "transparent",
                      color: active ? "#635bff" : "#9ca3af",
                    }}
                    onMouseEnter={(e) => {
                      if (!active)
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r"
                        style={{ background: "#635bff" }}
                      />
                    )}
                    <Icon className="w-4 h-4" />
                    {link.label}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      {/* User section */}
      <div
        className="pt-3 mt-2"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3 px-3 py-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
            style={{ background: "#635bff" }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-foreground truncate">
              {session?.user?.name ?? "User"}
            </p>
            <p className="text-[10px] text-muted truncate">
              {session?.user?.email}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-muted cursor-pointer"
            aria-label="Sign out"
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "#f9fafb")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "#6b7280")
            }
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const mobileLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/transactions", label: "Transactions", icon: ArrowLeftRight },
    { href: "/payouts", label: "Payouts", icon: Wallet },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/api-keys", label: "More", icon: Menu },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around z-50"
      style={{
        background: "#0d1117",
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {mobileLinks.map((link) => {
        const Icon = link.icon;
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="flex flex-col items-center justify-center py-3 px-2 flex-1 text-[10px] font-medium"
            style={{ color: active ? "#635bff" : "#6b7280" }}
          >
            <Icon className="w-5 h-5 mb-1" />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
