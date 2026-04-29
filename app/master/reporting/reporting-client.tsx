"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, TrendingUp, DollarSign, Users, CreditCard } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";
import type {
  ReportingWindow,
  SummaryResponse,
  TopMerchantsResponse,
  VelocityResponse,
} from "@/lib/reporting/types";

const WINDOWS: ReportingWindow[] = [7, 30, 90];

function fmtMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function fmtCount(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ReportingClient() {
  const [window, setWindow] = useState<ReportingWindow>(30);
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [topMerchants, setTopMerchants] = useState<TopMerchantsResponse | null>(null);
  const [velocity, setVelocity] = useState<VelocityResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchAll = useCallback(
    async (days: ReportingWindow, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [s, t, v] = await Promise.all([
          fetch(`/api/master/reporting/summary?days=${days}`).then((r) => {
            if (!r.ok) throw new Error(`Summary failed (${r.status})`);
            return r.json() as Promise<SummaryResponse>;
          }),
          fetch(`/api/master/reporting/top-merchants?days=${days}&limit=10`).then((r) => {
            if (!r.ok) throw new Error(`Top merchants failed (${r.status})`);
            return r.json() as Promise<TopMerchantsResponse>;
          }),
          fetch(`/api/master/reporting/velocity?days=${days}&limit=5`).then((r) => {
            if (!r.ok) throw new Error(`Velocity failed (${r.status})`);
            return r.json() as Promise<VelocityResponse>;
          }),
        ]);
        setSummary(s);
        setTopMerchants(t);
        setVelocity(v);
      } catch (e) {
        showToast("error", e instanceof Error ? e.message : "Load failed");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    fetchAll(window);
  }, [fetchAll, window]);

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      {/* Time window selector */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4, padding: 4, background: "#F4F5F7", borderRadius: 8 }}>
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setWindow(w)}
              style={{
                padding: "6px 16px",
                fontSize: 13,
                fontWeight: 500,
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                background: window === w ? "#FFFFFF" : "transparent",
                color: window === w ? "#1A1313" : "#878787",
                boxShadow: window === w ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
              }}
            >
              Last {w} days
            </button>
          ))}
        </div>
        <Button
          variant="secondary"
          leadingIcon={<RefreshCw size={14} />}
          onClick={() => fetchAll(window, true)}
          loading={refreshing}
        >
          Refresh
        </Button>
      </div>

      {loading ? (
        <Card padding={32}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#878787", gap: 8 }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 13 }}>Loading reporting…</span>
          </div>
        </Card>
      ) : !summary ? (
        <Card padding={32}>
          <p style={{ textAlign: "center", color: "#878787", fontSize: 13 }}>No data available</p>
        </Card>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Total Volume"
              value={fmtMoney(summary.totalVolumeCents)}
              icon={DollarSign}
            />
            <StatCard
              title="Transactions"
              value={fmtCount(summary.transactionCount)}
              icon={TrendingUp}
            />
            <StatCard
              title="Active Merchants"
              value={fmtCount(summary.activeMerchantCount)}
              icon={Users}
            />
            <StatCard
              title="Avg Ticket"
              value={fmtMoney(summary.averageTicketCents)}
              icon={CreditCard}
            />
          </div>

          {/* Volume over time chart */}
          <Card padding={20} style={{ marginBottom: 24 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", margin: 0, marginBottom: 4 }}>
                Volume over time
              </h2>
              <p style={{ fontSize: 12, color: "#878787", margin: 0 }}>
                Daily transaction volume for the last {window} days
              </p>
            </div>
            <div style={{ width: "100%", height: 280 }}>
              <ResponsiveContainer>
                <AreaChart
                  data={summary.dailyVolume.map((d) => ({
                    date: fmtDateShort(d.date),
                    volume: d.volumeCents / 100,
                  }))}
                  margin={{ top: 8, right: 8, left: 8, bottom: 8 }}
                >
                  <defs>
                    <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#017ea7" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#017ea7" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F4F5F7" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#878787" }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#878787" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) =>
                      new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        notation: "compact",
                        maximumFractionDigits: 1,
                      }).format(v as number)
                    }
                  />
                  <Tooltip
                    formatter={(value) => fmtMoney(Math.round(Number(value ?? 0) * 100))}
                    contentStyle={{
                      background: "#FFFFFF",
                      border: "1px solid #E8EAED",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "#1A1313", fontWeight: 600 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="volume"
                    stroke="#017ea7"
                    strokeWidth={2}
                    fill="url(#volumeGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Top merchants table */}
          <Card noPadding style={{ marginBottom: 24 }}>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #F4F5F7" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", margin: 0, marginBottom: 4 }}>
                Top merchants by volume
              </h2>
              <p style={{ fontSize: 12, color: "#878787", margin: 0 }}>
                Top {topMerchants?.data.length ?? 0} merchants for the last {window} days
              </p>
            </div>
            {!topMerchants || topMerchants.data.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#878787", fontSize: 13 }}>
                No merchant activity in this window
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 13 }}>
                  <thead style={{ background: "#F9FAFB" }}>
                    <tr>
                      <Th>Rank</Th>
                      <Th>Business</Th>
                      <Th>Volume</Th>
                      <Th>Transactions</Th>
                      <Th>Avg Ticket</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {topMerchants.data.map((m) => (
                      <tr key={m.merchantId} style={{ borderTop: "1px solid #F4F5F7" }}>
                        <Td>
                          <span style={{ fontWeight: 600, color: m.rank <= 3 ? "#017ea7" : "#1A1313" }}>
                            #{m.rank}
                          </span>
                        </Td>
                        <Td>{m.businessName}</Td>
                        <Td>{fmtMoney(m.volumeCents)}</Td>
                        <Td muted>{fmtCount(m.transactionCount)}</Td>
                        <Td muted>{fmtMoney(m.averageTicketCents)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Velocity table */}
          <Card noPadding>
            <div style={{ padding: "16px 20px 12px", borderBottom: "1px solid #F4F5F7" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", margin: 0, marginBottom: 4 }}>
                Transaction velocity
              </h2>
              <p style={{ fontSize: 12, color: "#878787", margin: 0 }}>
                Top {velocity?.data.length ?? 0} merchants by transactions per day
              </p>
            </div>
            {!velocity || velocity.data.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "#878787", fontSize: 13 }}>
                No merchant activity in this window
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 13 }}>
                  <thead style={{ background: "#F9FAFB" }}>
                    <tr>
                      <Th>Rank</Th>
                      <Th>Business</Th>
                      <Th>Transactions ({window}d)</Th>
                      <Th>Avg / day</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {velocity.data.map((m) => (
                      <tr key={m.merchantId} style={{ borderTop: "1px solid #F4F5F7" }}>
                        <Td>
                          <span style={{ fontWeight: 600, color: m.rank <= 3 ? "#017ea7" : "#1A1313" }}>
                            #{m.rank}
                          </span>
                        </Td>
                        <Td>{m.businessName}</Td>
                        <Td muted>{fmtCount(m.transactionCount)}</Td>
                        <Td muted>{m.avgPerDay.toFixed(2)}</Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
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
