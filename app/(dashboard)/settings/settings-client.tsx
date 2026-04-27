"use client";

import { useState } from "react";
import {
  Building2,
  CreditCard,
  Users,
  Lock,
  Bell,
  Loader2,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";

type TabId = "business" | "payments" | "team" | "security" | "notifications";

type MerchantData = {
  businessName: string;
  businessType: string | null;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  ein: string | null;
  dbaName: string | null;
  stripeAccountId: string | null;
  stripeAccountStatus: string;
  fundingSpeed: string | null;
  status: string;
};

const INPUT: React.CSSProperties = {
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

export function SettingsClient({ merchant }: { merchant: MerchantData }) {
  const [tab, setTab] = useState<TabId>("business");

  const tabs: { id: TabId; label: string; Icon: typeof Building2 }[] = [
    { id: "business", label: "Business Info", Icon: Building2 },
    { id: "payments", label: "Payments", Icon: CreditCard },
    { id: "team", label: "Team", Icon: Users },
    { id: "security", label: "Security", Icon: Lock },
    { id: "notifications", label: "Notifications", Icon: Bell },
  ];

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "#1A1313" }}
      >
        Settings
      </h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>
        Manage your business and account
      </p>

      {/* Tabs */}
      <div
        className="scrollbar-hide -mx-6 md:mx-0 px-6 md:px-0"
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 24,
          borderBottom: "1px solid #E8EAED",
          overflowX: "auto",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: tab === t.id ? 500 : 400,
              color: tab === t.id ? "#017ea7" : "#878787",
              background: "none",
              border: "none",
              borderBottom:
                tab === t.id
                  ? "2px solid #017ea7"
                  : "2px solid transparent",
              cursor: "pointer",
              whiteSpace: "nowrap",
              marginBottom: -1,
            }}
          >
            <t.Icon size={14} strokeWidth={1.5} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "business" && <BusinessTab merchant={merchant} />}
      {tab === "payments" && <PaymentsTab merchant={merchant} />}
      {tab === "team" && <TeamTab />}
      {tab === "security" && <SecurityTab />}
      {tab === "notifications" && <NotificationsTab />}
    </div>
  );
}

/* ---- Business Tab ---- */
function BusinessTab({ merchant }: { merchant: MerchantData }) {
  const [form, setForm] = useState({
    businessName: merchant.businessName,
    businessType: merchant.businessType ?? "",
    email: merchant.email,
    phone: merchant.phone ?? "",
    address: merchant.address ?? "",
    city: merchant.city ?? "",
    state: merchant.state ?? "",
    zip: merchant.zip ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    await fetch("/api/merchant", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function field(label: string, key: keyof typeof form, type = "text") {
    return (
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
          {label}
        </label>
        <input
          type={type}
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          style={INPUT}
        />
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div className="space-y-4 max-w-full md:max-w-lg">
        {field("Business Name", "businessName")}
        {field("Email", "email", "email")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {field("Phone", "phone", "tel")}
          {field("Business Type", "businessType")}
        </div>
        {field("Address", "address")}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {field("City", "city")}
          {field("State", "state")}
          {field("ZIP", "zip")}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 h-9 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer disabled:opacity-60 mt-2"
        >
          {saving ? (
            <Loader2 size={14} strokeWidth={1.5} className="animate-spin" />
          ) : saved ? (
            <CheckCircle size={14} strokeWidth={1.5} />
          ) : null}
          {saved ? "Saved" : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

/* ---- Payments Tab ---- */
function PaymentsTab({ merchant }: { merchant: MerchantData }) {
  const connected = !!merchant.stripeAccountId;
  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ marginBottom: 16 }}>Payment Processing</h3>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
        }}
      >
        <span
          className={`badge ${connected ? "badge-success" : "badge-pending"}`}
        >
          <span className="badge-dot" />
          {connected ? "Connected" : "Pending Setup"}
        </span>
        {connected && (
          <span
            style={{
              fontSize: 12,
              color: "#878787",
              fontFamily: "monospace",
            }}
          >
            MID: {merchant.stripeAccountId}
          </span>
        )}
      </div>
      {!connected && (
        <p style={{ fontSize: 14, color: "#878787" }}>
          Our team will contact you to complete your SalonTransact merchant setup.
        </p>
      )}
      {merchant.fundingSpeed && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 500, color: "#4A4A4A" }}>
            Funding Speed
          </p>
          <p style={{ fontSize: 14, color: "#1A1313", marginTop: 4 }}>
            {merchant.fundingSpeed.replace(/_/g, " ")}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---- Team Tab ---- */
function TeamTab() {
  return (
    <div className="card" style={{ padding: 0, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: "#1A1313" }}>
          Team Members
        </span>
        <button className="inline-flex items-center gap-2 px-3 h-8 bg-[#017ea7] hover:bg-[#0290be] text-white text-xs font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer">
          Add Member
        </button>
      </div>
      <div className="flex flex-col items-center justify-center py-16">
        <Users
          size={32}
          strokeWidth={1}
          style={{ color: "#E8EAED", marginBottom: 12 }}
        />
        <p style={{ fontSize: 14, fontWeight: 500, color: "#1A1313" }}>
          No team members
        </p>
        <p style={{ fontSize: 13, color: "#878787" }}>
          Add staff to manage your location
        </p>
      </div>
    </div>
  );
}

/* ---- Security Tab ---- */
function SecurityTab() {
  const [current, setCurrent] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    msg: string;
  } | null>(null);

  async function handleChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirm) {
      setResult({ ok: false, msg: "Passwords do not match" });
      return;
    }
    setSaving(true);
    setResult(null);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: current,
        newPassword: newPw,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setResult({ ok: false, msg: data.error });
    } else {
      setResult({ ok: true, msg: "Password changed successfully" });
      setCurrent("");
      setNewPw("");
      setConfirm("");
    }
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ marginBottom: 20 }}>Change Password</h3>
      <form
        onSubmit={handleChange}
        className="space-y-4"
        style={{ maxWidth: 400 }}
      >
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
            Current Password
          </label>
          <input
            type="password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            style={INPUT}
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
            New Password
          </label>
          <div style={{ position: "relative" }}>
            <input
              type={showNew ? "text" : "password"}
              required
              minLength={8}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              style={{ ...INPUT, paddingRight: 40 }}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#878787",
              }}
            >
              {showNew ? (
                <EyeOff size={14} strokeWidth={1.5} />
              ) : (
                <Eye size={14} strokeWidth={1.5} />
              )}
            </button>
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
            Confirm New Password
          </label>
          <input
            type="password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={INPUT}
          />
        </div>
        {result && (
          <p
            style={{
              fontSize: 13,
              color: result.ok ? "#166534" : "#DC2626",
            }}
          >
            {result.msg}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 h-9 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer disabled:opacity-60"
        >
          {saving && (
            <Loader2
              size={14}
              strokeWidth={1.5}
              className="animate-spin"
            />
          )}
          Change Password
        </button>
      </form>
    </div>
  );
}

/* ---- Notifications Tab ---- */
function NotificationsTab() {
  const [prefs, setPrefs] = useState({
    paymentReceived: true,
    payoutProcessed: true,
    disputeOpened: true,
    lowBalance: false,
  });
  const [saved, setSaved] = useState(false);

  function Toggle({
    label,
    checked,
    onChange,
  }: {
    label: string;
    checked: boolean;
    onChange: () => void;
  }) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 0",
          borderBottom: "1px solid #F4F5F7",
        }}
      >
        <span style={{ fontSize: 14, color: "#1A1313" }}>{label}</span>
        <button
          type="button"
          onClick={onChange}
          style={{
            width: 44,
            height: 24,
            borderRadius: 12,
            border: "none",
            background: checked ? "#017ea7" : "#E8EAED",
            cursor: "pointer",
            position: "relative",
            transition: "background 150ms ease",
          }}
        >
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "#FFFFFF",
              position: "absolute",
              top: 3,
              left: checked ? 23 : 3,
              transition: "left 150ms ease",
              boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
            }}
          />
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ marginBottom: 16 }}>Email Notifications</h3>
      <div style={{ maxWidth: 480 }}>
        <Toggle
          label="Payment received"
          checked={prefs.paymentReceived}
          onChange={() =>
            setPrefs({ ...prefs, paymentReceived: !prefs.paymentReceived })
          }
        />
        <Toggle
          label="Payout processed"
          checked={prefs.payoutProcessed}
          onChange={() =>
            setPrefs({ ...prefs, payoutProcessed: !prefs.payoutProcessed })
          }
        />
        <Toggle
          label="Dispute opened"
          checked={prefs.disputeOpened}
          onChange={() =>
            setPrefs({ ...prefs, disputeOpened: !prefs.disputeOpened })
          }
        />
        <Toggle
          label="Low balance alert"
          checked={prefs.lowBalance}
          onChange={() =>
            setPrefs({ ...prefs, lowBalance: !prefs.lowBalance })
          }
        />
        <button
          onClick={() => {
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
          className="inline-flex items-center gap-2 px-4 h-9 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer mt-4"
        >
          {saved ? (
            <CheckCircle size={14} strokeWidth={1.5} />
          ) : null}
          {saved ? "Saved" : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
