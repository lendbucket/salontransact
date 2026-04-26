"use client";

import { useState } from "react";
import {
  Mail,
  BookOpen,
  AlertCircle,
  CheckCircle,
  Loader2,
} from "lucide-react";

export default function SupportPage() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("medium");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subject || !description) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/support/ticket", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, category, priority, description }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to submit ticket");
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
    } catch {
      setError("Failed to submit. Please try again.");
    }
    setSubmitting(false);
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    height: 40,
    background: "#F4F5F7",
    border: "1px solid #E8EAED",
    borderRadius: 8,
    padding: "0 12px",
    fontSize: 14,
    color: "#1A1313",
    outline: "none",
    boxSizing: "border-box",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "none" as const,
  };

  const cards = [
    {
      Icon: Mail,
      title: "Email Support",
      desc: "Response within 24 hours",
      detail: "support@salontransact.com",
      action: "Send Email",
      href: "mailto:support@salontransact.com",
      iconBg: "#E6F4F8",
      iconColor: "#017ea7",
    },
    {
      Icon: BookOpen,
      title: "Documentation",
      desc: "Integration guides and API reference",
      detail: "SalonTransact API docs, integration guides, Pay by Cloud",
      action: "View Docs",
      href: "https://docs.payroc.com",
      iconBg: "#E6F4F8",
      iconColor: "#017ea7",
    },
    {
      Icon: AlertCircle,
      title: "Emergency",
      desc: "For urgent processing issues",
      detail: "ceo@36west.org",
      action: "Contact Now",
      href: "mailto:ceo@36west.org",
      iconBg: "#FEF2F2",
      iconColor: "#DC2626",
    },
  ];

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "#1A1313" }}
      >
        Support
      </h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>
        Get help with your SalonTransact account
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left — Contact cards */}
        <div className="space-y-4">
          {cards.map((c) => (
            <div key={c.title} className="card" style={{ padding: 20 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: c.iconBg,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <c.Icon
                    size={18}
                    strokeWidth={1.5}
                    style={{ color: c.iconColor }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: "#1A1313",
                      marginBottom: 2,
                    }}
                  >
                    {c.title}
                  </p>
                  <p
                    style={{
                      fontSize: 13,
                      color: "#878787",
                      marginBottom: 4,
                    }}
                  >
                    {c.desc}
                  </p>
                  <p style={{ fontSize: 13, color: "#4A4A4A" }}>
                    {c.detail}
                  </p>
                  <a
                    href={c.href}
                    target={c.href.startsWith("http") ? "_blank" : undefined}
                    rel={
                      c.href.startsWith("http")
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className="inline-flex items-center gap-2 px-3 h-8 bg-white hover:bg-[#F4F5F7] text-[#1A1313] text-sm font-medium rounded-lg border border-[#D1D5DB] transition-all duration-150 whitespace-nowrap shadow-sm cursor-pointer mt-3"
                  >
                    {c.action}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Right — Ticket form */}
        <div className="card" style={{ padding: 24 }}>
          {submitted ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                padding: "40px 0",
              }}
            >
              <CheckCircle
                size={40}
                strokeWidth={1.5}
                style={{ color: "#166534", marginBottom: 16 }}
              />
              <p
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  color: "#1A1313",
                  marginBottom: 4,
                }}
              >
                Ticket submitted!
              </p>
              <p style={{ fontSize: 14, color: "#878787" }}>
                We&apos;ll respond within 24 hours.
              </p>
            </div>
          ) : (
            <>
              <h3 style={{ marginBottom: 20 }}>Submit a Support Ticket</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#4A4A4A",
                      marginBottom: 6,
                    }}
                  >
                    Subject *
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Brief description of your issue"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#4A4A4A",
                      marginBottom: 6,
                    }}
                  >
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Select category</option>
                    <option value="payment">Payment Issue</option>
                    <option value="onboarding">Onboarding</option>
                    <option value="technical">Technical</option>
                    <option value="billing">Billing</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#4A4A4A",
                      marginBottom: 6,
                    }}
                  >
                    Priority
                  </label>
                  <div style={{ display: "flex", gap: 8 }}>
                    {["low", "medium", "high", "urgent"].map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPriority(p)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 6,
                          fontSize: 13,
                          fontWeight: 500,
                          cursor: "pointer",
                          textTransform: "capitalize",
                          border:
                            priority === p
                              ? "1px solid #017ea7"
                              : "1px solid #E8EAED",
                          background:
                            priority === p ? "#E6F4F8" : "#FFFFFF",
                          color: priority === p ? "#015f80" : "#4A4A4A",
                        }}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: 13,
                      fontWeight: 500,
                      color: "#4A4A4A",
                      marginBottom: 6,
                    }}
                  >
                    Description *
                  </label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your issue in detail..."
                    rows={4}
                    style={{
                      ...inputStyle,
                      height: "auto",
                      padding: 12,
                      resize: "vertical",
                    }}
                  />
                </div>
                {error && (
                  <p style={{ fontSize: 13, color: "#DC2626" }}>{error}</p>
                )}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 h-10 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting && (
                    <Loader2
                      size={14}
                      strokeWidth={1.5}
                      className="animate-spin"
                    />
                  )}
                  Submit Ticket
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
