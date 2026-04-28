"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, RefreshCw, Trash2, Copy, Webhook as WebhookIcon,
  AlertTriangle, Search, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import { getEventCategories, WEBHOOK_EVENTS } from "@/lib/webhooks/events";
import type {
  WebhookPublic,
  WebhookListResponse,
  WebhookCreatedResponse,
  MasterWebhookRow,
  MasterWebhookListResponse,
} from "@/lib/webhooks/subscription-types";

interface MerchantOption {
  id: string;
  businessName: string;
}

interface Props {
  initialWebhooks: WebhookPublic[] | MasterWebhookRow[];
  mode: "merchant" | "master";
  allMerchants?: MerchantOption[];
  scopedMerchantId?: string | null;
}

export function WebhooksClient({
  initialWebhooks,
  mode,
  allMerchants,
  scopedMerchantId,
}: Props) {
  const [webhooks, setWebhooks] = useState<(WebhookPublic | MasterWebhookRow)[]>(initialWebhooks);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "revoked">("all");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createUrl, setCreateUrl] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createEvents, setCreateEvents] = useState<Set<string>>(new Set());
  const [createMerchantId, setCreateMerchantId] = useState<string>(
    mode === "master" && allMerchants && allMerchants.length > 0 ? allMerchants[0].id : ""
  );
  const [creating, setCreating] = useState(false);
  const [createdHook, setCreatedHook] = useState<{
    secret: string;
    url: string;
    description: string | null;
  } | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim().toLowerCase()), 300);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (mode === "master" && scopedMerchantId) {
        params.set("merchantId", scopedMerchantId);
      }
      if (activeFilter === "active") params.set("active", "true");
      if (activeFilter === "revoked") params.set("active", "false");

      const fetchUrl = mode === "master"
        ? `/api/master/webhook-subscriptions?${params.toString()}`
        : `/api/webhook-subscriptions?${params.toString()}`;
      const res = await fetch(fetchUrl);
      if (!res.ok) {
        showToast("error", "Failed to load webhooks");
        return;
      }
      const data = await res.json() as WebhookListResponse | MasterWebhookListResponse;
      setWebhooks(data.data);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Reload failed");
    } finally {
      setLoading(false);
    }
  }, [mode, scopedMerchantId, activeFilter]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    function handleFocus() {
      refetch();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refetch]);

  function showToast(kind: "success" | "error", message: string) {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }

  function openCreateModal() {
    setCreateUrl("");
    setCreateDescription("");
    setCreateEvents(new Set());
    if (mode === "master" && allMerchants && allMerchants.length > 0) {
      setCreateMerchantId(allMerchants[0].id);
    }
    setCreatedHook(null);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreatedHook(null);
    setCreateUrl("");
    setCreateDescription("");
    setCreateEvents(new Set());
  }

  function toggleEvent(id: string) {
    setCreateEvents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllInCategory(events: { id: string }[]) {
    setCreateEvents((prev) => {
      const next = new Set(prev);
      const allSelected = events.every((e) => next.has(e.id));
      if (allSelected) {
        for (const e of events) next.delete(e.id);
      } else {
        for (const e of events) next.add(e.id);
      }
      return next;
    });
  }

  async function handleCreate() {
    if (!createUrl.trim()) {
      showToast("error", "URL is required");
      return;
    }
    if (createEvents.size === 0) {
      showToast("error", "Select at least one event");
      return;
    }
    if (mode === "master" && !createMerchantId) {
      showToast("error", "Select a merchant");
      return;
    }

    setCreating(true);
    try {
      const body: Record<string, unknown> = {
        url: createUrl.trim(),
        description: createDescription.trim() || null,
        events: Array.from(createEvents),
      };
      if (mode === "master") body.merchantId = createMerchantId;

      const res = await fetch("/api/webhook-subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Create failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as WebhookCreatedResponse;
      setCreatedHook({
        secret: data.secret,
        url: data.url,
        description: data.description,
      });
      await refetch();
      showToast("success", "Webhook created");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(hook: WebhookPublic | MasterWebhookRow) {
    const merchantContext = mode === "master"
      ? ` for ${(hook as MasterWebhookRow).merchantBusinessName}`
      : "";
    if (
      !confirm(
        `Revoke webhook "${hook.description ?? hook.url}"${merchantContext}? Events will stop being delivered to this endpoint immediately.`
      )
    ) {
      return;
    }
    setRevokingId(hook.id);
    try {
      const res = await fetch(`/api/webhook-subscriptions/${hook.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Revoke failed (${res.status})`);
        return;
      }
      showToast("success", "Webhook revoked");
      await refetch();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setRevokingId(null);
    }
  }

  function copySecret(text: string) {
    navigator.clipboard.writeText(text).then(
      () => showToast("success", "Secret copied to clipboard"),
      () => showToast("error", "Failed to copy")
    );
  }

  // Filter
  const filtered = useMemo(() => {
    if (!debouncedQuery) return webhooks;
    return webhooks.filter((h) => {
      const merchantName = "merchantBusinessName" in h ? (h as MasterWebhookRow).merchantBusinessName : "";
      const haystack = `${h.url} ${h.description ?? ""} ${merchantName} ${h.events.join(" ")}`.toLowerCase();
      return haystack.includes(debouncedQuery);
    });
  }, [webhooks, debouncedQuery]);

  const stats = useMemo(() => {
    const total = webhooks.length;
    const active = webhooks.filter((h) => h.active).length;
    const merchants = mode === "master"
      ? new Set(webhooks.map((h) => "merchantId" in h ? h.merchantId : "")).size
      : 0;
    return { total, active, revoked: total - active, merchants };
  }, [webhooks, mode]);

  const eventCategories = getEventCategories();

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          padding: 12,
          borderRadius: 8,
          background: "rgba(245,158,11,0.06)",
          border: "1px solid rgba(245,158,11,0.15)",
          marginBottom: 16,
        }}
      >
        <AlertTriangle size={16} color="#92400E" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: 13, color: "#92400E", margin: 0 }}>
          Webhook delivery infrastructure is coming soon. Subscriptions registered now will activate when delivery is enabled. Save your signing secret on creation — it&apos;s shown only once.
        </p>
      </div>

      <div className={mode === "master" ? "grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" : "grid grid-cols-3 gap-4 mb-6"}>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Endpoints</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{stats.total}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Active</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#15803D", letterSpacing: "-0.31px" }}>{stats.active}</p>
        </Card>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Revoked</p>
          <p style={{ fontSize: 24, fontWeight: 600, color: "#878787", letterSpacing: "-0.31px" }}>{stats.revoked}</p>
        </Card>
        {mode === "master" && (
          <Card padding={16}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Merchants</p>
            <p style={{ fontSize: 24, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px" }}>{stats.merchants}</p>
          </Card>
        )}
      </div>

      <Card padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Input
              leadingIcon={<Search size={16} />}
              placeholder={mode === "master" ? "Search by URL, description, or merchant…" : "Search by URL or description…"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1"
              style={{ minWidth: 220 }}
            />
            <Button variant="secondary" leadingIcon={<RefreshCw size={14} />} onClick={refetch} loading={loading}>
              Refresh
            </Button>
            <Button variant="primary" leadingIcon={<Plus size={14} />} onClick={openCreateModal}>
              Add Endpoint
            </Button>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["all", "active", "revoked"] as const).map((s) => (
              <Button
                key={s}
                variant={activeFilter === s ? "primary" : "secondary"}
                onClick={() => setActiveFilter(s)}
              >
                {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ width: 120, height: 120, margin: "0 auto 16px", borderRadius: 9999, background: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <WebhookIcon size={48} strokeWidth={1.5} color="#878787" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>
              No webhook endpoints yet
            </p>
            <p style={{ fontSize: 14, color: "#878787", maxWidth: 360, margin: "0 auto" }}>
              Add an endpoint URL and select which events to receive.
            </p>
          </div>
        </Card>
      ) : (
        <Card noPadding>
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead style={{ background: "#F9FAFB" }}>
                <tr>
                  <Th>URL</Th>
                  <Th>Description</Th>
                  {mode === "master" && <Th>Merchant</Th>}
                  <Th>Events</Th>
                  <Th>Created</Th>
                  <Th>Status</Th>
                  <th style={{ padding: "10px 16px" }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => {
                  const masterRow = mode === "master" ? (h as MasterWebhookRow) : null;
                  return (
                    <tr key={h.id} style={{ borderTop: "1px solid #F4F5F7" }}>
                      <Td mono muted>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          <Globe size={12} />
                          {h.url}
                        </span>
                      </Td>
                      <Td>{h.description ?? "—"}</Td>
                      {masterRow && (
                        <Td>
                          <a
                            href={`/master/webhooks?merchantId=${masterRow.merchantId}`}
                            style={{ color: "#017ea7" }}
                          >
                            {masterRow.merchantBusinessName}
                          </a>
                        </Td>
                      )}
                      <Td muted>
                        {h.events.length} event{h.events.length === 1 ? "" : "s"}
                      </Td>
                      <Td muted>{fmtDateLocale(h.createdAt)}</Td>
                      <Td>
                        <StatusPill status={h.active ? "active" : "neutral"} label={h.active ? "ACTIVE" : "REVOKED"} />
                      </Td>
                      <td style={{ padding: "12px 16px" }}>
                        {h.active && (
                          <Button
                            variant="icon"
                            onClick={() => handleRevoke(h)}
                            loading={revokingId === h.id}
                            aria-label="Revoke webhook"
                          >
                            {revokingId === h.id ? null : <Trash2 size={16} />}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden">
            {filtered.map((h) => {
              const masterRow = mode === "master" ? (h as MasterWebhookRow) : null;
              return (
                <div key={h.id} style={{ padding: "14px 16px", borderBottom: "1px solid #F4F5F7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, gap: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#1A1313", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {h.description ?? h.url}
                    </span>
                    <StatusPill status={h.active ? "active" : "neutral"} label={h.active ? "ACTIVE" : "REVOKED"} />
                  </div>
                  <div style={{ fontSize: 11, color: "#878787", fontFamily: "monospace", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {h.url}
                  </div>
                  {masterRow && (
                    <div style={{ fontSize: 12, color: "#017ea7" }}>
                      {masterRow.merchantBusinessName}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#878787", marginTop: 4 }}>
                    {h.events.length} event{h.events.length === 1 ? "" : "s"} · Created {fmtDateLocale(h.createdAt)}
                  </div>
                  {h.active && (
                    <div style={{ marginTop: 8 }}>
                      <Button
                        variant="danger"
                        onClick={() => handleRevoke(h)}
                        loading={revokingId === h.id}
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
      )}

      {showCreateModal && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 50, padding: 16, overflow: "auto",
          }}
          onClick={closeCreateModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff", borderRadius: 12, padding: 24,
              maxWidth: 600, width: "100%", maxHeight: "90vh", overflow: "auto",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.1)",
            }}
          >
            {!createdHook ? (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", marginBottom: 4, letterSpacing: "-0.31px" }}>
                  Add Webhook Endpoint
                </h2>
                <p style={{ fontSize: 13, color: "#878787", marginBottom: 16 }}>
                  We&apos;ll POST event payloads to this URL. Select which events you want to receive.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Input
                    label="Endpoint URL"
                    placeholder="https://your-server.com/webhooks/salontransact"
                    value={createUrl}
                    onChange={(e) => setCreateUrl(e.target.value)}
                  />
                  <Input
                    label="Description (optional)"
                    placeholder="e.g. Production server"
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                  />

                  {mode === "master" && allMerchants && (
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>
                        Merchant
                      </label>
                      <select
                        value={createMerchantId}
                        onChange={(e) => setCreateMerchantId(e.target.value)}
                        style={{
                          width: "100%", padding: "8px 12px", borderRadius: 8,
                          border: "1px solid #E8EAED", fontSize: 13, background: "#fff",
                        }}
                      >
                        {allMerchants.map((m) => (
                          <option key={m.id} value={m.id}>{m.businessName}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313" }}>
                        Events to receive ({createEvents.size} selected)
                      </label>
                      <Button
                        variant="ghost"
                        onClick={() => {
                          if (createEvents.size === WEBHOOK_EVENTS.length) {
                            setCreateEvents(new Set());
                          } else {
                            setCreateEvents(new Set(WEBHOOK_EVENTS.map((e) => e.id)));
                          }
                        }}
                      >
                        {createEvents.size === WEBHOOK_EVENTS.length ? "Deselect all" : "Select all"}
                      </Button>
                    </div>
                    <div style={{ border: "1px solid #E8EAED", borderRadius: 8, padding: 12, maxHeight: 280, overflow: "auto" }}>
                      {eventCategories.map((cat) => (
                        <div key={cat.category} style={{ marginBottom: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                              {cat.category}s
                            </span>
                            <button
                              onClick={() => selectAllInCategory(cat.events)}
                              style={{ fontSize: 11, color: "#017ea7", border: "none", background: "transparent", cursor: "pointer" }}
                            >
                              {cat.events.every((e) => createEvents.has(e.id)) ? "Deselect" : "Select all"}
                            </button>
                          </div>
                          {cat.events.map((ev) => (
                            <label key={ev.id} style={{ display: "flex", gap: 8, marginBottom: 6, cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={createEvents.has(ev.id)}
                                onChange={() => toggleEvent(ev.id)}
                                style={{ marginTop: 2, flexShrink: 0 }}
                              />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: "#1A1313", fontFamily: "monospace" }}>
                                  {ev.id}
                                </div>
                                <div style={{ fontSize: 11, color: "#878787" }}>{ev.description}</div>
                              </div>
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
                  <Button variant="ghost" onClick={closeCreateModal}>Cancel</Button>
                  <Button variant="primary" onClick={handleCreate} loading={creating}>
                    Add Endpoint
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "#15803D", marginBottom: 4, letterSpacing: "-0.31px" }}>
                  Webhook Created
                </h2>
                <p style={{ fontSize: 13, color: "#878787", marginBottom: 16 }}>
                  Save the signing secret now. It will not be shown again. Use it to verify HMAC-SHA256 signatures on incoming webhook payloads.
                </p>

                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>URL</p>
                  <p style={{ fontSize: 13, color: "#1A1313", marginBottom: 12, fontFamily: "monospace", wordBreak: "break-all" }}>{createdHook.url}</p>

                  {createdHook.description && (
                    <>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Description</p>
                      <p style={{ fontSize: 13, color: "#1A1313", marginBottom: 12 }}>{createdHook.description}</p>
                    </>
                  )}

                  <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Signing Secret</p>
                  <div
                    style={{
                      background: "#F9FAFB", borderRadius: 8, padding: 12,
                      fontFamily: "monospace", fontSize: 13, wordBreak: "break-all",
                      color: "#1A1313",
                    }}
                  >
                    {createdHook.secret}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="secondary" leadingIcon={<Copy size={14} />} onClick={() => copySecret(createdHook.secret)}>
                    Copy Secret
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

function Td({ children, muted, mono }: { children: React.ReactNode; muted?: boolean; mono?: boolean }) {
  return (
    <td style={{ padding: "12px 16px", fontSize: 13, color: muted ? "#4A4A4A" : "#1A1313", fontFamily: mono ? "monospace" : undefined }}>
      {children}
    </td>
  );
}
