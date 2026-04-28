"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Trash2,
  Copy,
  KeyRound,
  AlertTriangle,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-pill";
import { Input } from "@/components/ui/input";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import type {
  ApiKeyPublic,
  ApiKeyListResponse,
  ApiKeyCreatedResponse,
  MasterApiKeyRow,
  MasterApiKeyListResponse,
} from "@/lib/api-keys/types";

interface MerchantOption {
  id: string;
  businessName: string;
}

interface Props {
  initialKeys: ApiKeyPublic[] | MasterApiKeyRow[];
  mode: "merchant" | "master";
  // Master mode only:
  allMerchants?: MerchantOption[];
  scopedMerchantId?: string | null;
}

export function ApiKeysClient({
  initialKeys,
  mode,
  allMerchants,
  scopedMerchantId,
}: Props) {
  const [keys, setKeys] = useState<(ApiKeyPublic | MasterApiKeyRow)[]>(initialKeys);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "revoked">("all");
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createMerchantId, setCreateMerchantId] = useState<string>(
    mode === "master" && allMerchants && allMerchants.length > 0 ? allMerchants[0].id : ""
  );
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<{
    fullKey: string;
    name: string;
    keyPrefix: string;
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

      const url = mode === "master"
        ? `/api/master/api-keys?${params.toString()}`
        : `/api/api-keys?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        showToast("error", "Failed to load API keys");
        return;
      }
      const data = await res.json() as ApiKeyListResponse | MasterApiKeyListResponse;
      setKeys(data.data);
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
    setCreateName("");
    if (mode === "master" && allMerchants && allMerchants.length > 0) {
      setCreateMerchantId(allMerchants[0].id);
    }
    setCreatedKey(null);
    setShowCreateModal(true);
  }

  function closeCreateModal() {
    setShowCreateModal(false);
    setCreatedKey(null);
    setCreateName("");
  }

  async function handleCreate() {
    if (!createName.trim()) {
      showToast("error", "Key name is required");
      return;
    }
    if (mode === "master" && !createMerchantId) {
      showToast("error", "Select a merchant");
      return;
    }

    setCreating(true);
    try {
      const body: Record<string, unknown> = { name: createName.trim() };
      if (mode === "master") body.merchantId = createMerchantId;

      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Create failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as ApiKeyCreatedResponse;
      setCreatedKey({
        fullKey: data.fullKey,
        name: data.name,
        keyPrefix: data.keyPrefix,
      });
      await refetch();
      showToast("success", "API key created");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(key: ApiKeyPublic | MasterApiKeyRow) {
    const merchantContext = mode === "master"
      ? ` for ${(key as MasterApiKeyRow).merchantBusinessName}`
      : "";
    if (
      !confirm(
        `Revoke API key "${key.name}"${merchantContext}? Any integrations using this key will stop working immediately.`
      )
    ) {
      return;
    }
    setRevokingId(key.id);
    try {
      const res = await fetch(`/api/api-keys/${key.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Revoke failed (${res.status})`);
        return;
      }
      showToast("success", "Key revoked");
      await refetch();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Revoke failed");
    } finally {
      setRevokingId(null);
    }
  }

  function copyKey(text: string) {
    navigator.clipboard.writeText(text).then(
      () => showToast("success", "Key copied to clipboard"),
      () => showToast("error", "Failed to copy")
    );
  }

  // Client-side search filter
  const filtered = useMemo(() => {
    if (!debouncedQuery) return keys;
    return keys.filter((k) => {
      const merchantName = "merchantBusinessName" in k ? (k as MasterApiKeyRow).merchantBusinessName : "";
      const haystack = `${k.name} ${k.keyPrefix} ${merchantName}`.toLowerCase();
      return haystack.includes(debouncedQuery);
    });
  }, [keys, debouncedQuery]);

  const stats = useMemo(() => {
    const total = keys.length;
    const active = keys.filter((k) => k.active).length;
    const merchants = mode === "master"
      ? new Set(keys.map((k) => "merchantId" in k ? k.merchantId : "")).size
      : 0;
    return { total, active, revoked: total - active, merchants };
  }, [keys, mode]);

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      {/* Warning banner */}
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
          Keep API keys secret. Never expose them in client-side code or public repositories. The full key is shown ONCE on creation — save it immediately.
        </p>
      </div>

      {/* Stats */}
      <div className={mode === "master" ? "grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" : "grid grid-cols-3 gap-4 mb-6"}>
        <Card padding={16}>
          <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Total Keys</p>
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

      {/* Filters + Create button */}
      <Card padding={16} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Input
              leadingIcon={<Search size={16} />}
              placeholder={mode === "master" ? "Search by name, prefix, or merchant…" : "Search by name or prefix…"}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              containerClassName="flex-1"
              style={{ minWidth: 220 }}
            />
            <Button variant="secondary" leadingIcon={<RefreshCw size={14} />} onClick={refetch} loading={loading}>
              Refresh
            </Button>
            <Button variant="primary" leadingIcon={<Plus size={14} />} onClick={openCreateModal}>
              Create Key
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

      {/* Table */}
      {filtered.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ width: 120, height: 120, margin: "0 auto 16px", borderRadius: 9999, background: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <KeyRound size={48} strokeWidth={1.5} color="#878787" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>
              No API keys yet
            </p>
            <p style={{ fontSize: 14, color: "#878787", maxWidth: 360, margin: "0 auto" }}>
              Click &ldquo;Create Key&rdquo; to generate your first API key.
            </p>
          </div>
        </Card>
      ) : (
        <Card noPadding>
          <div className="hidden md:block" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 13 }}>
              <thead style={{ background: "#F9FAFB" }}>
                <tr>
                  <Th>Name</Th>
                  <Th>Key Prefix</Th>
                  {mode === "master" && <Th>Merchant</Th>}
                  <Th>Created</Th>
                  <Th>Last Used</Th>
                  <Th>Status</Th>
                  <th style={{ padding: "10px 16px" }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((k) => {
                  const masterRow = mode === "master" ? (k as MasterApiKeyRow) : null;
                  return (
                    <tr key={k.id} style={{ borderTop: "1px solid #F4F5F7" }}>
                      <Td>{k.name}</Td>
                      <Td mono muted>
                        {k.keyPrefix ? `${k.keyPrefix}…` : "—"}
                      </Td>
                      {masterRow && (
                        <Td>
                          <a
                            href={`/master/api-keys?merchantId=${masterRow.merchantId}`}
                            style={{ color: "#017ea7" }}
                          >
                            {masterRow.merchantBusinessName}
                          </a>
                        </Td>
                      )}
                      <Td muted>{fmtDateLocale(k.createdAt)}</Td>
                      <Td muted>{k.lastUsed ? fmtDateLocale(k.lastUsed) : "Never"}</Td>
                      <Td>
                        <StatusPill status={k.active ? "active" : "neutral"} label={k.active ? "ACTIVE" : "REVOKED"} />
                      </Td>
                      <td style={{ padding: "12px 16px" }}>
                        {k.active && (
                          <Button
                            variant="icon"
                            onClick={() => handleRevoke(k)}
                            loading={revokingId === k.id}
                            aria-label="Revoke key"
                          >
                            {revokingId === k.id ? null : <Trash2 size={16} />}
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
            {filtered.map((k) => {
              const masterRow = mode === "master" ? (k as MasterApiKeyRow) : null;
              return (
                <div key={k.id} style={{ padding: "14px 16px", borderBottom: "1px solid #F4F5F7" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1313" }}>{k.name}</span>
                    <StatusPill status={k.active ? "active" : "neutral"} label={k.active ? "ACTIVE" : "REVOKED"} />
                  </div>
                  <div style={{ fontSize: 12, color: "#878787", fontFamily: "monospace" }}>
                    {k.keyPrefix ? `${k.keyPrefix}…` : "—"}
                  </div>
                  {masterRow && (
                    <div style={{ fontSize: 12, color: "#017ea7", marginTop: 4 }}>
                      {masterRow.merchantBusinessName}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#878787", marginTop: 4 }}>
                    Created {fmtDateLocale(k.createdAt)} · Used {k.lastUsed ? fmtDateLocale(k.lastUsed) : "Never"}
                  </div>
                  {k.active && (
                    <div style={{ marginTop: 8 }}>
                      <Button
                        variant="danger"
                        onClick={() => handleRevoke(k)}
                        loading={revokingId === k.id}
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

      {/* Create modal */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 50,
            padding: 16,
          }}
          onClick={closeCreateModal}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 24,
              maxWidth: 520,
              width: "100%",
              boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.1)",
            }}
          >
            {!createdKey ? (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", marginBottom: 4, letterSpacing: "-0.31px" }}>
                  Create API Key
                </h2>
                <p style={{ fontSize: 13, color: "#878787", marginBottom: 16 }}>
                  The full key is shown once after creation. Save it immediately — it cannot be retrieved later.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <Input
                    label="Key Name"
                    placeholder="e.g. Production Server, iPad Stylist App"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
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
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid #E8EAED",
                          fontSize: 13,
                          background: "#fff",
                        }}
                      >
                        {allMerchants.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.businessName}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 24, justifyContent: "flex-end" }}>
                  <Button variant="ghost" onClick={closeCreateModal}>Cancel</Button>
                  <Button variant="primary" onClick={handleCreate} loading={creating}>
                    Create Key
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 600, color: "#15803D", marginBottom: 4, letterSpacing: "-0.31px" }}>
                  Key Created
                </h2>
                <p style={{ fontSize: 13, color: "#878787", marginBottom: 16 }}>
                  Save this key now. It will not be shown again.
                </p>

                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Name</p>
                  <p style={{ fontSize: 14, color: "#1A1313", marginBottom: 12 }}>{createdKey.name}</p>

                  <p style={{ fontSize: 11, fontWeight: 600, color: "#878787", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>Full Key</p>
                  <div
                    style={{
                      background: "#F9FAFB",
                      borderRadius: 8,
                      padding: 12,
                      fontFamily: "monospace",
                      fontSize: 13,
                      wordBreak: "break-all",
                      color: "#1A1313",
                    }}
                  >
                    {createdKey.fullKey}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <Button variant="secondary" leadingIcon={<Copy size={14} />} onClick={() => copyKey(createdKey.fullKey)}>
                    Copy Key
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
