"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import {
  Loader2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Zap,
  AlertCircle,
  ArrowLeft,
} from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

const INPUT: React.CSSProperties = {
  width: "100%",
  height: 48,
  background: "#FFFFFF",
  border: "1px solid #E8EAED",
  borderRadius: 8,
  color: "#1A1313",
  fontSize: 15,
  outline: "none",
  boxSizing: "border-box",
};

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
              background: "rgba(1,126,167,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Mail size={24} strokeWidth={1.5} color="#017ea7" />
          </div>
          <h2
            style={{
              color: "#1A1313",
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.31px",
              marginBottom: 8,
            }}
          >
            Check your email
          </h2>
          <p style={{ color: "#878787", fontSize: 14, marginBottom: 24 }}>
            We sent a sign-in link to{" "}
            <strong style={{ color: "#1A1313" }}>{email}</strong>
          </p>
          <button
            type="button"
            onClick={() => {
              setMagicSent(false);
              handleMagicLink();
            }}
            style={{
              color: "#017ea7",
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
              color: "#878787",
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
      </AuthLayout>
    );
  }

  /* ---- Main form ---- */
  return (
    <AuthLayout>
      {/* Error */}
      {error && (
        <div
          style={{
            background: "rgba(239,68,68,0.06)",
            border: "1px solid rgba(239,68,68,0.2)",
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
            color="#DC2626"
            style={{ flexShrink: 0 }}
          />
          <span style={{ color: "#DC2626", fontSize: 14 }}>{error}</span>
        </div>
      )}

      {/* Heading */}
      <h1
        style={{
          color: "#1A1313",
          fontSize: 24,
          fontWeight: 600,
          letterSpacing: "-0.31px",
          marginBottom: 4,
        }}
      >
        Welcome back
      </h1>
      <p style={{ color: "#878787", fontSize: 13, marginBottom: 28 }}>
        Sign in to your account
      </p>

      {/* Form */}
      <form onSubmit={handleCredentials}>
        {/* Email */}
        <div style={{ marginBottom: 16 }}>
          <label
            style={{
              color: "#4A4A4A",
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
              color="#878787"
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
              style={{ ...INPUT, paddingLeft: 42, paddingRight: 14 }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#017ea7";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(1,126,167,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E8EAED";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
        </div>

        {/* Password */}
        <div style={{ marginBottom: 8 }}>
          <label
            style={{
              color: "#4A4A4A",
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
              color="#878787"
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
              style={{ ...INPUT, paddingLeft: 42, paddingRight: 48 }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#017ea7";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(1,126,167,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E8EAED";
                e.currentTarget.style.boxShadow = "none";
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
                <EyeOff size={16} strokeWidth={1.5} color="#878787" />
              ) : (
                <Eye size={16} strokeWidth={1.5} color="#878787" />
              )}
            </button>
          </div>
        </div>

        <div style={{ textAlign: "right", marginBottom: 20 }}>
          <Link
            href="/forgot-password"
            style={{
              color: "#017ea7",
              fontSize: 13,
              textDecoration: "none",
              fontWeight: 500,
            }}
          >
            Forgot password?
          </Link>
        </div>

        {/* Sign in */}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            height: 48,
            background: loading
              ? "#015f80"
              : "linear-gradient(180deg, #0290be 0%, #017ea7 100%)",
            border: "1px solid #015f80",
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
        <div style={{ flex: 1, height: 1, background: "#E8EAED" }} />
        <span style={{ color: "#878787", fontSize: 13 }}>or</span>
        <div style={{ flex: 1, height: 1, background: "#E8EAED" }} />
      </div>

      {/* Magic link */}
      <button
        type="button"
        onClick={handleMagicLink}
        disabled={magicLoading || loading}
        style={{
          width: "100%",
          height: 48,
          background: "#FFFFFF",
          border: "1px solid #017ea7",
          borderRadius: 8,
          color: "#017ea7",
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
          <Zap size={16} strokeWidth={1.5} color="#017ea7" />
        )}
        {magicLoading ? "Sending..." : "Send magic link"}
      </button>

      {/* Signup link */}
      <p
        style={{
          textAlign: "center",
          marginTop: 24,
          fontSize: 14,
          color: "#4A4A4A",
        }}
      >
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          style={{
            color: "#017ea7",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Sign up
        </Link>
      </p>
    </AuthLayout>
  );
}
