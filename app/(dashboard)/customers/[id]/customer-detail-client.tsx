"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, User, CreditCard, Receipt } from "lucide-react";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import type { CustomerDetail } from "@/lib/customers/types";

interface Props {
  customerId: string;
  mode: "merchant" | "master";
}

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function fmtMoneyDollars(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function CustomerDetailClient({ customerId, mode }: Props) {
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const url = mode === "master"
          ? `/api/master/customers/${customerId}`
          : `/api/customers/${customerId}`;
        const res = await fetch(url);
        if (!res.ok) {
          showToast("error", "Customer not found");
          return;
        }
        const data = (await res.json()) as CustomerDetail;
        setCustomer(data);
      } catch (e) {
        showToast("error", e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
      }
    })();
  }, [customerId, mode, showToast]);

  const backHref = mode === "master" ? "/master/customers" : "/customers";

  if (loading) {
    return (
      <Card padding={32}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#878787", gap: 8 }}>
          <Loader2 size={16} className="animate-spin" />
          <span style={{ fontSize: 13 }}>Loading customer…</span>
        </div>
      </Card>
    );
  }

  if (!customer) {
    return (
      <>
        <div style={{ marginBottom: 16 }}>
          <Link href={backHref} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#017ea7", textDecoration: "none" }}>
            <ArrowLeft size={14} /> Back to customers
          </Link>
        </div>
        <Card padding={32}>
          <p style={{ textAlign: "center", color: "#878787", fontSize: 13 }}>Customer not found.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Link href={backHref} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#017ea7", textDecoration: "none" }}>
          <ArrowLeft size={14} /> Back to customers
        </Link>
      </div>

      {/* Hero card */}
      <Card padding={24} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 24, background: "#E6F4F8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <User size={24} color="#017ea7" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px", margin: 0, marginBottom: 4 }}>
              {customer.email}
            </h1>
            {customer.name && <p style={{ fontSize: 14, color: "#4A4A4A", margin: 0 }}>{customer.name}</p>}
            {mode === "master" && customer.merchantName && (
              <p style={{ fontSize: 12, color: "#878787", margin: "4px 0 0" }}>{customer.merchantName}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatMini label="Total Spent" value={fmtMoney(customer.totalSpentCents)} />
          <StatMini label="Transactions" value={customer.totalTransactions.toString()} />
          <StatMini label="Saved Cards" value={customer.savedCards.length.toString()} />
          <StatMini label="Last Seen" value={fmtDateLocale(customer.lastSeenAt)} />
        </div>
      </Card>

      {/* Saved Cards */}
      <Card padding={20} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <CreditCard size={14} color="#878787" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", margin: 0 }}>
            Saved Cards ({customer.savedCards.length})
          </h2>
        </div>
        {customer.savedCards.length === 0 ? (
          <p style={{ fontSize: 13, color: "#878787" }}>No saved cards.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {customer.savedCards.map((card) => (
              <div key={card.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #F4F5F7", gap: 12, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", fontFamily: "monospace" }}>
                    {card.cardScheme ?? "Card"} ····{card.last4 ?? "????"}
                  </span>
                  {card.label && <span style={{ fontSize: 11, color: "#878787" }}>{card.label}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "#878787" }}>
                    {card.expiryMonth}/{card.expiryYear}
                  </span>
                  <StatusPill status={card.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent Transactions */}
      <Card padding={20}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Receipt size={14} color="#878787" />
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", margin: 0 }}>
            Recent Transactions ({customer.recentTransactions.length})
          </h2>
        </div>
        {customer.recentTransactions.length === 0 ? (
          <p style={{ fontSize: 13, color: "#878787" }}>No transactions.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {customer.recentTransactions.map((txn) => (
              <div key={txn.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderTop: "1px solid #F4F5F7", gap: 12, flexWrap: "wrap" }}>
                <div style={{ minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>
                    {fmtMoneyDollars(txn.amount)}
                  </span>
                  {txn.description && <span style={{ fontSize: 12, color: "#878787", marginLeft: 8 }}>{txn.description}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: "#878787" }}>{fmtDateLocale(txn.createdAt)}</span>
                  <StatusPill status={txn.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

function StatMini({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: 12, background: "#F9FAFB", borderRadius: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{value}</p>
    </div>
  );
}
