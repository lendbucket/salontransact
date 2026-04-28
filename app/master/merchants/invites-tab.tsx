"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Plus, RefreshCw, Trash2, Mail, Send, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import type {
  MerchantInvitePublic,
  MerchantInviteListResponse,
  InviteStatus,
} from "@/lib/merchant-invites/types";

function inviteStatusKind(status: InviteStatus, isExpiredNow: boolean): string {
  if (status === "accepted") return "active";
  if (status === "revoked") return "failed";
  if (isExpiredNow || status === "expired") return "neutral";
  return "pending";
}

function inviteStatusLabel(status: InviteStatus, isExpiredNow: boolean): string {
  if (status === "accepted") return "ACCEPTED";
  if (status === "revoked") return "REVOKED";
  if (isExpiredNow || status === "expired") return "EXPIRED";
  return "PENDING";
}

export function InvitesTab() {
  const [invites, setInvites] = useState<MerchantInvitePublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createBusinessName, setCreateBusinessName] = useState("");
  const [createNote, setCreateNote] = useState("");
  const [creating, setCreating] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<{ url: string; emailSent: boolean } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/master/invites");
      if (!res.ok) {
        showToast("error", "Failed to load invites");
        return;
      }
      const data = (await res.json()) as MerchantInviteListResponse;
      setInvites(data.data);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Reload failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  function openCreateModal() {
    setCreateEmail("");
    setCreateBusinessName("");
    setCreateNote("");
    setCreatedInvite(null);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreatedInvite(null);
  }

  async function handleCreate() {
    if (!createEmail.trim() || !createBusinessName.trim()) {
      showToast("error", "Email and business name required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/master/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: createEmail.trim(),
          businessName: createBusinessName.trim(),
          note: createNote.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Send failed (${res.status})`);
        setCreating(false);
        return;
      }
      const data = await res.json();
      setCreatedInvite({ url: data.inviteUrl, emailSent: data.emailSent });
      await refetch();
      showToast("success", data.emailSent ? "Invite sent" : "Invite created (email failed)");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Send failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleResend(invite: MerchantInvitePublic) {
    if (!confirm(`Resend invite to ${invite.email}? Expiration will reset to 7 days.`)) return;
    setActionId(invite.id);
    try {
      const res = await fetch(`/api/master/invites/${invite.id}/resend`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Resend failed (${res.status})`);
        return;
      }
      const data = await res.json();
      showToast("success", data.emailSent ? "Invite resent" : "Updated, but email failed");
      await refetch();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Resend failed");
    } finally {
      setActionId(null);
    }
  }

  async function handleRevoke(invite: MerchantInvitePublic) {
    if (!confirm(`Revoke invite to ${invite.email}? The link will stop working.`)) return;
    setActionId(invite.id);
    try {
      const res = await fetch(`/api/master/invites/${invite.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Revoke failed (${res.status})`);
        return;
      }
      showToast("success", "Invite revoked");
      await refetch();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setActionId(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(
      () => showToast("success", "Copied"),
      () => showToast("error", "Copy failed")
    );
  }

  const filtered = debouncedQuery
    ? invites.filter((i) =>
        `${i.email} ${i.businessName} ${i.note ?? ""}`.toLowerCase().includes(debouncedQuery)
      )
    : invites;

  const stats = {
    total: invites.length,
    pending: invites.filter((i) => i.status === "pending" && !i.isExpiredNow).length,
    accepted: invites.filter((i) => i.status === "accepted").length,
    expiredOrRevoked: invites.filter(
      (i) => i.status === "revoked" || i.isExpiredNow || i.status === "expired"
    ).length,
  };

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{stats.total}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Pending</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#92400E", letterSpacing: "-0.31px" }}>{stats.pending}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Accepted</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#15803D", letterSpacing: "-0.31px" }}>{stats.accepted}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Expired/Revoked</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#878787", letterSpacing: "-0.31px" }}>{stats.expiredOrRevoked}</p>
        </Card>
      </div>

      <Card padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Input
            leadingIcon={<Search size={16} />}
            placeholder="Search by email, business, or note…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            containerClassName="flex-1"
            style={{ minWidth: 220 }}
          />
          <Button variant="secondary" leadingIcon={<RefreshCw size={14} />} onClick={refetch} loading={loading}>
            Refresh
          </Button>
          <Button variant="primary" leadingIcon={<Plus size={14} />} onClick={openCreateModal}>
            Invite Merchant
          </Button>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ width: 120, height: 120, margin: "0 auto 16px", borderRadius: 9999, background: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Mail size={48} strokeWidth={1.5} color="#878787" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>No invites yet</p>
            <p style={{ fontSize: 14, color: "#878787", maxWidth: 360, margin: "0 auto" }}>
              Click &ldquo;Invite Merchant&rdquo; to send an invite link via email.
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
                  <Th>Business</Th>
                  <Th>Invited By</Th>
                  <Th>Sent</Th>
                  <Th>Expires</Th>
                  <Th>Status</Th>
                  <th style={{ padding: "10px 16px" }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((invite) => {
                  const isPending = invite.status === "pending" && !invite.isExpiredNow;
                  return (
                    <tr key={invite.id} style={{ borderTop: "1px solid #F4F5F7" }}>
                      <Td>{invite.email}</Td>
                      <Td>{invite.businessName}</Td>
                      <Td muted>{invite.invitedByEmail}</Td>
                      <Td muted>{fmtDateLocale(invite.createdAt)}</Td>
                      <Td muted>{fmtDateLocale(invite.expiresAt)}</Td>
                      <Td>
                        <StatusPill
                          status={inviteStatusKind(invite.status, invite.isExpiredNow)}
                          label={inviteStatusLabel(invite.status, invite.isExpiredNow)}
                        />
                      </Td>
                      <td style={{ padding: "12px 16px" }}>
                        {isPending && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <Button variant="icon" onClick={() => handleResend(invite)} loading={actionId === invite.id} aria-label="Resend invite">
                              <Send size={14} />
                            </Button>
                            <Button variant="icon" onClick={() => handleRevoke(invite)} loading={actionId === invite.id} aria-label="Revoke invite">
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            {filtered.map((invite) => {
              const isPending = invite.status === "pending" && !invite.isExpiredNow;
              return (
                <div key={invite.id} style={{ padding: "14px 16px", borderBottom: "1px solid #F4F5F7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313" }}>
                      {invite.businessName}
                    </span>
                    <StatusPill
                      status={inviteStatusKind(invite.status, invite.isExpiredNow)}
                      label={inviteStatusLabel(invite.status, invite.isExpiredNow)}
                    />
                  </div>
                  <div style={{ fontSize: 12, color: "#878787", marginBottom: 4 }}>{invite.email}</div>
                  <div style={{ fontSize: 11, color: "#878787" }}>
                    Sent {fmtDateLocale(invite.createdAt)} · Expires {fmtDateLocale(invite.expiresAt)}
                  </div>
                  {isPending && (
                    <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                      <Button variant="secondary" leadingIcon={<Send size={14} />} onClick={() => handleResend(invite)} loading={actionId === invite.id}>
                        Resend
                      </Button>
                      <Button variant="danger" leadingIcon={<Trash2 size={14} />} onClick={() => handleRevoke(invite)} loading={actionId === invite.id}>
                        Revoke
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {showCreateModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 50, padding: 16,
          }}
          onClick={closeCreateModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 12, padding: 24,
              maxWidth: 520, width: "100%",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.1)",
            }}
          >
            {!createdInvite ? (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", marginBottom: 4, letterSpacing: "-0.31px" }}>
                  Invite a Merchant
                </h2>
                <p style={{ fontSize: 13, color: "#878787", marginBottom: 16 }}>
                  We&apos;ll send them a link to start their merchant application. The link expires in 7 days.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Input
                    label="Recipient email"
                    type="email"
                    placeholder="owner@salonname.com"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                  />
                  <Input
                    label="Business name"
                    placeholder="e.g. Sage Salon"
                    value={createBusinessName}
                    onChange={(e) => setCreateBusinessName(e.target.value)}
                  />
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>
                      Personal note (optional)
                    </label>
                    <textarea
                      value={createNote}
                      onChange={(e) => setCreateNote(e.target.value)}
                      maxLength={500}
                      placeholder="Hi Sarah — really enjoyed our call. Looking forward to having you on the platform."
                      style={{
                        width: "100%", minHeight: 80, padding: 10, borderRadius: 8,
                        border: "1px solid #E8EAED", background: "#F4F5F7",
                        fontSize: 13, fontFamily: "inherit", color: "#1A1313", resize: "vertical",
                        outline: "none", boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
                  <Button variant="ghost" onClick={closeCreateModal}>Cancel</Button>
                  <Button variant="primary" onClick={handleCreate} loading={creating}>
                    Send Invite
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "#15803D", marginBottom: 4, letterSpacing: "-0.31px" }}>
                  Invite {createdInvite.emailSent ? "sent" : "created"}
                </h2>
                <p style={{ fontSize: 13, color: "#878787", marginBottom: 16 }}>
                  {createdInvite.emailSent
                    ? "Email delivered. They have 7 days to accept."
                    : "The invite was created but email delivery failed. Send the link manually below."}
                </p>

                <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
                  Invite link
                </p>
                <div
                  style={{
                    background: "#F9FAFB", borderRadius: 8, padding: 12,
                    fontFamily: "monospace", fontSize: 12, wordBreak: "break-all",
                    color: "#1A1313", marginBottom: 16,
                  }}
                >
                  {createdInvite.url}
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="secondary" leadingIcon={<Copy size={14} />} onClick={() => copyToClipboard(createdInvite.url)}>
                    Copy Link
                  </Button>
                  <Button variant="primary" onClick={closeCreateModal}>Done</Button>
                </div>
              </>
            )}
          </div>
        </div>
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
