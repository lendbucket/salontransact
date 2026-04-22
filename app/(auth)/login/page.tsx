"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Lock,
  CheckCircle,
  Mail,
  Zap,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password. Please try again.");
        setLoading(false);
        return;
      }
      // Hard navigation to trigger server-side layout role checks
      window.location.href = "/dashboard";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleMagicLink() {
    if (!email) {
      setError("Please enter your email first");
      return;
    }
    setError("");
    setMagicLoading(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send magic link");
        setMagicLoading(false);
        return;
      }
      setMagicSent(true);
    } catch {
      setError("Failed to send magic link. Please try again.");
    } finally {
      setMagicLoading(false);
    }
  }

  /* ---- Magic link sent ---- */
  if (magicSent) {
    return (
      <Page>
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
              background: "rgba(99,91,255,0.1)",
              boxShadow: "0 0 40px rgba(99,91,255,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Mail size={24} strokeWidth={1.5} color="#635bff" />
          </div>
          <h2
            style={{
              color: "#f9fafb",
              fontSize: 24,
              fontWeight: 700,
              letterSpacing: "-0.8px",
              marginBottom: 8,
            }}
          >
            Check your email
          </h2>
          <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 24 }}>
            We sent a sign-in link to{" "}
            <strong style={{ color: "#f9fafb" }}>{email}</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              setMagicSent(false);
              handleMagicLink();
            }}
            style={{
              color: "#635bff",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 12,
            }}
          >
            Didn&apos;t receive it? Resend
          </button>
          <button
            type="button"
            onClick={() => setMagicSent(false)}
            style={{
              color: "#6b7280",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back to sign in
          </button>
        </div>
      </Page>
    );
  }

  /* ---- Main form ---- */
  return (
    <Page>
      {/* Error */}
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <AlertCircle
            size={16}
            strokeWidth={1.5}
            color="#ef4444"
            style={{ flexShrink: 0 }}
          />
          <span style={{ color: "#ef4444", fontSize: 14 }}>{error}</span>
        </div>
      )}

      {/* Heading */}
      <h2
        style={{
          color: "#f9fafb",
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.8px",
          marginBottom: 4,
        }}
      >
        Welcome back
      </h2>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 24 }}>
        Sign in to your account
      </p>

      {/* Form */}
      <form onSubmit={handleCredentials}>
        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              color: "#9ca3af",
              fontSize: 13,
              fontWeight: 500,
              display: "block",
              marginBottom: 6,
            }}
          >
            Email address
          </label>
          <div style={{ position: "relative" }}>
            <Mail
              size={16}
              strokeWidth={1.5}
              color="#4b5563"
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={loading}
              style={{
                width: "100%",
                height: 48,
                background: "#0d1f3c",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#f9fafb",
                fontSize: 15,
                paddingLeft: 42,
                paddingRight: 14,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Password */}
        <div style={{ marginBottom: 8 }}>
          <label
            style={{
              color: "#9ca3af",
              fontSize: 13,
              fontWeight: 500,
              display: "block",
              marginBottom: 6,
            }}
          >
            Password
          </label>
          <div style={{ position: "relative" }}>
            <Lock
              size={16}
              strokeWidth={1.5}
              color="#4b5563"
              style={{
                position: "absolute",
                left: 14,
                top: "50%",
                transform: "translateY(-50%)",
                pointerEvents: "none",
              }}
            />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              disabled={loading}
              style={{
                width: "100%",
                height: 48,
                background: "#0d1f3c",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#f9fafb",
                fontSize: 15,
                paddingLeft: 42,
                paddingRight: 48,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: 14,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff size={16} strokeWidth={1.5} color="#4b5563" />
              ) : (
                <Eye size={16} strokeWidth={1.5} color="#4b5563" />
              )}
            </button>
          </div>
        </div>

        <div style={{ textAlign: "right", marginBottom: 20 }}>
          <a
            href="/forgot-password"
            style={{
              color: "#635bff",
              fontSize: 13,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Forgot password?
          </a>
        </div>

        {/* Sign in */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            height: 48,
            background: loading ? "#4f46e5" : "#635bff",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading && (
            <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
          )}
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      {/* Divider */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          margin: "20px 0",
        }}
      >
        <div
          style={{
            flex: 1,
            height: 1,
            background: "rgba(255,255,255,0.06)",
          }}
        />
        <span style={{ color: "#4b5563", fontSize: 13 }}>or</span>
        <div
          style={{
            flex: 1,
            height: 1,
            background: "rgba(255,255,255,0.06)",
          }}
        />
      </div>

      {/* Magic link */}
      <button
        type="button"
        onClick={handleMagicLink}
        disabled={magicLoading || loading}
        style={{
          width: "100%",
          height: 48,
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8,
          color: "#f9fafb",
          fontSize: 15,
          fontWeight: 500,
          cursor: magicLoading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: magicLoading ? 0.7 : 1,
        }}
      >
        {magicLoading ? (
          <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
        ) : (
          <Zap size={16} strokeWidth={1.5} color="#635bff" />
        )}
        {magicLoading ? "Sending..." : "Send magic link"}
      </button>
    </Page>
  );
}

/* ------------------------------------------------------------------ */
/*  Page shell — logo, grid bg, badges, footer                         */
/* ------------------------------------------------------------------ */

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a1628",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        position: "relative",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      {/* Grid overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          maxWidth: 420,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            marginBottom: 24,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: "linear-gradient(135deg, #635bff, #4f46e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 18,
              }}
            >
              ST
            </div>
            <span
              style={{
                color: "#f9fafb",
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.5px",
              }}
            >
              SalonTransact
            </span>
          </div>
          <span style={{ color: "#6b7280", fontSize: 13 }}>
            Payment Infrastructure for Salons
          </span>
        </div>

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: "rgba(255,255,255,0.06)",
            marginBottom: 32,
          }}
        />

        {/* Content */}
        {children}

        {/* Trust badges */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 8,
            marginTop: 32,
            flexWrap: "wrap",
          }}
        >
          {[
            { Icon: Shield, label: "PCI DSS Level 1" },
            { Icon: Lock, label: "256-bit Encryption" },
            { Icon: CheckCircle, label: "Stripe Verified" },
          ].map(({ Icon, label }) => (
            <div
              key={label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 100,
                padding: "4px 10px",
              }}
            >
              <Icon size={10} strokeWidth={1.5} color="#6b7280" />
              <span style={{ color: "#6b7280", fontSize: 11, fontWeight: 500 }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center", marginTop: 16 }}>
          <div style={{ color: "#4b5563", fontSize: 12 }}>
            Access by invitation only
          </div>
          <div style={{ color: "#374151", fontSize: 11, marginTop: 4 }}>
            &copy; 2026 Reyna Pay LLC. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
}
