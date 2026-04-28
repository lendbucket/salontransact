"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Building2, Mail, Phone } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";
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
  const [merchants, setMerchants] =
    useState<MerchantSummary[]>(initialMerchants);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] =
    useState<MerchantStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

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

  const stats = useMemo(() => {
    const total = merchants.length;
    const active = merchants.filter((m) => m.status === "active").length;
    const pending = merchants.filter((m) => m.status === "pending").length;
    const totalVolume = merchants.reduce((s, m) => s + m.totalVolume, 0);
    return { total, active, pending, totalVolume };
  }, [merchants]);

  return (
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
