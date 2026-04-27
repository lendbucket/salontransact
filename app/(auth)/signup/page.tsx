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
  User,
  Building2,
  AlertCircle,
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

function focusStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#017ea7";
  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(1,126,167,0.1)";
}

function blurStyle(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#E8EAED";
  e.currentTarget.style.boxShadow = "none";
}

export default function SignupPage() {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name || !businessName || !email || !password || !confirmPassword) {
      setError("All fields are required");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!agreedToTerms) {
      setError("You must agree to the Terms of Service and Privacy Policy");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, businessName, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Signup failed");
        setLoading(false);
        return;
      }

      // Auto sign-in after successful registration
      const signInResult = await signIn("credentials", {
        email: email.toLowerCase().trim(),
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        // Account created but auto-login failed — redirect to login
        window.location.href = "/login";
        return;
      }

      window.location.href = "/onboarding";
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

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
        Create your account
      </h1>
      <p style={{ color: "#878787", fontSize: 13, marginBottom: 28 }}>
        Start accepting payments at your salon
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        {/* Full Name */}
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
            Full Name
          </label>
          <div style={{ position: "relative" }}>
            <User
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
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe"
              disabled={loading}
              style={{ ...INPUT, paddingLeft: 42, paddingRight: 14 }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>
        </div>

        {/* Business Name */}
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
            Business Name
          </label>
          <div style={{ position: "relative" }}>
            <Building2
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
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Your Salon Name"
              disabled={loading}
              style={{ ...INPUT, paddingLeft: 42, paddingRight: 14 }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>
        </div>

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
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
          </div>
        </div>

        {/* Password */}
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
              placeholder="At least 8 characters"
              disabled={loading}
              style={{ ...INPUT, paddingLeft: 42, paddingRight: 48 }}
              onFocus={focusStyle}
              onBlur={blurStyle}
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

        {/* Confirm Password */}
        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              color: "#4A4A4A",
              fontSize: 13,
              fontWeight: 500,
              display: "block",
              marginBottom: 6,
            }}
          >
            Confirm Password
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
              type={showConfirm ? "text" : "password"}
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              disabled={loading}
              style={{ ...INPUT, paddingLeft: 42, paddingRight: 48 }}
              onFocus={focusStyle}
              onBlur={blurStyle}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
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
              aria-label={showConfirm ? "Hide password" : "Show password"}
            >
              {showConfirm ? (
                <EyeOff size={16} strokeWidth={1.5} color="#878787" />
              ) : (
                <Eye size={16} strokeWidth={1.5} color="#878787" />
              )}
            </button>
          </div>
          {confirmPassword.length > 0 && password !== confirmPassword && (
            <p style={{ color: "#DC2626", fontSize: 12, marginTop: 4 }}>
              Passwords do not match
            </p>
          )}
        </div>

        {/* Terms checkbox */}
        <div style={{ marginBottom: 24 }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              style={{
                marginTop: 3,
                accentColor: "#017ea7",
                width: 16,
                height: 16,
                flexShrink: 0,
              }}
            />
            <span style={{ color: "#4A4A4A", fontSize: 13, lineHeight: 1.5 }}>
              I agree to the{" "}
              <a
                href="#"
                style={{ color: "#017ea7", textDecoration: "none" }}
              >
                Terms of Service
              </a>{" "}
              and{" "}
              <a
                href="#"
                style={{ color: "#017ea7", textDecoration: "none" }}
              >
                Privacy Policy
              </a>
            </span>
          </label>
        </div>

        {/* Create account */}
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
          {loading ? "Creating account..." : "Create account"}
        </button>
      </form>

      {/* Login link */}
      <p
        style={{
          textAlign: "center",
          marginTop: 24,
          fontSize: 14,
          color: "#4A4A4A",
        }}
      >
        Already have an account?{" "}
        <Link
          href="/login"
          style={{
            color: "#017ea7",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
