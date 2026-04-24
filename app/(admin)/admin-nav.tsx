"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LayoutDashboard, Store, Mail, Settings, LogOut } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/merchants", label: "Merchants", icon: Store },
  { href: "/admin/invites", label: "Invites", icon: Mail },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminNav({ email }: { email: string }) {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
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

        {/* Admin badge */}
        <div style={{ padding: "8px 16px 0" }}>
          <span
            style={{
              display: "inline-block",
              fontSize: 10,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              padding: "2px 8px",
              borderRadius: 100,
              color: "#ef4444",
              background: "rgba(239,68,68,0.12)",
            }}
          >
            Admin Panel
          </span>
        </div>

        {/* Nav items */}
        <nav
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            marginTop: 24,
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
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
                  background: active
                    ? "#E6F4F8"
                    : "transparent",
                  position: "relative",
                  textDecoration: "none",
                  transition: "all 150ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!active)
                    e.currentTarget.style.background =
                      "#F4F5F7";
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
                      background: "#017ea7",
                    }}
                  />
                )}
                <Icon size={16} strokeWidth={1.5} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User section */}
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid #E8EAED",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                className="truncate"
                style={{ fontSize: 13, fontWeight: 500, color: "#1A1313" }}
              >
                {email}
              </p>
              <p style={{ fontSize: 11, fontWeight: 400, color: "#878787" }}>
                Admin
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
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "#1A1313")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "#878787")
              }
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
          background: "#FFFFFF",
          borderTop: "1px solid #E8EAED",
        }}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center py-3 px-2 flex-1"
              style={{
                color: active ? "#017ea7" : "#878787",
                fontSize: 10,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              <Icon
                size={16}
                strokeWidth={1.5}
                style={{ marginBottom: 4 }}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
