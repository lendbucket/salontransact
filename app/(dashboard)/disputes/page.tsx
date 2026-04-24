"use client";

import { useState, useEffect } from "react";
import { Shield, Loader2, AlertCircle } from "lucide-react";

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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    open: "badge badge-error",
    under_review: "badge badge-warning",
    won: "badge badge-success",
    lost: "badge badge-neutral",
  };
  return (
    <span className={map[status] ?? "badge badge-neutral"}>
      <span className="badge-dot" />
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondTo, setRespondTo] = useState<Dispute | null>(null);
  const [evidence, setEvidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch("/api/payroc/disputes")
      .then((r) => r.json())
      .then((data) => {
        setDisputes(data.disputes ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleRespond() {
    if (!respondTo) return;
    setSubmitting(true);
    await fetch("/api/payroc/disputes/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        disputeId: respondTo.disputeId,
        evidence,
      }),
    });
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setRespondTo(null);
      setEvidence("");
      setSubmitted(false);
    }, 2000);
  }

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
        Manage and respond to payment disputes
      </p>

      {/* Summary banner */}
      {!loading && (
        <div
          className="rounded-lg p-4 mb-6 flex items-center gap-3"
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

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
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
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    "Date",
                    "Dispute ID",
                    "Transaction ID",
                    "Amount",
                    "Reason",
                    "Status",
                    "Actions",
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {disputes.map((d) => (
                  <tr key={d.disputeId}>
                    <td style={{ color: "#878787", fontSize: 13 }}>
                      {new Date(d.createdAt).toLocaleDateString()}
                    </td>
                    <td
                      style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#878787",
                      }}
                    >
                      {d.disputeId}
                    </td>
                    <td
                      style={{
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#878787",
                      }}
                    >
                      {d.paymentId}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      ${(d.amount / 100).toFixed(2)}
                    </td>
                    <td>{d.reason}</td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td>
                      {(d.status === "open" ||
                        d.status === "under_review") && (
                        <button
                          onClick={() => setRespondTo(d)}
                          className="inline-flex items-center gap-2 px-3 h-8 bg-[#017ea7] hover:bg-[#0290be] text-white text-xs font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer"
                        >
                          Respond
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Respond Modal */}
      {respondTo && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            background: "rgba(0,0,0,0.4)",
            backdropFilter: "blur(4px)",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 480,
              background: "#FFFFFF",
              border: "1px solid #E8EAED",
              borderRadius: 12,
              padding: 24,
              boxShadow:
                "0 0 0 1px rgba(0,0,0,0.05), 0 8px 32px rgba(0,0,0,0.15)",
            }}
          >
            {submitted ? (
              <div style={{ textAlign: "center", padding: "24px 0" }}>
                <Shield
                  size={32}
                  strokeWidth={1.5}
                  style={{ color: "#166534", margin: "0 auto 12px" }}
                />
                <p
                  style={{
                    fontSize: 16,
                    fontWeight: 600,
                    color: "#1A1313",
                  }}
                >
                  Response submitted
                </p>
              </div>
            ) : (
              <>
                <h3 style={{ marginBottom: 16 }}>Respond to Dispute</h3>
                <div
                  style={{
                    fontSize: 13,
                    color: "#878787",
                    marginBottom: 16,
                  }}
                >
                  <p>
                    Dispute:{" "}
                    <span
                      style={{
                        fontFamily: "monospace",
                        color: "#1A1313",
                      }}
                    >
                      {respondTo.disputeId}
                    </span>
                  </p>
                  <p>
                    Amount:{" "}
                    <span style={{ color: "#1A1313", fontWeight: 500 }}>
                      ${(respondTo.amount / 100).toFixed(2)}
                    </span>
                  </p>
                  <p>Reason: {respondTo.reason}</p>
                </div>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "#4A4A4A",
                    marginBottom: 6,
                  }}
                >
                  Evidence / Response
                </label>
                <textarea
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="Describe why this charge is valid..."
                  rows={4}
                  style={{
                    width: "100%",
                    background: "#F4F5F7",
                    border: "1px solid #E8EAED",
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: "#1A1313",
                    resize: "vertical",
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
                <p
                  style={{
                    fontSize: 12,
                    color: "#878787",
                    marginTop: 8,
                    marginBottom: 20,
                  }}
                >
                  To submit documents, email support@salontransact.com with
                  dispute ID
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => {
                      setRespondTo(null);
                      setEvidence("");
                    }}
                    className="inline-flex items-center gap-2 px-4 h-9 bg-white hover:bg-[#F4F5F7] text-[#1A1313] text-sm font-medium rounded-lg border border-[#D1D5DB] transition-all duration-150 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRespond}
                    disabled={submitting || !evidence.trim()}
                    className="inline-flex items-center gap-2 px-4 h-9 bg-[#017ea7] hover:bg-[#0290be] text-white text-sm font-medium rounded-lg border border-[#015f80] transition-all duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {submitting && (
                      <Loader2
                        size={14}
                        strokeWidth={1.5}
                        className="animate-spin"
                      />
                    )}
                    Submit Response
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
