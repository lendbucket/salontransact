"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Search, ChevronRight, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import type { CustomerListResponse, CustomerSummary } from "@/lib/customers/types";

interface Props {
  mode: "merchant" | "master";
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

export function CustomersClient({ mode }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [data, setData] = useState<CustomerListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.length > 0) params.set("search", debouncedSearch);
      const url = mode === "master"
        ? `/api/master/customers?${params.toString()}`
        : `/api/customers?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Load failed (${res.status})`);
        return;
      }
      const json = (await res.json()) as CustomerListResponse;
      setData(json);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [mode, debouncedSearch, showToast]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const rows = data?.data ?? [];
  const linkPrefix = mode === "master" ? "/master/customers" : "/customers";

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div style={{ marginBottom: 16, maxWidth: 480 }}>
        <Input
          leadingIcon={<Search size={14} />}
          placeholder="Search by email or name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoComplete="off"
        />
      </div>

      {loading ? (
        <Card padding={32}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#878787", gap: 8 }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 13 }}>Loading customers…</span>
          </div>
        </Card>
      ) : rows.length === 0 ? (
        <Card padding={48}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 16px", borderRadius: 9999, background: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={32} strokeWidth={1.5} color="#878787" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>
              {debouncedSearch.length > 0 ? "No customers match that search" : "No customers yet"}
            </p>
            <p style={{ fontSize: 13, color: "#878787" }}>
              {debouncedSearch.length > 0 ? "Try a different email or name." : "Customers appear here when payments are processed with email."}
            </p>
          </div>
        </Card>
      ) : (
        <Card noPadding>
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead style={{ background: "#F9FAFB" }}>
                <tr>
                  <Th>Email</Th>
                  <Th>Name</Th>
                  {mode === "master" && <Th>Merchant</Th>}
                  <Th>Last Seen</Th>
                  <Th>Transactions</Th>
                  <Th>Total Spent</Th>
                  <Th>Cards</Th>
                  <th style={{ padding: "10px 16px" }} />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} style={{ borderTop: "1px solid #F4F5F7" }}>
                    <Td><span style={{ fontWeight: 600, color: "#1A1313" }}>{row.email}</span></Td>
                    <Td muted>{row.name ?? "—"}</Td>
                    {mode === "master" && <Td muted>{row.merchantName ?? "—"}</Td>}
                    <Td muted>{fmtDateLocale(row.lastSeenAt)}</Td>
                    <Td muted>{fmtCount(row.totalTransactions)}</Td>
                    <Td>{fmtMoney(row.totalSpentCents)}</Td>
                    <Td muted>{row.savedCardCount}</Td>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`${linkPrefix}/${row.id}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 13, color: "#017ea7", textDecoration: "none", fontWeight: 500 }}>
                        View<ChevronRight size={14} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            {rows.map((row) => (
              <Link
                key={row.id}
                href={`${linkPrefix}/${row.id}`}
                style={{ display: "block", padding: "14px 16px", borderTop: "1px solid #F4F5F7", textDecoration: "none", color: "inherit" }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {row.email}
                </div>
                {row.name && <div style={{ fontSize: 12, color: "#4A4A4A", marginBottom: 4 }}>{row.name}</div>}
                {mode === "master" && row.merchantName && <div style={{ fontSize: 11, color: "#878787", marginBottom: 4 }}>{row.merchantName}</div>}
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#878787", marginTop: 4 }}>
                  <span>{fmtCount(row.totalTransactions)} txns · {row.savedCardCount} cards</span>
                  <span>{fmtMoney(row.totalSpentCents)}</span>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{ textAlign: "left", padding: "10px 16px", fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>
      {children}
    </th>
  );
}

function Td({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <td style={{ padding: "12px 16px", fontSize: 13, color: muted ? "#4A4A4A" : "#1A1313" }}>
      {children}
    </td>
  );
}
