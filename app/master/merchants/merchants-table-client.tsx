"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Building2, Mail, Phone, UserPlus, Copy } from "lucide-react";
import { InvitesTab } from "./invites-tab";
import { StatusPill } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import type {
  MerchantSummary,
  MerchantListResponse,
  MerchantStatusFilter,
} from "./_lib/merchant-types";

const SHADOW =
  "0 0 0 1px rgba(0,0,0,0.05), 0 1px 1px rgba(0,0,0,0.05), 0 2px 2px rgba(0,0,0,0.05), 0 4px 4px rgba(0,0,0,0.05), 0 8px 8px rgba(0,0,0,0.05), 0 16px 16px rgba(0,0,0,0.05)";

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusPillStyles(status: string): {
  bg: string;
  text: string;
  dot: string;
} {
  const s = status.toLowerCase();
  if (s === "active")
    return { bg: "#DCFCE7", text: "#15803D", dot: "#22c55e" };
  if (s === "pending")
    return { bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" };
  if (s === "suspended")
    return { bg: "#FEE2E2", text: "#991B1B", dot: "#ef4444" };
  return { bg: "#E8EAED", text: "#4A4A4A", dot: "#878787" };
}

interface Props {
  initialMerchants: MerchantSummary[];
}

export function MerchantsTableClient({ initialMerchants }: Props) {
  const [tab, setTab] = useState<"active" | "invites">("active");
  const [merchants, setMerchants] =
    useState<MerchantSummary[]>(initialMerchants);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] =
    useState<MerchantStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ email: "", firstName: "", lastName: "", businessName: "", password: "" });
  const [creating, setCreating] = useState(false);
  const [createdCreds, setCreatedCreds] = useState<{ email: string; password: string; businessName: string } | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedQuery.length > 0) params.set("q", debouncedQuery);
      const res = await fetch(`/api/master/merchants?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as MerchantListResponse;
      setMerchants(data.merchants);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedQuery]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    function handleFocus() { refetch(); }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetch]);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleCreateTestAccount() {
    if (!createForm.email.trim() || !createForm.firstName.trim() || !createForm.lastName.trim() || !createForm.businessName.trim() || !createForm.password) {
      showToast("error", "All fields required");
      return;
    }
    if (createForm.password.length < 8) {
      showToast("error", "Password must be at least 8 characters");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/master/merchants/test-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", j.error ?? `Failed (${res.status})`);
        return;
      }
      setCreatedCreds({ email: createForm.email.trim(), password: createForm.password, businessName: createForm.businessName.trim() });
      setCreateForm({ email: "", firstName: "", lastName: "", businessName: "", password: "" });
      showToast("success", "Test account created");
      await refetch();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  function copyCredentials() {
    if (!createdCreds) return;
    const text = `Email: ${createdCreds.email}\nPassword: ${createdCreds.password}\nBusiness: ${createdCreds.businessName}\nLogin: https://portal.salontransact.com/login`;
    navigator.clipboard.writeText(text).then(
      () => showToast("success", "Credentials copied"),
      () => showToast("error", "Failed to copy")
    );
  }

  function closeModal() {
    setShowCreateModal(false);
    setCreatedCreds(null);
    setCreateForm({ email: "", firstName: "", lastName: "", businessName: "", password: "" });
  }

  const stats = useMemo(() => {
    const total = merchants.length;
    const active = merchants.filter((m) => m.status === "active").length;
    const pending = merchants.filter((m) => m.status === "pending").length;
    const totalVolume = merchants.reduce((s, m) => s + m.totalVolume, 0);
    return { total, active, pending, totalVolume };
  }, [merchants]);

  return (
    <>
      {/* Tab switcher */}
      <div style={{ display: "flex", gap: 4, padding: 4, background: "#F4F5F7", borderRadius: 8, marginBottom: 16, width: "fit-content" }}>
        <button
          onClick={() => setTab("active")}
          style={{
            padding: "6px 16px",
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            background: tab === "active" ? "#FFFFFF" : "transparent",
            color: tab === "active" ? "#1A1313" : "#878787",
            boxShadow: tab === "active" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
          }}
        >
          Active Merchants
        </button>
        <button
          onClick={() => setTab("invites")}
          style={{
            padding: "6px 16px",
            fontSize: 13,
            fontWeight: 500,
            borderRadius: 6,
            border: "none",
            cursor: "pointer",
            background: tab === "invites" ? "#FFFFFF" : "transparent",
            color: tab === "invites" ? "#1A1313" : "#878787",
            boxShadow: tab === "invites" ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
          }}
        >
          Invites
        </button>
      </div>

      {tab === "invites" ? <InvitesTab /> : (
      <>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatTile label="Total Merchants" value={stats.total.toString()} />
        <StatTile
          label="Active"
          value={stats.active.toString()}
          accent="#15803D"
        />
        <StatTile
          label="Pending"
          value={stats.pending.toString()}
          accent="#92400E"
        />
        <StatTile label="Total Volume" value={fmtMoney(stats.totalVolume)} />
      </div>

      {/* Filters */}
      <div
        className="bg-white rounded-xl p-4 mb-4"
        style={{ boxShadow: SHADOW }}
      >
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#878787] pointer-events-none"
            />
            <input
              type="text"
              placeholder=""
              aria-label="Search merchants"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 bg-[#F4F5F7] border border-[#E8EAED] rounded-lg text-[#1A1313] text-sm pl-10 pr-3 outline-none transition-all duration-150 focus:border-[#017ea7] focus:ring-[3px] focus:ring-[#017ea7]/10 focus:bg-white placeholder:text-[#ABABAB]"
            />
          </div>
          <div className="flex gap-2 scrollbar-hide overflow-x-auto">
            {(["all", "active", "pending", "suspended"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="h-10 px-3 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer whitespace-nowrap"
                style={{
                  background: statusFilter === s ? "#017ea7" : "#F4F5F7",
                  color: statusFilter === s ? "#FFFFFF" : "#4A4A4A",
                  border:
                    statusFilter === s
                      ? "1px solid #017ea7"
                      : "1px solid #E8EAED",
                }}
              >
                {s === "all"
                  ? "All"
                  : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            leadingIcon={<UserPlus size={14} />}
            onClick={() => setShowCreateModal(true)}
          >
            Create Test Account
          </Button>
        </div>
      </div>

      {/* Table */}
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: SHADOW }}
      >
        {loading && merchants.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#878787]">
            Loading merchants...
          </div>
        ) : merchants.length === 0 ? (
          <div className="p-12 text-center">
            <Building2
              size={32}
              className="mx-auto text-[#878787] mb-3"
              strokeWidth={1.5}
            />
            <p className="text-sm font-medium text-[#1A1313] mb-1">
              No merchants found
            </p>
            <p className="text-[13px] text-[#878787]">
              {searchQuery || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "No merchants on the platform yet"}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead style={{ background: "#F4F5F7" }}>
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-[#878787] text-xs uppercase tracking-wider">
                      Business
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[#878787] text-xs uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[#878787] text-xs uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-[#878787] text-xs uppercase tracking-wider">
                      Volume
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-[#878787] text-xs uppercase tracking-wider">
                      Txns
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[#878787] text-xs uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {merchants.map((m) => {
                    void 0; // pill replaced by StatusPill primitive
                    return (
                      <tr
                        key={m.id}
                        className="border-t hover:bg-[#FBFBFB] transition-colors"
                        style={{ borderColor: "#E8EAED" }}
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/master/merchants/${m.id}`}
                            className="font-medium text-[#1A1313] hover:text-[#017ea7] transition-colors"
                          >
                            {m.businessName}
                          </Link>
                          {m.dbaName && (
                            <div className="text-xs text-[#878787] mt-0.5">
                              dba {m.dbaName}
                            </div>
                          )}
                          {(m.city || m.state) && (
                            <div className="text-xs text-[#878787] mt-0.5">
                              {[m.city, m.state].filter(Boolean).join(", ")}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[#4A4A4A]">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Mail size={12} className="text-[#878787]" />
                            {m.email}
                          </div>
                          {m.phone && (
                            <div className="flex items-center gap-1.5 text-xs mt-0.5">
                              <Phone size={12} className="text-[#878787]" />
                              {m.phone}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill status={m.status} />
                        </td>
                        <td className="px-4 py-3 text-right font-medium text-[#1A1313] font-mono">
                          {fmtMoney(m.totalVolume)}
                        </td>
                        <td className="px-4 py-3 text-right text-[#4A4A4A] font-mono">
                          {m.totalTransactions.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-[#878787] text-xs whitespace-nowrap">
                          {fmtDate(m.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/master/merchants/${m.id}`}
                            className="text-[#017ea7] hover:text-[#015f80] transition-colors inline-flex items-center"
                            aria-label="View details"
                          >
                            <ChevronRight size={18} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#E8EAED]">
              {merchants.map((m) => {
                const pill = statusPillStyles(m.status);
                return (
                  <Link
                    key={m.id}
                    href={`/master/merchants/${m.id}`}
                    className="block px-4 py-4 hover:bg-[#FBFBFB] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <span className="font-medium text-[#1A1313] truncate">
                        {m.businessName}
                      </span>
                      <StatusPill status={m.status} />
                    </div>
                    <div className="flex items-baseline justify-between gap-2 mb-1">
                      <span className="text-base font-semibold text-[#1A1313] font-mono">
                        {fmtMoney(m.totalVolume)}
                      </span>
                      <span className="text-xs text-[#878787]">
                        {m.totalTransactions} txns
                      </span>
                    </div>
                    <div className="text-[12px] text-[#878787] truncate">
                      {m.email} · {fmtDate(m.createdAt)}
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </div>
      </>
      )}

      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      {showCreateModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={closeModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 4px 16px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.1)" }}
          >
            {!createdCreds ? (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>Create Test Merchant Account</h2>
                <p style={{ fontSize: 13, color: "#878787", marginBottom: 16 }}>Bypasses signup and onboarding. Charges enabled, payouts disabled.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Input label="Email" type="email" placeholder="user@example.com" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <Input label="First Name" placeholder="Chris" value={createForm.firstName} onChange={(e) => setCreateForm({ ...createForm, firstName: e.target.value })} />
                    <Input label="Last Name" placeholder="Boutwell" value={createForm.lastName} onChange={(e) => setCreateForm({ ...createForm, lastName: e.target.value })} />
                  </div>
                  <Input label="Business Name" placeholder="Payroc Test (Chris)" value={createForm.businessName} onChange={(e) => setCreateForm({ ...createForm, businessName: e.target.value })} />
                  <Input label="Password" type="text" placeholder="Minimum 8 characters" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} />
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
                  <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                  <Button variant="primary" onClick={handleCreateTestAccount} loading={creating}>Create</Button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "#15803D", marginBottom: 4 }}>Account Created</h2>
                <p style={{ fontSize: 13, color: "#878787", marginBottom: 16 }}>Send these credentials to the user. The password is shown once.</p>
                <div style={{ background: "#F9FAFB", borderRadius: 8, padding: 16, marginBottom: 16, fontFamily: "monospace", fontSize: 13, wordBreak: "break-all" }}>
                  <div style={{ marginBottom: 8 }}><span style={{ color: "#878787", fontWeight: 600 }}>Email:</span><br />{createdCreds.email}</div>
                  <div style={{ marginBottom: 8 }}><span style={{ color: "#878787", fontWeight: 600 }}>Password:</span><br />{createdCreds.password}</div>
                  <div style={{ marginBottom: 8 }}><span style={{ color: "#878787", fontWeight: 600 }}>Business:</span><br />{createdCreds.businessName}</div>
                  <div><span style={{ color: "#878787", fontWeight: 600 }}>Login:</span><br /><span style={{ color: "#017ea7" }}>https://portal.salontransact.com/login</span></div>
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="secondary" leadingIcon={<Copy size={14} />} onClick={copyCredentials}>Copy Credentials</Button>
                  <Button variant="primary" onClick={closeModal}>Done</Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="bg-white rounded-xl p-4" style={{ boxShadow: SHADOW }}>
      <p className="text-xs text-[#878787] uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className="text-xl font-semibold"
        style={{ color: accent ?? "#1A1313" }}
      >
        {value}
      </p>
    </div>
  );
}
