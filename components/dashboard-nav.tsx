"use client";

import Link from "next/link";
import Image from "next/image";
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
      className="hidden md:flex md:flex-col min-h-screen"
      style={{
        width: 240,
        background: "#0d1117",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 44,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Image
          src="/salontransact-logo.svg"
          alt="SalonTransact"
          width={140}
          height={28}
          style={{ height: 28, width: "auto", objectFit: "contain" }}
          priority
        />
      </div>

      {/* Business name + plan */}
      <div style={{ padding: "8px 16px 0" }}>
        <p
          className="truncate"
          style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af" }}
        >
          {businessName}
        </p>
        <span
          style={{
            display: "inline-block",
            marginTop: 4,
            fontSize: 10,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "2px 6px",
            borderRadius: 4,
            color: "#635bff",
            background: "rgba(99,91,255,0.1)",
          }}
        >
          {plan}
        </span>
      </div>

      {/* Search */}
      <div style={{ margin: "16px 12px 0" }}>
        <div
          style={{
            height: 32,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 10px",
            borderRadius: 6,
            background: "#111827",
            cursor: "pointer",
          }}
        >
          <Search size={16} strokeWidth={1.5} color="#6b7280" />
          <span style={{ fontSize: 13, fontWeight: 400, color: "#6b7280", flex: 1 }}>
            Search...
          </span>
          <kbd
            style={{
              fontSize: 9,
              padding: "1px 4px",
              borderRadius: 3,
              fontFamily: "monospace",
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
      <nav style={{ flex: 1, display: "flex", flexDirection: "column", gap: 2, marginTop: 8 }}>
        {sections.map((section) => (
          <div key={section}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                marginTop: 24,
                marginBottom: 4,
                paddingLeft: 16,
                color: "#6b7280",
              }}
            >
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
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      height: 36,
                      padding: "0 12px",
                      margin: "0 8px",
                      borderRadius: 6,
                      fontSize: 14,
                      fontWeight: active ? 500 : 400,
                      color: active ? "#635bff" : "#9ca3af",
                      background: active ? "rgba(99,91,255,0.12)" : "transparent",
                      position: "relative",
                      textDecoration: "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!active)
                        e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      if (!active)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {active && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 2,
                          height: 16,
                          borderRadius: "0 2px 2px 0",
                          background: "#635bff",
                        }}
                      />
                    )}
                    <Icon size={16} strokeWidth={1.5} />
                    {link.label}
                  </Link>
                );
              })}
          </div>
        ))}
      </nav>

      {/* User section */}
      <div
        style={{
          padding: "12px 16px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 11,
              fontWeight: 600,
              color: "#fbfbfb",
              background: "#017ea7",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              className="truncate"
              style={{ fontSize: 13, fontWeight: 500, color: "#f9fafb" }}
            >
              {session?.user?.name ?? "User"}
            </p>
            <p
              className="truncate"
              style={{ fontSize: 11, fontWeight: 400, color: "#6b7280" }}
            >
              {session?.user?.email}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{
              color: "#6b7280",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
            aria-label="Sign out"
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f9fafb")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#6b7280")}
          >
            <LogOut size={16} strokeWidth={1.5} />
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
            className="flex flex-col items-center justify-center py-3 px-2 flex-1"
            style={{
              color: active ? "#635bff" : "#6b7280",
              fontSize: 10,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <Icon size={16} strokeWidth={1.5} style={{ marginBottom: 4 }} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
