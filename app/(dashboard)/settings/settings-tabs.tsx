"use client";

import { useState, type ReactNode } from "react";
import {
  Building2,
  CreditCard,
  Users,
  Shield,
  Lock,
  Loader2,
} from "lucide-react";

const tabs = [
  { id: "business", label: "Business Info", icon: Building2 },
  { id: "payment", label: "Payment Settings", icon: CreditCard },
  { id: "team", label: "Team", icon: Users },
  { id: "security", label: "Security", icon: Shield },
];

type Props = {
  businessInfoContent: ReactNode;
  paymentContent: ReactNode;
};

export function SettingsTabs({ businessInfoContent, paymentContent }: Props) {
  const [active, setActive] = useState("business");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordMsg("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMsg("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    setPasswordMsg(null);
    // Placeholder -- would call API
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setPasswordMsg("Password updated successfully");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div>
      {/* Tab bar */}
      <div
        className="flex gap-1 p-1 rounded-lg mb-6"
        style={{ background: "#F4F5F7" }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = active === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium flex-1 justify-center cursor-pointer"
              style={{
                background: isActive ? "#017ea7" : "transparent",
                color: isActive ? "#fff" : "#878787",
              }}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      {active === "business" && businessInfoContent}
      {active === "payment" && paymentContent}
      {active === "team" && (
        <div className="st-card p-6">
          <h2 className="text-base font-semibold text-foreground mb-1">
            Team Members
          </h2>
          <p className="text-sm text-secondary mb-6">
            Invite and manage team access
          </p>
          <div className="py-12 text-center">
            <Users className="w-8 h-8 mx-auto mb-3 text-muted" />
            <p className="text-sm text-muted">
              Team management coming soon.
            </p>
          </div>
        </div>
      )}
      {active === "security" && (
        <div className="space-y-6">
          <form onSubmit={handlePasswordChange} className="st-card p-6">
            <h2 className="text-base font-semibold text-foreground mb-1">
              Change Password
            </h2>
            <p className="text-sm text-secondary mb-6">
              Update your account password
            </p>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Current password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="st-input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  New password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="st-input"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-secondary mb-2">
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="st-input"
                  required
                />
              </div>
              {passwordMsg && (
                <p
                  className="text-sm"
                  style={{
                    color: passwordMsg.includes("success")
                      ? "#22c55e"
                      : "#ef4444",
                  }}
                >
                  {passwordMsg}
                </p>
              )}
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex items-center gap-2"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Update Password
              </button>
            </div>
          </form>

          <div className="st-card p-6">
            <h2 className="text-base font-semibold text-foreground mb-1">
              Active Sessions
            </h2>
            <p className="text-sm text-secondary mb-6">
              Devices currently signed in to your account
            </p>
            <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "#F9FAFB" }}>
              <Lock className="w-4 h-4 text-success" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground">Current session</p>
                <p className="text-xs text-muted">Active now</p>
              </div>
              <span className="text-xs text-success font-medium">Active</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
