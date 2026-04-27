"use client";

import { signOut } from "next-auth/react";
import { ShieldX, LogOut } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

export default function AccountSuspendedPage() {
  return (
    <AuthLayout>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "16px 0",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}
        >
          <ShieldX size={28} strokeWidth={1.5} color="#DC2626" />
        </div>

        <h1
          style={{
            color: "#1A1313",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.31px",
            marginBottom: 8,
          }}
        >
          Account suspended
        </h1>
        <p
          style={{
            color: "#878787",
            fontSize: 14,
            marginBottom: 28,
            maxWidth: 360,
          }}
        >
          Your account has been suspended. If you believe this is an error,
          please contact our support team.
        </p>
        <a
          href="mailto:support@salontransact.com"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 48,
            padding: "0 32px",
            background:
              "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
            border: "1px solid #015f80",
            borderRadius: 8,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          Contact Support
        </a>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            color: "#878787",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          <LogOut size={14} strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </AuthLayout>
  );
}
