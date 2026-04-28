"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { CardListBody } from "@/app/(dashboard)/saved-cards/saved-cards-client";
import type {
  MasterSavedCardRow,
  MasterSavedCardListResponse,
  SavedCardPublic,
} from "@/lib/saved-cards/types";

interface Props {
  initialCards: MasterSavedCardRow[];
  scopedMerchantId: string | null;
}

export function MasterSavedCardsClient({
  initialCards,
  scopedMerchantId,
}: Props) {
  const [cards, setCards] = useState<MasterSavedCardRow[]>(initialCards);
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
      if (scopedMerchantId) params.set("merchantId", scopedMerchantId);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (debouncedQuery.length > 0) params.set("q", debouncedQuery);
      const res = await fetch(
        `/api/master/saved-cards?${params.toString()}`
      );
      if (!res.ok) {
        showToast("error", "Failed to load saved cards");
        return;
      }
      const data = (await res.json()) as MasterSavedCardListResponse;
      setCards(data.data);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Reload failed");
    } finally {
      setLoading(false);
    }
  }, [scopedMerchantId, statusFilter, debouncedQuery]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  async function handleRevoke(card: SavedCardPublic) {
    const mc = card as MasterSavedCardRow;
    if (
      !confirm(
        `Revoke card ending in ${card.last4 ?? "****"} for ${card.customerEmail} at ${mc.merchantBusinessName}?`
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
    const merchants = new Set(cards.map((c) => c.merchantId)).size;
    return { total, active, customers, merchants };
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Cards</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{stats.total}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Active</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#15803D", letterSpacing: "-0.31px" }}>{stats.active}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Customers</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{stats.customers}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Merchants</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{stats.merchants}</p>
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
              placeholder="Search by email, cardholder, last 4, label, or merchant..."
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
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
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
            {scopedMerchantId && (
              <Button
                variant="ghost"
                leadingIcon={<X size={14} />}
                onClick={() =>
                  (window.location.href = "/master/saved-cards")
                }
              >
                Clear merchant filter
              </Button>
            )}
          </div>
        </div>
      </Card>

      <CardListBody
        cards={cards}
        loading={loading}
        revokingId={revokingId}
        onRevoke={handleRevoke}
        showMerchant={true}
        getMerchantName={(c) =>
          (c as MasterSavedCardRow).merchantBusinessName
        }
        getMerchantId={(c) => (c as MasterSavedCardRow).merchantId}
      />
    </>
  );
}
