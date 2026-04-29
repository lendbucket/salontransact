"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  FileText,
  Building2,
  MapPin,
  User,
  Banknote,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import {
  type ApplicationDetail,
  APPLICATION_STATUS_LABELS,
} from "@/lib/applications/types";

interface Props {
  initialApplication: ApplicationDetail;
}

function statusKind(status: string): string {
  if (status === "active") return "active";
  if (status === "approved") return "active";
  if (status === "submitted_to_payroc") return "pending";
  if (status === "submitted") return "pending";
  if (status === "rejected") return "failed";
  return "neutral";
}

export function ApplicationDetailClient({ initialApplication }: Props) {
  const [app, setApp] = useState(initialApplication);
  const [actionLoading, setActionLoading] = useState<"approve" | "reject" | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [internalNotes, setInternalNotes] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [agreementLoading, setAgreementLoading] = useState(false);
  const [submitToPayrocLoading, setSubmitToPayrocLoading] = useState(false);
  const [markActiveModalOpen, setMarkActiveModalOpen] = useState(false);
  const [markActiveLoading, setMarkActiveLoading] = useState(false);
  const [payrocMidInput, setPayrocMidInput] = useState("");
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  async function handleApprove() {
    setActionLoading("approve");
    try {
      const res = await fetch(`/api/master/applications/${app.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ internalNotes: internalNotes.trim() || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Approve failed (${res.status})`);
        return;
      }
      const data = await res.json();
      showToast("success", data.emailSent ? "Approved + email sent" : "Approved (email failed)");
      setApp({ ...app, status: "approved", approvedAt: new Date().toISOString() });
      setShowApproveModal(false);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Approve failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject() {
    setActionLoading("reject");
    try {
      const res = await fetch(`/api/master/applications/${app.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: rejectionReason.trim() || null,
          internalNotes: internalNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Reject failed (${res.status})`);
        return;
      }
      const data = await res.json();
      showToast("success", data.emailSent ? "Rejected + email sent" : "Rejected (email failed)");
      setApp({ ...app, status: "rejected", rejectedAt: new Date().toISOString(), rejectionReason: rejectionReason.trim() || null });
      setShowRejectModal(false);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Reject failed");
    } finally {
      setActionLoading(null);
    }
  }

  async function fetchAgreementUrl() {
    if (!app.signedAgreementContractId) return;
    setAgreementLoading(true);
    try {
      const res = await fetch(`/api/contracts/${app.signedAgreementContractId}/signed-url`);
      if (!res.ok) {
        showToast("error", "Failed to load agreement");
        return;
      }
      const data = (await res.json()) as { url: string };
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setAgreementLoading(false);
    }
  }

  async function handleSubmitToPayroc() {
    if (!confirm("Submit this application to Payroc? This marks that you've sent the ERF.")) return;
    setSubmitToPayrocLoading(true);
    try {
      const res = await fetch(`/api/master/applications/${app.id}/submit-to-payroc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", (data as { error?: string }).error ?? `Failed (${res.status})`);
        return;
      }
      showToast("success", "Submitted to Payroc");
      window.location.reload();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitToPayrocLoading(false);
    }
  }

  async function handleMarkActive() {
    const trimmedMid = payrocMidInput.trim();
    if (trimmedMid.length === 0) {
      showToast("error", "Please enter the Payroc MID from the cert letter");
      return;
    }
    setMarkActiveLoading(true);
    try {
      const res = await fetch(`/api/master/applications/${app.id}/mark-active`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payrocMid: trimmedMid }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast("error", (data as { error?: string }).error ?? `Failed (${res.status})`);
        return;
      }
      showToast("success", `Merchant activated with MID ${trimmedMid}`);
      setMarkActiveModalOpen(false);
      window.location.reload();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Failed");
    } finally {
      setMarkActiveLoading(false);
    }
  }

  const textareaStyle: React.CSSProperties = {
    width: "100%",
    minHeight: 80,
    padding: 10,
    borderRadius: 8,
    border: "1px solid #E8EAED",
    background: "#F4F5F7",
    fontSize: 13,
    fontFamily: "inherit",
    color: "#1A1313",
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    marginBottom: 16,
  };

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Link
          href="/master/applications"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#017ea7", textDecoration: "none" }}
        >
          <ArrowLeft size={14} />
          Back to applications
        </Link>
      </div>

      <Card padding={24} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px", margin: 0, marginBottom: 4 }}>
              {app.legalBusinessName}
            </h1>
            {app.dba && <p style={{ fontSize: 13, color: "#878787", margin: 0 }}>DBA: {app.dba}</p>}
          </div>
          <StatusPill status={statusKind(app.status)} label={APPLICATION_STATUS_LABELS[app.status]} />
        </div>

        <div style={{ display: "flex", gap: "8px 16px", fontSize: 12, color: "#878787", flexWrap: "wrap", marginBottom: 16 }}>
          <span>Submitted {fmtDateLocale(app.submittedAt)}</span>
          {app.approvedAt && <span>Approved {fmtDateLocale(app.approvedAt)} by {app.approvedByEmail}</span>}
          {app.rejectedAt && <span>Rejected {fmtDateLocale(app.rejectedAt)} by {app.rejectedByEmail}</span>}
        </div>

        <div className="flex flex-col sm:flex-row" style={{ gap: 8 }}>
          {app.status === "submitted" && (
            <>
              <Button variant="primary" leadingIcon={<CheckCircle2 size={14} />} onClick={() => setShowApproveModal(true)}>
                Approve
              </Button>
              <Button variant="danger" leadingIcon={<XCircle size={14} />} onClick={() => setShowRejectModal(true)}>
                Reject
              </Button>
            </>
          )}
          {app.status === "approved" && (
            <Button variant="primary" onClick={handleSubmitToPayroc} loading={submitToPayrocLoading}>
              Submit to Payroc
            </Button>
          )}
          {app.status === "submitted_to_payroc" && (
            <Button variant="primary" onClick={() => { setPayrocMidInput(""); setMarkActiveModalOpen(true); }}>
              Mark Active
            </Button>
          )}
          {app.signedAgreementContractId && (
            <Button variant="secondary" leadingIcon={<FileText size={14} />} onClick={fetchAgreementUrl} loading={agreementLoading}>
              View Signed Agreement
            </Button>
          )}
        </div>
      </Card>

      {app.rejectionReason && (
        <Card padding={20} style={{ marginBottom: 16, borderLeft: "3px solid #DC2626" }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Rejection Reason (sent to merchant)
          </p>
          <p style={{ fontSize: 13, color: "#1A1313", margin: 0, lineHeight: 1.5 }}>{app.rejectionReason}</p>
        </Card>
      )}

      {app.internalNotes && (
        <Card padding={20} style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
            Internal Notes (master-only)
          </p>
          <p style={{ fontSize: 13, color: "#1A1313", margin: 0, lineHeight: 1.5 }}>{app.internalNotes}</p>
        </Card>
      )}

      <Section icon={<Building2 size={14} />} title="Business">
        <Row label="Legal name" value={app.legalBusinessName} />
        {app.dba && <Row label="DBA" value={app.dba} />}
        <Row label="Type" value={app.businessType} />
        <Row label="EIN" value={app.ein} mono />
        <Row label="Phone" value={app.businessPhone} />
        {app.website && <Row label="Website" value={app.website} />}
      </Section>

      <Section icon={<MapPin size={14} />} title="Address">
        <Row label="Street" value={app.addressStreet} />
        <Row label="City, State ZIP" value={`${app.addressCity}, ${app.addressState} ${app.addressZip}`} />
        <Row label="Country" value={app.addressCountry} />
      </Section>

      <Section icon={<User size={14} />} title="Owner">
        <Row label="Name" value={app.ownerFullName} />
        <Row label="Title" value={app.ownerTitle} />
        <Row label="Email" value={app.ownerEmail} />
        <Row label="Phone" value={app.ownerPhone} />
      </Section>

      <Section icon={<Banknote size={14} />} title="Banking (last 4 only)">
        <Row label="Bank" value={app.bankName} />
        <Row label="Account holder" value={app.accountHolderName} />
        <Row label="Routing" value={`\u2022\u2022\u2022\u2022${app.routingNumberLast4}`} mono />
        <Row label="Account" value={`\u2022\u2022\u2022\u2022${app.accountNumberLast4}`} mono />
        <Row label="Type" value={app.accountType} />
      </Section>

      <Section icon={<TrendingUp size={14} />} title="Processing Estimates">
        <Row label="Monthly volume" value={app.monthlyVolume} />
        <Row label="Avg ticket" value={app.averageTicket} />
        <Row label="MCC" value={app.mccCode} mono />
      </Section>

      {showApproveModal && (
        <Modal title="Approve Application" onClose={() => setShowApproveModal(false)}>
          <p style={{ fontSize: 13, color: "#4A4A4A", marginBottom: 16, lineHeight: 1.5 }}>
            Approving will: send a welcome email to <strong>{app.ownerEmail}</strong>, activate their account, and grant access to the merchant dashboard.
          </p>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>
            Internal notes (optional, master-only)
          </label>
          <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} maxLength={1000} placeholder="Notes about your decision (not shown to merchant)" style={textareaStyle} />
          <div className="flex flex-col-reverse sm:flex-row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowApproveModal(false)}>Cancel</Button>
            <Button variant="primary" leadingIcon={<CheckCircle2 size={14} />} onClick={handleApprove} loading={actionLoading === "approve"}>
              Approve
            </Button>
          </div>
        </Modal>
      )}

      {showRejectModal && (
        <Modal title="Reject Application" onClose={() => setShowRejectModal(false)}>
          <p style={{ fontSize: 13, color: "#4A4A4A", marginBottom: 16, lineHeight: 1.5 }}>
            Rejecting will: send an email to <strong>{app.ownerEmail}</strong>, set their account to rejected status, and prevent dashboard access.
          </p>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>
            Reason for rejection (optional, sent to merchant in email)
          </label>
          <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} maxLength={500} placeholder="Leave blank for a generic email." style={textareaStyle} />
          <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>
            Internal notes (optional, master-only)
          </label>
          <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} maxLength={1000} placeholder="Notes about your decision" style={{ ...textareaStyle, minHeight: 60 }} />
          <div className="flex flex-col-reverse sm:flex-row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setShowRejectModal(false)}>Cancel</Button>
            <Button variant="danger" leadingIcon={<XCircle size={14} />} onClick={handleReject} loading={actionLoading === "reject"}>
              Reject
            </Button>
          </div>
        </Modal>
      )}

      {markActiveModalOpen && (
        <Modal title="Mark Application Active" onClose={() => setMarkActiveModalOpen(false)}>
          <p style={{ fontSize: 13, color: "#4A4A4A", marginBottom: 16, lineHeight: 1.5 }}>
            Enter the Payroc MID from the cert letter. The merchant will become active and able to process payments.
          </p>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>
            Payroc MID
          </label>
          <input
            type="text"
            value={payrocMidInput}
            onChange={(e) => setPayrocMidInput(e.target.value)}
            placeholder="e.g., 9876543"
            autoComplete="off"
            style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #E8EAED", background: "#F4F5F7", fontSize: 14, color: "#1A1313", boxSizing: "border-box", marginBottom: 16, outline: "none", fontFamily: "monospace" }}
          />
          <div className="flex flex-col-reverse sm:flex-row" style={{ gap: 8, justifyContent: "flex-end" }}>
            <Button variant="ghost" onClick={() => setMarkActiveModalOpen(false)} disabled={markActiveLoading}>Cancel</Button>
            <Button variant="primary" onClick={handleMarkActive} loading={markActiveLoading}>
              Mark Active
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card padding={20} style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ color: "#878787" }}>{icon}</span>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", margin: 0 }}>{title}</h3>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>{children}</div>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderTop: "1px solid #F4F5F7", fontSize: 13 }}>
      <span style={{ color: "#878787" }}>{label}</span>
      <span style={{ color: "#1A1313", fontFamily: mono ? "monospace" : undefined, textAlign: "right", wordBreak: "break-all", maxWidth: "60%" }}>{value}</span>
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 12, WebkitOverflowScrolling: "touch" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ background: "#FFFFFF", borderRadius: 12, padding: 20, maxWidth: 520, width: "100%", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.1)", maxHeight: "calc(100vh - 24px)", overflowY: "auto" }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", margin: 0, marginBottom: 12, letterSpacing: "-0.31px" }}>{title}</h3>
        {children}
      </div>
    </div>
  );
}
