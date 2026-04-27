"use client";

import { useState } from "react";
import { Mail, Loader2, CheckCircle } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

export default function VerifyEmailSentPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleResend() {
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.toLowerCase().trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to resend verification email");
      } else {
        setSent(true);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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

        <h1
          style={{
            color: "#1A1313",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: "-0.31px",
            marginBottom: 8,
          }}
        >
          Check your inbox
        </h1>
        <p
          style={{
            color: "#878787",
            fontSize: 14,
            marginBottom: 28,
            maxWidth: 360,
          }}
        >
          We sent you a verification link. Click it to verify your email and
          continue setting up your account.
        </p>

        {sent ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              color: "#22c55e",
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 20,
            }}
          >
            <CheckCircle size={16} strokeWidth={1.5} />
            Verification email resent!
          </div>
        ) : (
          <div style={{ width: "100%", maxWidth: 320 }}>
            <label
              style={{
                color: "#4A4A4A",
                fontSize: 13,
                fontWeight: 500,
                display: "block",
                marginBottom: 6,
                textAlign: "left",
              }}
            >
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{
                width: "100%",
                height: 48,
                background: "#FFFFFF",
                border: "1px solid #E8EAED",
                borderRadius: 8,
                color: "#1A1313",
                fontSize: 15,
                padding: "0 14px",
                outline: "none",
                boxSizing: "border-box",
                marginBottom: 12,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "#017ea7";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(1,126,167,0.1)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "#E8EAED";
                e.currentTarget.style.boxShadow = "none";
              }}
            />

            {error && (
              <p
                style={{
                  color: "#DC2626",
                  fontSize: 13,
                  marginBottom: 12,
                  textAlign: "left",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleResend}
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
                <Loader2
                  size={16}
                  strokeWidth={1.5}
                  className="animate-spin"
                />
              )}
              {loading ? "Sending..." : "Resend verification email"}
            </button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
