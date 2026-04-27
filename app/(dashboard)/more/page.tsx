"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  CreditCard,
  TrendingUp,
  AlertCircle,
  ArrowDownCircle,
  Lock,
  Wallet,
  KeyRound,
  Webhook,
  FileText,
  HelpCircle,
  LogOut,
  ChevronRight,
} from "lucide-react";

const moreLinks = [
  { href: "/checkout", label: "New Payment", icon: CreditCard, description: "Take a payment" },
  { href: "/analytics", label: "Analytics", icon: TrendingUp, description: "Volume and trends" },
  { href: "/master/disputes", label: "Disputes", icon: AlertCircle, description: "Customer-initiated disputes" },
  { href: "/master/refunds", label: "Refunds", icon: ArrowDownCircle, description: "Issue and track refunds" },
  { href: "/master/authorizations", label: "Authorizations", icon: Lock, description: "Card authorization history" },
  { href: "/master/settlements", label: "Settlements", icon: Wallet, description: "Daily settlement batches" },
  { href: "/api-keys", label: "API Keys", icon: KeyRound, description: "Developer credentials" },
  { href: "/webhooks", label: "Webhooks", icon: Webhook, description: "Outbound event delivery" },
  { href: "/logs", label: "Logs", icon: FileText, description: "Recent system activity" },
  { href: "/support", label: "Support", icon: HelpCircle, description: "Get help" },
];

export default function MorePage() {
  return (
    <div className="min-h-screen pb-24" style={{ background: "#FBFBFB" }}>
      <div className="max-w-2xl mx-auto px-4 py-8 md:py-12">
        <h1
          className="text-2xl font-semibold mb-2"
          style={{ color: "#1A1313", letterSpacing: "-0.31px" }}
        >
          More
        </h1>
        <p className="text-sm mb-6" style={{ color: "#878787" }}>
          All pages and account options
        </p>

        <div
          className="rounded-xl overflow-hidden divide-y"
          style={{
            background: "#FFFFFF",
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05)",
            borderColor: "#E8EAED",
          }}
        >
          {moreLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-4 px-4 py-4"
                style={{ textDecoration: "none" }}
              >
                <div
                  className="flex items-center justify-center flex-shrink-0"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    background: "#F4F5F7",
                  }}
                >
                  <Icon size={16} strokeWidth={1.5} color="#4A4A4A" />
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium"
                    style={{ color: "#1A1313" }}
                  >
                    {link.label}
                  </p>
                  <p
                    className="text-xs mt-0.5 truncate"
                    style={{ color: "#878787" }}
                  >
                    {link.description}
                  </p>
                </div>
                <ChevronRight size={16} strokeWidth={1.5} color="#878787" />
              </Link>
            );
          })}
        </div>

        <div
          className="mt-6 rounded-xl overflow-hidden"
          style={{
            background: "#FFFFFF",
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05)",
          }}
        >
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center gap-4 px-4 py-4 text-left cursor-pointer"
            style={{ background: "none", border: "none" }}
          >
            <div
              className="flex items-center justify-center flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: "#FEF2F2",
              }}
            >
              <LogOut size={16} strokeWidth={1.5} color="#DC2626" />
            </div>
            <span
              className="text-sm font-medium"
              style={{ color: "#DC2626" }}
            >
              Sign out
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
