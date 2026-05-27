"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Repeat, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";

export interface SerializedPlan {
  id: string;
  merchantId: string;
  name: string;
  description: string | null;
  status: string;
  amountCents: number;
  currency: string;
  taxable: boolean;
  interval: string;
  intervalCount: number;
  trialDays: number | null;
  publicSignupEnabled: boolean;
  publicSignupSlug: string | null;
  createdAt: string;
  updatedAt: string;
  activeSubscriptionCount: number;
}

function fmtRelative(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function fmtAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function fmtInterval(interval: string, count: number): string {
  const unit = interval.toLowerCase();
  return `Every ${count} ${unit}${count > 1 ? "s" : ""}`;
}

interface Props {
  initialPlans: SerializedPlan[];
}

type StatusFilter = "active" | "archived" | "all";

export function PlansListClient({ initialPlans }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let list = initialPlans;
    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [initialPlans, statusFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = initialPlans.length;
    const active = initialPlans.filter((p) => p.status === "active").length;
    const archived = initialPlans.filter((p) => p.status === "archived").length;
    const activeSubs = initialPlans.reduce(
      (sum, p) => sum + p.activeSubscriptionCount,
      0
    );
    return { total, active, archived, activeSubs };
  }, [initialPlans]);

  const filterButtons: { label: string; value: StatusFilter }[] = [
    { label: "Active", value: "active" },
    { label: "Archived", value: "archived" },
    { label: "All", value: "all" },
  ];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
        }}
      >
        <h2
          style={{
            fontSize: 18,
            fontWeight: 600,
            color: "#1A1313",
            letterSpacing: "-0.31px",
            margin: 0,
          }}
        >
          Plans
        </h2>
        <Button
          leadingIcon={<Plus size={14} />}
          onClick={() => router.push("/subscriptions/plans/new")}
        >
          New Plan
        </Button>
      </div>

      {/* Stats */}
      <div
        className="grid grid-cols-2 md:grid-cols-4"
        style={{ gap: 12, marginBottom: 24 }}
      >
        {[
          { label: "Total Plans", value: stats.total },
          { label: "Active", value: stats.active },
          { label: "Archived", value: stats.archived },
          { label: "Active Subs", value: stats.activeSubs },
        ].map((stat) => (
          <Card key={stat.label} padding={16}>
            <p
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#878787",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                margin: 0,
              }}
            >
              {stat.label}
            </p>
            <p
              style={{
                fontSize: 24,
                fontWeight: 600,
                letterSpacing: "-0.31px",
                color: "#1A1313",
                margin: "4px 0 0",
              }}
            >
              {stat.value}
            </p>
          </Card>
        ))}
      </div>

      {/* Filters + search */}
      <div
        className="flex flex-col md:flex-row"
        style={{ gap: 12, marginBottom: 20 }}
      >
        <div style={{ display: "flex", gap: 4 }}>
          {filterButtons.map((fb) => (
            <Button
              key={fb.value}
              variant={statusFilter === fb.value ? "primary" : "secondary"}
              onClick={() => setStatusFilter(fb.value)}
              style={{ fontSize: 13, height: 32, padding: "0 12px" }}
            >
              {fb.label}
            </Button>
          ))}
        </div>
        <div style={{ flex: 1, maxWidth: 300 }}>
          <Input
            placeholder="Search plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leadingIcon={<Search size={14} />}
          />
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <Card padding={48}>
          <div style={{ textAlign: "center" }}>
            <Repeat
              size={40}
              strokeWidth={1.2}
              style={{ color: "#878787", marginBottom: 16 }}
            />
            <p
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: "#1A1313",
                marginBottom: 4,
              }}
            >
              {initialPlans.length === 0
                ? "No plans yet"
                : "No plans match your filter"}
            </p>
            <p style={{ fontSize: 14, color: "#878787", marginBottom: 20 }}>
              {initialPlans.length === 0
                ? "Create a subscription plan to start recurring billing."
                : "Try a different filter or search term."}
            </p>
            {initialPlans.length === 0 && (
              <Button
                leadingIcon={<Plus size={14} />}
                onClick={() => router.push("/subscriptions/plans/new")}
              >
                Create your first plan
              </Button>
            )}
          </div>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card noPadding>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      background: "#F9FAFB",
                      borderBottom: "1px solid #E8EAED",
                    }}
                  >
                    {[
                      "Name",
                      "Pricing",
                      "Interval",
                      "Status",
                      "Active Subs",
                      "Updated",
                    ].map((h) => (
                      <th
                        key={h}
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
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((plan) => (
                    <tr
                      key={plan.id}
                      onClick={() =>
                        router.push(`/subscriptions/plans/${plan.id}`)
                      }
                      style={{
                        borderBottom: "1px solid #E8EAED",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "#F4F5F7")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: 14,
                          fontWeight: 500,
                          color: "#1A1313",
                        }}
                      >
                        {plan.name}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: 14,
                          color: "#1A1313",
                        }}
                      >
                        {fmtAmount(plan.amountCents)}
                        {plan.taxable && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 10,
                              fontWeight: 600,
                              color: "#878787",
                              background: "#F4F5F7",
                              padding: "2px 6px",
                              borderRadius: 4,
                              textTransform: "uppercase",
                              letterSpacing: "0.05em",
                            }}
                          >
                            taxable
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: 14,
                          color: "#4A4A4A",
                        }}
                      >
                        {fmtInterval(plan.interval, plan.intervalCount)}
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusPill status={plan.status} />
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: 14,
                          fontWeight:
                            plan.activeSubscriptionCount > 0 ? 600 : 400,
                          color: "#1A1313",
                        }}
                      >
                        {plan.activeSubscriptionCount}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontSize: 13,
                          color: "#878787",
                        }}
                      >
                        {fmtRelative(plan.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((plan) => (
              <Card
                key={plan.id}
                padding={16}
                onClick={() =>
                  router.push(`/subscriptions/plans/${plan.id}`)
                }
                style={{ cursor: "pointer" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: 8,
                  }}
                >
                  <p
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: "#1A1313",
                      margin: 0,
                    }}
                  >
                    {plan.name}
                  </p>
                  <StatusPill status={plan.status} />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 16,
                    fontSize: 13,
                    color: "#4A4A4A",
                  }}
                >
                  <span>
                    {fmtAmount(plan.amountCents)}
                    {plan.taxable && (
                      <span style={{ color: "#878787", marginLeft: 4 }}>
                        (taxable)
                      </span>
                    )}
                  </span>
                  <span>{fmtInterval(plan.interval, plan.intervalCount)}</span>
                  <span>
                    {plan.activeSubscriptionCount} sub
                    {plan.activeSubscriptionCount !== 1 ? "s" : ""}
                  </span>
                  <span style={{ color: "#878787" }}>
                    {fmtRelative(plan.updatedAt)}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
