"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Search,
  RefreshCw,
  CreditCard,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import type {
  SavedCardPublic,
  AllCardsListResponse,
} from "@/lib/saved-cards/types";

function fmtRelative(iso: string | null) {
  if (!iso) return "Never";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function expiryDisplay(month: string | null, year: string | null) {
  if (!month || !year) return "\u2014";
  return `${month}/${year.slice(-2)}`;
}

function isExpired(month: string | null, year: string | null): boolean {
  if (!month || !year) return false;
  const m = parseInt(month, 10);
  const y = parseInt(year, 10);
  if (!Number.isFinite(m) || !Number.isFinite(y)) return false;
  const expDate = new Date(y, m, 0);
  return expDate < new Date();
}

function maskBrand(scheme: string | null): string {
  if (!scheme) return "Card";
  const s = scheme.toLowerCase();
  if (s.includes("visa")) return "Visa";
  if (s.includes("mastercard") || s.includes("master")) return "Mastercard";
  if (s.includes("amex") || s.includes("american")) return "Amex";
  if (s.includes("discover")) return "Discover";
  return scheme;
}

interface Props {
  initialCards: SavedCardPublic[];
}

export function SavedCardsClient({ initialCards }: Props) {
  const [cards, setCards] = useState<SavedCardPublic[]>(initialCards);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "deleted"
  >("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedQuery.length > 0) params.set("q", debouncedQuery);
      const res = await fetch(`/api/saved-cards/list?${params.toString()}`);
      if (!res.ok) {
        showToast("error", "Failed to load saved cards");
        return;
      }
      const data = (await res.json()) as AllCardsListResponse;
      setCards(data.data);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Reload failed");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedQuery]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function handleRevoke(card: SavedCardPublic) {
    if (
      !confirm(
        `Revoke saved card ending in ${card.last4 ?? "****"} for ${card.customerEmail}?`
      )
    )
      return;

    setRevokingId(card.id);
    try {
      const res = await fetch(`/api/saved-cards/${card.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", j.error ?? `Revoke failed (${res.status})`);
        return;
      }
      showToast("success", "Card revoked");
      await refetch();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setRevokingId(null);
    }
  }

  const stats = useMemo(() => {
    const total = cards.length;
    const active = cards.filter((c) => c.status === "active").length;
    const customers = new Set(cards.map((c) => c.customerEmail)).size;
    return { total, active, customers };
  }, [cards]);

  return (
    <>
      {toast && (
        <div
          style={{
            position: "fixed",
            top: 80,
            right: 24,
            zIndex: 100,
            minWidth: 280,
          }}
        >
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <Card padding={16}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#878787",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            Total Cards
          </p>
          <p
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#1A1313",
              letterSpacing: "-0.31px",
            }}
          >
            {stats.total}
          </p>
        </Card>
        <Card padding={16}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#878787",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            Active
          </p>
          <p
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#15803D",
              letterSpacing: "-0.31px",
            }}
          >
            {stats.active}
          </p>
        </Card>
        <Card padding={16}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#878787",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              marginBottom: 4,
            }}
          >
            Customers
          </p>
          <p
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: "#1A1313",
              letterSpacing: "-0.31px",
            }}
          >
            {stats.customers}
          </p>
        </Card>
      </div>

      <Card padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <Input
              leadingIcon={<Search size={16} />}
              placeholder="Search by email, cardholder, last 4, or label..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1"
              style={{ minWidth: 220 }}
            />
            <Button
              variant="secondary"
              leadingIcon={<RefreshCw size={14} />}
              onClick={refetch}
              loading={loading}
            >
              Refresh
            </Button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["all", "active", "deleted"] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "primary" : "secondary"}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all"
                  ? "All"
                  : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <CardListBody
        cards={cards}
        loading={loading}
        revokingId={revokingId}
        onRevoke={handleRevoke}
        showMerchant={false}
      />
    </>
  );
}

/* ── Shared card list body (used by merchant + master views) ── */

interface CardListBodyProps {
  cards: SavedCardPublic[];
  loading: boolean;
  revokingId: string | null;
  onRevoke: (c: SavedCardPublic) => void;
  showMerchant: boolean;
  getMerchantName?: (c: SavedCardPublic) => string;
  getMerchantId?: (c: SavedCardPublic) => string;
}

export function CardListBody({
  cards,
  loading,
  revokingId,
  onRevoke,
  showMerchant,
  getMerchantName,
  getMerchantId,
}: CardListBodyProps) {
  if (loading && cards.length === 0) {
    return (
      <Card>
        <div
          style={{
            padding: 32,
            textAlign: "center",
            fontSize: 14,
            color: "#878787",
          }}
        >
          Loading saved cards...
        </div>
      </Card>
    );
  }

  if (cards.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <CreditCard
            size={48}
            strokeWidth={1.5}
            color="#878787"
            style={{ margin: "0 auto 16px" }}
          />
          <p
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: "#1A1313",
              marginBottom: 4,
            }}
          >
            No saved cards
          </p>
          <p style={{ fontSize: 14, color: "#878787" }}>
            Customer cards saved during checkout will appear here.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card noPadding>
      {/* Desktop table */}
      <div className="hidden md:block" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", fontSize: 13 }}>
          <thead style={{ background: "#F9FAFB" }}>
            <tr>
              <Th>Card</Th>
              <Th>Cardholder</Th>
              <Th>Customer</Th>
              {showMerchant && <Th>Merchant</Th>}
              <Th>Expires</Th>
              <Th>Last Used</Th>
              <Th>Status</Th>
              <th style={{ padding: "10px 16px" }} />
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => {
              const expired = isExpired(c.expiryMonth, c.expiryYear);
              return (
                <tr
                  key={c.id}
                  style={{ borderTop: "1px solid #F4F5F7" }}
                >
                  <Td mono>
                    {maskBrand(c.cardScheme)} \u2022\u2022\u2022\u2022
                    {c.last4 ?? "****"}
                    {c.label && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#878787",
                          marginTop: 2,
                        }}
                      >
                        {c.label}
                      </div>
                    )}
                  </Td>
                  <Td>{c.cardholderName ?? "\u2014"}</Td>
                  <Td muted>{c.customerEmail}</Td>
                  {showMerchant && getMerchantName && getMerchantId && (
                    <Td>
                      <a
                        href={`/master/saved-cards?merchantId=${getMerchantId(c)}`}
                        style={{ color: "#017ea7" }}
                      >
                        {getMerchantName(c)}
                      </a>
                    </Td>
                  )}
                  <Td muted>
                    <span
                      style={{
                        color: expired ? "#DC2626" : undefined,
                      }}
                    >
                      {expiryDisplay(c.expiryMonth, c.expiryYear)}
                    </span>
                  </Td>
                  <Td muted>{fmtRelative(c.lastUsedAt)}</Td>
                  <Td>
                    {expired && c.status === "active" ? (
                      <StatusPill status="failed" label="EXPIRED" />
                    ) : (
                      <StatusPill
                        status={
                          c.status === "deleted" ? "neutral" : "active"
                        }
                      />
                    )}
                  </Td>
                  <td style={{ padding: "14px 16px" }}>
                    {c.status === "active" && (
                      <Button
                        variant="icon"
                        onClick={() => onRevoke(c)}
                        loading={revokingId === c.id}
                        aria-label="Revoke card"
                      >
                        {revokingId === c.id ? null : (
                          <Trash2 size={16} />
                        )}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden">
        {cards.map((c) => {
          const expired = isExpired(c.expiryMonth, c.expiryYear);
          return (
            <div
              key={c.id}
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid #F4F5F7",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#1A1313",
                    fontFamily: "monospace",
                  }}
                >
                  {maskBrand(c.cardScheme)} \u2022\u2022\u2022\u2022
                  {c.last4 ?? "****"}
                </span>
                {expired && c.status === "active" ? (
                  <StatusPill status="failed" label="EXPIRED" />
                ) : (
                  <StatusPill
                    status={c.status === "deleted" ? "neutral" : "active"}
                  />
                )}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "#4A4A4A",
                  marginBottom: 2,
                }}
              >
                {c.cardholderName ?? "\u2014"} \u00B7 {c.customerEmail}
              </div>
              {showMerchant && getMerchantName && (
                <div style={{ fontSize: 12, color: "#017ea7" }}>
                  {getMerchantName(c)}
                </div>
              )}
              <div
                style={{ fontSize: 12, color: "#878787", marginTop: 2 }}
              >
                Exp {expiryDisplay(c.expiryMonth, c.expiryYear)} \u00B7
                Used {fmtRelative(c.lastUsedAt)}
              </div>
              {c.status === "active" && (
                <div style={{ marginTop: 8 }}>
                  <Button
                    variant="danger"
                    onClick={() => onRevoke(c)}
                    loading={revokingId === c.id}
                    leadingIcon={<Trash2 size={14} />}
                  >
                    Revoke
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      style={{
        textAlign: "left",
        padding: "10px 16px",
        fontSize: 11,
        fontWeight: 600,
        color: "#878787",
        textTransform: "uppercase",
        letterSpacing: "0.08em",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  muted,
  mono,
}: {
  children: React.ReactNode;
  muted?: boolean;
  mono?: boolean;
}) {
  return (
    <td
      style={{
        padding: "14px 16px",
        fontSize: 13,
        color: muted ? "#4A4A4A" : "#1A1313",
        fontFamily: mono ? "monospace" : undefined,
      }}
    >
      {children}
    </td>
  );
}
