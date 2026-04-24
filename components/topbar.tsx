"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { Bell, ChevronDown, Menu, Settings, User, LogOut } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/checkout": "New Payment",
  "/analytics": "Analytics",
  "/transactions": "Transactions",
  "/payouts": "Payouts",
  "/disputes": "Disputes",
  "/api-keys": "API Keys",
  "/webhooks": "Webhooks",
  "/logs": "Logs",
  "/settings": "Settings",
  "/support": "Support",
};

export function Topbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const pageTitle = PAGE_TITLES[pathname] ?? "Dashboard";
  const initials = (session?.user?.name ?? session?.user?.email ?? "U")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        height: 56,
        background: "#0d1117",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Left: page title (desktop) / hamburger + logo (mobile) */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Mobile hamburger */}
        <button
          className="md:hidden"
          style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", padding: 0 }}
          aria-label="Menu"
        >
          <Menu size={16} strokeWidth={1.5} />
        </button>

        {/* Mobile logo */}
        <Image
          src="/salontransact-logo.svg"
          alt="SalonTransact"
          width={100}
          height={20}
          className="md:hidden"
          style={{ height: 20, width: "auto" }}
        />

        {/* Desktop page title */}
        <span
          className="hidden md:block"
          style={{
            fontSize: 16,
            fontWeight: 600,
            letterSpacing: "-0.3px",
            color: "#f9fafb",
          }}
        >
          {pageTitle}
        </span>
      </div>

      {/* Right: bell + divider + avatar + dropdown */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Bell */}
        <button
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            color: "#6b7280",
            cursor: "pointer",
          }}
          aria-label="Notifications"
        >
          <Bell size={16} strokeWidth={1.5} />
        </button>

        {/* Divider */}
        <div
          style={{
            width: 1,
            height: 20,
            background: "rgba(255,255,255,0.06)",
          }}
        />

        {/* User */}
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
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
              }}
            >
              {initials}
            </div>
            <span
              className="hidden md:inline"
              style={{ fontSize: 13, fontWeight: 500, color: "#f9fafb" }}
            >
              {session?.user?.name ?? "User"}
            </span>
            <ChevronDown
              size={12}
              strokeWidth={1.5}
              color="#6b7280"
              className="hidden md:inline"
            />
          </button>

          {dropdownOpen && (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 20 }}
                onClick={() => setDropdownOpen(false)}
              />
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 40,
                  width: 180,
                  background: "#111827",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  zIndex: 30,
                  overflow: "hidden",
                }}
              >
                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 400,
                    color: "#9ca3af",
                    textDecoration: "none",
                  }}
                >
                  <User size={16} strokeWidth={1.5} />
                  Profile
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 400,
                    color: "#9ca3af",
                    textDecoration: "none",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <Settings size={16} strokeWidth={1.5} />
                  Settings
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 400,
                    color: "#ef4444",
                    width: "100%",
                    background: "none",
                    border: "none",
                    borderTop: "1px solid rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <LogOut size={16} strokeWidth={1.5} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AdminTopbar() {
  const { data: session } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const initials = (session?.user?.name ?? session?.user?.email ?? "A")
    .split(" ")
    .map((w: string) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        height: 56,
        background: "#0d1117",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {/* Left: admin badge */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Image
          src="/salontransact-logo.svg"
          alt="SalonTransact"
          width={100}
          height={20}
          className="md:hidden"
          style={{ height: 20, width: "auto" }}
        />
        <span
          className="hidden md:inline-flex"
          style={{
            fontSize: 11,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            padding: "3px 10px",
            borderRadius: 100,
            color: "#ef4444",
            background: "rgba(239,68,68,0.12)",
          }}
        >
          Admin Panel
        </span>
      </div>

      {/* Right */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "none",
            border: "none",
            color: "#6b7280",
            cursor: "pointer",
          }}
          aria-label="Notifications"
        >
          <Bell size={16} strokeWidth={1.5} />
        </button>
        <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
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
              }}
            >
              {initials}
            </div>
            <ChevronDown size={12} strokeWidth={1.5} color="#6b7280" className="hidden md:inline" />
          </button>
          {dropdownOpen && (
            <>
              <div style={{ position: "fixed", inset: 0, zIndex: 20 }} onClick={() => setDropdownOpen(false)} />
              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 40,
                  width: 160,
                  background: "#111827",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  zIndex: 30,
                  overflow: "hidden",
                }}
              >
                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    fontSize: 13,
                    fontWeight: 400,
                    color: "#ef4444",
                    width: "100%",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <LogOut size={16} strokeWidth={1.5} />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
