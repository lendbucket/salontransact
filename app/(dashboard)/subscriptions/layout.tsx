"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/subscriptions/plans", label: "Plans", enabled: true },
  { href: "/subscriptions/all", label: "Subscriptions", enabled: true },
  { href: "#", label: "Customers", enabled: false },
];

export default function SubscriptionsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1
        style={{
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.31px",
          color: "#1A1313",
          margin: 0,
        }}
      >
        Subscriptions
      </h1>
      <p style={{ fontSize: 14, color: "#878787", marginTop: 4 }}>
        Manage recurring billing plans and subscriptions
      </p>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid #E8EAED",
          marginTop: 24,
          marginBottom: 24,
        }}
      >
        {tabs.map((tab) => {
          const active = tab.enabled && pathname.startsWith(tab.href);

          if (!tab.enabled) {
            return (
              <span
                key={tab.label}
                style={{
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 400,
                  color: "#878787",
                  opacity: 0.5,
                  cursor: "not-allowed",
                  borderBottom: "2px solid transparent",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
                <span
                  style={{
                    marginLeft: 6,
                    fontSize: 10,
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                  }}
                >
                  Coming soon
                </span>
              </span>
            );
          }

          return (
            <Link
              key={tab.label}
              href={tab.href}
              style={{
                padding: "12px 16px",
                fontSize: 14,
                fontWeight: active ? 500 : 400,
                color: active ? "#017ea7" : "#4A4A4A",
                borderBottom: active
                  ? "2px solid #017ea7"
                  : "2px solid transparent",
                textDecoration: "none",
                whiteSpace: "nowrap",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {children}
    </div>
  );
}
