"use client";

import { useState, useEffect } from "react";
import {
  Settings,
  Users,
  Link2,
  Loader2,
  Plus,
  Copy,
} from "lucide-react";

type TabId = "general" | "team" | "affiliates";

type Affiliate = {
  id: string;
  name: string;
  email: string;
  referralCode: string;
  commissionRate: number;
  status: string;
  referredCount: number;
};

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<TabId>("general");

  const tabs: { id: TabId; label: string; Icon: typeof Settings }[] = [
    { id: "general", label: "General", Icon: Settings },
    { id: "team", label: "Team", Icon: Users },
    { id: "affiliates", label: "Affiliates", Icon: Link2 },
  ];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "#1A1313" }}
      >
        Settings
      </h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>
        Platform configuration
      </p>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          borderBottom: "1px solid #E8EAED",
          paddingBottom: 0,
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
              padding: "8px 16px",
              fontSize: 14,
              fontWeight: tab === t.id ? 500 : 400,
              color: tab === t.id ? "#017ea7" : "#878787",
              background: "none",
              border: "none",
              borderBottom:
                tab === t.id
                  ? "2px solid #017ea7"
                  : "2px solid transparent",
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            <t.Icon size={16} strokeWidth={1.5} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "general" && <GeneralTab />}
      {tab === "team" && <TeamTab />}
      {tab === "affiliates" && <AffiliatesTab />}
    </div>
  );
}

/* ---- General Tab ---- */
function GeneralTab() {
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

  return (
    <div className="card" style={{ padding: 24 }}>
      <h3 style={{ marginBottom: 20 }}>Platform Settings</h3>
      <div className="space-y-4" style={{ maxWidth: 480 }}>
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
            Platform Name
          </label>
          <input
            type="text"
            defaultValue="SalonTransact"
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
            Support Email
          </label>
          <input
            type="email"
            defaultValue="support@salontransact.com"
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
            Default Plan
          </label>
          <input
            type="text"
            defaultValue="Starter"
            style={inputStyle}
          />
        </div>
        <button className="inline-flex items-center gap-2 px-4 h-9 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer mt-2">
          Save Changes
        </button>
      </div>
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
          <Plus size={14} strokeWidth={1.5} />
          Add Member
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {["Name", "Email", "Role", "Status"].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ fontWeight: 500 }}>Robert Reyna</td>
            <td style={{ color: "#4A4A4A" }}>ceo@36west.org</td>
            <td>
              <span className="badge badge-brand">
                <span className="badge-dot" />
                Owner
              </span>
            </td>
            <td>
              <span className="badge badge-success">
                <span className="badge-dot" />
                Active
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* ---- Affiliates Tab ---- */
function AffiliatesTab() {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Stub — no affiliate API yet
    setLoading(false);
  }, []);

  return (
    <div>
      <div className="card" style={{ padding: 16, marginBottom: 24 }}>
        <p style={{ fontSize: 14, color: "#4A4A4A" }}>
          Affiliates refer merchants to SalonTransact and earn commission on
          processing volume.
        </p>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
          }}
        >
          <span
            style={{ fontSize: 16, fontWeight: 600, color: "#1A1313" }}
          >
            Affiliates
          </span>
          <button className="inline-flex items-center gap-2 px-3 h-8 bg-[#017ea7] hover:bg-[#0290be] text-white text-xs font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer">
            <Plus size={14} strokeWidth={1.5} />
            Add Affiliate
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2
              size={20}
              strokeWidth={1.5}
              className="animate-spin"
              style={{ color: "#878787" }}
            />
          </div>
        ) : affiliates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#E6F4F8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Link2
                size={20}
                strokeWidth={1.5}
                style={{ color: "#017ea7" }}
              />
            </div>
            <p
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "#1A1313",
                marginBottom: 4,
              }}
            >
              No affiliates yet
            </p>
            <p style={{ fontSize: 13, color: "#878787" }}>
              Add your first affiliate to start the referral program
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                {[
                  "Name",
                  "Email",
                  "Referral Code",
                  "Referred",
                  "Commission",
                  "Status",
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {affiliates.map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }}>{a.name}</td>
                  <td style={{ color: "#4A4A4A" }}>{a.email}</td>
                  <td>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <code
                        style={{
                          fontSize: 12,
                          color: "#878787",
                          background: "#F4F5F7",
                          padding: "2px 6px",
                          borderRadius: 4,
                        }}
                      >
                        {a.referralCode}
                      </code>
                      <button
                        onClick={() =>
                          navigator.clipboard.writeText(a.referralCode)
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "#878787",
                        }}
                      >
                        <Copy size={12} strokeWidth={1.5} />
                      </button>
                    </div>
                  </td>
                  <td>{a.referredCount}</td>
                  <td>{a.commissionRate}%</td>
                  <td>
                    <span
                      className={`badge ${a.status === "active" ? "badge-success" : "badge-neutral"}`}
                    >
                      <span className="badge-dot" />
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
