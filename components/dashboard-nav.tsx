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
  ArrowDownCircle,
  Lock,
  Building2,
  Smartphone,
  ClipboardList,
  ScrollText,
  BarChart3,
} from "lucide-react";

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  section: string;
  masterOnly?: boolean;
  comingSoon?: boolean;
};

const links: NavLink[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, section: "Overview" },
  { href: "/checkout", label: "New Payment", icon: CreditCard, section: "Overview" },
  { href: "/analytics", label: "Analytics", icon: TrendingUp, section: "Overview" },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, section: "Payments" },
  { href: "/payouts", label: "Payouts", icon: Wallet, section: "Payments" },
  { href: "/master/disputes", label: "Disputes", icon: AlertCircle, section: "Payments", masterOnly: true },
  { href: "/master/refunds", label: "Refunds", icon: ArrowDownCircle, section: "Payments", masterOnly: true },
  { href: "/master/authorizations", label: "Authorizations", icon: Lock, section: "Payments", masterOnly: true },
  { href: "/master/settlements", label: "Settlements", icon: Wallet, section: "Payments", masterOnly: true },
  { href: "/api-keys", label: "API Keys", icon: KeyRound, section: "Developers" },
  { href: "/webhooks", label: "Webhooks", icon: Webhook, section: "Developers" },
  { href: "/logs", label: "Logs", icon: FileText, section: "Developers" },
  { href: "/settings", label: "Settings", icon: Settings, section: "Account" },
  { href: "/support", label: "Support", icon: HelpCircle, section: "Account" },
  // Master Portal
  { href: "/master/merchants", label: "Merchants", icon: Building2, section: "Master", masterOnly: true },
  { href: "/master/devices", label: "Devices", icon: Smartphone, section: "Master", masterOnly: true, comingSoon: true },
  { href: "/master/saved-cards", label: "Saved Cards", icon: CreditCard, section: "Master", masterOnly: true, comingSoon: true },
  { href: "/master/applications", label: "Applications", icon: ClipboardList, section: "Master", masterOnly: true, comingSoon: true },
  { href: "/master/audit", label: "Audit Log", icon: ScrollText, section: "Master", masterOnly: true, comingSoon: true },
  { href: "/master/reporting", label: "Reporting", icon: BarChart3, section: "Master", masterOnly: true, comingSoon: true },
];

const sections = ["Overview", "Payments", "Developers", "Account", "Master"];

export function Sidebar({
  businessName,
  plan,
  role,
}: {
  businessName: string;
  plan: string;
  role?: string;
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
        background: "#FFFFFF",
        borderRight: "1px solid #E8EAED",
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
          src="/salontransact-logo.png"
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
          style={{ fontSize: 12, fontWeight: 400, color: "#878787" }}
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
            color: "#017ea7",
            background: "#E6F4F8",
          }}
        >
          {plan}
        </span>
      </div>

      {/* Search */}
      <div style={{ padding: "0 12px", marginTop: 16 }}>
        <label
          htmlFor="sidebar-search"
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            height: 32,
            borderRadius: 6,
            background: "#F4F5F7",
            border: "1px solid #E8EAED",
            paddingLeft: 10,
            paddingRight: 10,
            gap: 8,
            cursor: "text",
          }}
        >
          <Search size={14} strokeWidth={1.5} color="#878787" />
          <input
            id="sidebar-search"
            type="search"
            placeholder="Search..."
            style={{
              flex: 1,
              height: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              fontSize: 13,
              fontWeight: 400,
              color: "#1A1313",
            }}
          />
          <kbd
            style={{
              fontSize: 9,
              padding: "1px 4px",
              borderRadius: 3,
              fontFamily: "monospace",
              color: "#878787",
              background: "#E8EAED",
              border: "1px solid #E8EAED",
            }}
          >
            /
          </kbd>
        </label>
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
                color: "#878787",
              }}
            >
              {section}
            </p>
            {links
              .filter((l) => l.section === section)
              .filter((l) => !l.masterOnly || role === "master portal")
              .map((link) => {
                const Icon = link.icon;
                const active = pathname === link.href;
                if (link.comingSoon) {
                  return (
                    <span
                      key={link.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        height: 36,
                        padding: "0 12px",
                        margin: "0 8px",
                        borderRadius: 6,
                        fontSize: 14,
                        fontWeight: 400,
                        color: "#878787",
                        opacity: 0.5,
                        cursor: "not-allowed",
                        borderLeft: "3px solid transparent",
                      }}
                    >
                      <Icon size={16} strokeWidth={1.5} />
                      {link.label}
                      <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 600, letterSpacing: "0.05em" }}>SOON</span>
                    </span>
                  );
                }
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
                      color: active ? "#017ea7" : "#4A4A4A",
                      background: active ? "#E6F4F8" : "transparent",
                      textDecoration: "none",
                      borderLeft: active
                        ? "3px solid #017ea7"
                        : "3px solid transparent",
                    }}
                    onMouseEnter={(e) => {
                      if (!active)
                        e.currentTarget.style.background = "#F4F5F7";
                    }}
                    onMouseLeave={(e) => {
                      if (!active)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
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
          borderTop: "1px solid #E8EAED",
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
              style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}
            >
              {session?.user?.name ?? "User"}
            </p>
            <p
              className="truncate"
              style={{ fontSize: 11, fontWeight: 400, color: "#878787" }}
            >
              {session?.user?.email}
            </p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            style={{
              color: "#878787",
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
    { href: "/more", label: "More", icon: Menu },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 flex justify-around z-50"
      style={{
        background: "#FFFFFF",
        borderTop: "1px solid #E8EAED",
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
              color: active ? "#017ea7" : "#878787",
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
