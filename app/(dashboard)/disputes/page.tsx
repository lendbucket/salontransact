"use client";

import { useState, useEffect } from "react";
import { Shield, Loader2, AlertCircle, Mail } from "lucide-react";
import { StatusPill } from "@/components/ui/status-pill";

type Dispute = {
  disputeId: string;
  paymentId: string;
  amount: number;
  currency: string;
  reason: string;
  status: string;
  createdAt: string;
  respondBy?: string;
};

function disputeStatusForPill(status: string | undefined): string {
  const s = (status ?? "").toLowerCase();
  if (["won", "closed", "resolved", "accepted"].includes(s)) return "active";
  if (["open", "inquiry", "pending", "reviewing", "under_review"].includes(s)) return "pending";
  if (["lost", "expired", "declined"].includes(s)) return "failed";
  return "neutral";
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/payroc/disputes")
      .then((r) => r.json())
      .then((data) => {
        setDisputes(data.disputes ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const openCount = disputes.filter(
    (d) => d.status === "open" || d.status === "under_review"
  ).length;

  return (
    <div className="p-6 md:p-8 max-w-6xl mx-auto">
      <h1
        className="text-2xl font-semibold mb-1"
        style={{ color: "#1A1313" }}
      >
        Disputes
      </h1>
      <p className="text-sm mb-6" style={{ color: "#878787" }}>
        View and respond to payment disputes
      </p>

      {/* Summary banner */}
      {!loading && (
        <div
          className="rounded-lg p-4 mb-4 flex items-center gap-3"
          style={{
            background: openCount > 0 ? "#FFF7ED" : "#F0FDF4",
            border: `1px solid ${openCount > 0 ? "#FDBA74" : "#BBF7D0"}`,
          }}
        >
          {openCount > 0 ? (
            <AlertCircle
              size={16}
              strokeWidth={1.5}
              style={{ color: "#9A3412" }}
            />
          ) : (
            <Shield
              size={16}
              strokeWidth={1.5}
              style={{ color: "#166534" }}
            />
          )}
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: openCount > 0 ? "#9A3412" : "#166534",
            }}
          >
            {openCount > 0
              ? `${openCount} open dispute${openCount > 1 ? "s" : ""} require your attention`
              : "No open disputes"}
          </span>
        </div>
      )}

      {/* How to respond instruction card */}
      {!loading && disputes.length > 0 && (
        <div
          className="rounded-lg p-4 mb-6 flex items-start gap-3"
          style={{
            background: "#E6F4F8",
            border: "1px solid #BAE6FD",
          }}
        >
          <Mail
            size={16}
            strokeWidth={1.5}
            style={{ color: "#015f80", marginTop: 2, flexShrink: 0 }}
          />
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "#015f80" }}>
            <p style={{ fontWeight: 600, marginBottom: 4 }}>
              Need to respond to a dispute?
            </p>
            <p>
              Email <a href="mailto:support@salontransact.com" style={{ color: "#017ea7", fontWeight: 500, textDecoration: "underline" }}>support@salontransact.com</a>{" "}
              with your dispute ID and any supporting evidence (receipts, signed agreements, communication with the customer). Our team will submit your response to the payment processor on your behalf before the deadline.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E8EAED",
          borderRadius: 12,
          overflow: "hidden",
        }}
      >
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2
              size={24}
              strokeWidth={1.5}
              className="animate-spin"
              style={{ color: "#878787" }}
            />
          </div>
        ) : disputes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "#F0FDF4",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <Shield
                size={20}
                strokeWidth={1.5}
                style={{ color: "#166534" }}
              />
            </div>
            <p
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: "#1A1313",
                marginBottom: 4,
              }}
            >
              No disputes
            </p>
            <p style={{ fontSize: 14, color: "#878787" }}>
              You have no open disputes
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block" style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 13 }}>
                <thead style={{ background: "#F9FAFB", borderBottom: "1px solid #E8EAED" }}>
                  <tr>
                    {[
                      "Date",
                      "Dispute ID",
                      "Transaction ID",
                      "Amount",
                      "Reason",
                      "Status",
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
                  {disputes.map((d) => (
                    <tr
                      key={d.disputeId}
                      style={{ borderTop: "1px solid #F4F5F7" }}
                    >
                      <td style={{ padding: "12px 16px", color: "#878787", fontSize: 13 }}>
                        {new Date(d.createdAt).toLocaleDateString()}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontFamily: "monospace",
                          fontSize: 12,
                          color: "#878787",
                        }}
                      >
                        {d.disputeId}
                      </td>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontFamily: "monospace",
                          fontSize: 12,
                          color: "#878787",
                        }}
                      >
                        {d.paymentId}
                      </td>
                      <td style={{ padding: "12px 16px", fontWeight: 500, color: "#1A1313" }}>
                        ${(d.amount / 100).toFixed(2)}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#1A1313" }}>{d.reason}</td>
                      <td style={{ padding: "12px 16px" }}>
                        <StatusPill status={disputeStatusForPill(d.status)} label={d.status.replace(/_/g, " ")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="md:hidden">
              {disputes.map((d) => (
                <div
                  key={d.disputeId}
                  style={{
                    padding: "14px 16px",
                    borderTop: "1px solid #F4F5F7",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", marginBottom: 2 }}>
                        ${(d.amount / 100).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 12, color: "#4A4A4A" }}>{d.reason}</div>
                    </div>
                    <div style={{ flexShrink: 0 }}>
                      <StatusPill status={disputeStatusForPill(d.status)} label={d.status.replace(/_/g, " ")} />
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "#878787",
                      fontFamily: "monospace",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.disputeId}
                  </div>
                  <div style={{ fontSize: 11, color: "#878787" }}>
                    {new Date(d.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
