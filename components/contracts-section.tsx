"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  Image as ImageIcon,
  Upload,
  Download,
  Trash2,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { fmtDateLocale } from "@/lib/format";
import {
  CONTRACT_DOC_TYPES,
  CONTRACT_DOC_TYPE_LABELS,
  type ContractPublic,
  type ContractListResponse,
  type ContractDocType,
} from "@/lib/contracts/types";

interface Props {
  merchantId: string;
  currentUserId: string;
  currentUserRole: string;
  title?: string;
  description?: string;
}

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return <ImageIcon size={20} color="#017ea7" />;
  return <FileText size={20} color="#017ea7" />;
}

export function ContractsSection({
  merchantId,
  currentUserId,
  currentUserRole,
  title = "Documents",
  description = "Upload and manage merchant contracts and supporting documents.",
}: Props) {
  const [contracts, setContracts] = useState<ContractPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<ContractDocType>("master_services_agreement");
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback((kind: "success" | "error", message: string) => {
    setToast({ kind, message });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/contracts?merchantId=${encodeURIComponent(merchantId)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Load failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as ContractListResponse;
      setContracts(data.data);
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Reload failed");
    } finally {
      setLoading(false);
    }
  }, [merchantId, showToast]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  function openUpload() {
    setUploadDocType("master_services_agreement");
    setUploadNotes("");
    setUploadFile(null);
    setShowUploadModal(true);
  }

  function closeUpload() {
    setShowUploadModal(false);
    setUploadFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleUpload() {
    if (!uploadFile) {
      showToast("error", "Select a file first");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("merchantId", merchantId);
      fd.append("docType", uploadDocType);
      fd.append("file", uploadFile);
      if (uploadNotes.trim()) fd.append("notes", uploadNotes.trim());

      const res = await fetch("/api/contracts", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Upload failed (${res.status})`);
        return;
      }
      showToast("success", "Uploaded");
      closeUpload();
      await refetch();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(contract: ContractPublic) {
    setActionId(contract.id);
    try {
      const res = await fetch(`/api/contracts/${contract.id}/signed-url`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Download failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { url: string };
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Download failed");
    } finally {
      setActionId(null);
    }
  }

  async function handleDelete(contract: ContractPublic) {
    if (!confirm(`Delete "${contract.fileName}"? This cannot be undone.`)) return;
    setActionId(contract.id);
    try {
      const res = await fetch(`/api/contracts/${contract.id}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast("error", (j as { error?: string }).error ?? `Delete failed (${res.status})`);
        return;
      }
      showToast("success", "Deleted");
      await refetch();
    } catch (e) {
      showToast("error", e instanceof Error ? e.message : "Delete failed");
    } finally {
      setActionId(null);
    }
  }

  function canDelete(c: ContractPublic): boolean {
    if (currentUserRole === "master portal") return true;
    return c.uploadedById === currentUserId;
  }

  return (
    <>
      {toast && (
        <div style={{ position: "fixed", top: 80, right: 24, zIndex: 100, minWidth: 280 }}>
          <Toast kind={toast.kind} message={toast.message} />
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", letterSpacing: "-0.31px", marginBottom: 4, margin: 0 }}>{title}</h2>
          <p style={{ fontSize: 13, color: "#878787", margin: 0 }}>{description}</p>
        </div>
        <Button variant="primary" leadingIcon={<Plus size={14} />} onClick={openUpload}>
          Upload Document
        </Button>
      </div>

      {loading ? (
        <Card padding={32}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#878787", gap: 8 }}>
            <Loader2 size={16} className="animate-spin" />
            <span style={{ fontSize: 13 }}>Loading documents…</span>
          </div>
        </Card>
      ) : contracts.length === 0 ? (
        <Card padding={32}>
          <div style={{ textAlign: "center" }}>
            <div style={{ width: 80, height: 80, margin: "0 auto 16px", borderRadius: 9999, background: "#F4F5F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <FileText size={32} strokeWidth={1.5} color="#878787" />
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1A1313", marginBottom: 4 }}>No documents yet</p>
            <p style={{ fontSize: 13, color: "#878787", maxWidth: 400, margin: "0 auto" }}>
              Upload contracts, W-9s, voided checks, or other supporting documents.
            </p>
          </div>
        </Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {contracts.map((c) => (
            <Card key={c.id} padding={16}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: "#F0F9FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {fileIcon(c.mimeType)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1313", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.fileName}
                  </p>
                  <div style={{ display: "flex", gap: 8, fontSize: 12, color: "#878787", flexWrap: "wrap" }}>
                    <span>{CONTRACT_DOC_TYPE_LABELS[c.docType]}</span>
                    <span>·</span>
                    <span>{fmtBytes(c.sizeBytes)}</span>
                    <span>·</span>
                    <span>Uploaded {fmtDateLocale(c.createdAt)} by {c.uploadedByEmail}</span>
                  </div>
                  {c.notes && (
                    <p style={{ fontSize: 12, color: "#4A4A4A", marginTop: 4, fontStyle: "italic" }}>
                      &ldquo;{c.notes}&rdquo;
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <Button variant="secondary" leadingIcon={<Download size={14} />} onClick={() => handleDownload(c)} loading={actionId === c.id}>
                    Download
                  </Button>
                  {canDelete(c) && (
                    <Button variant="danger" leadingIcon={<Trash2 size={14} />} onClick={() => handleDelete(c)} loading={actionId === c.id}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showUploadModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}
          onClick={closeUpload}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#FFFFFF", borderRadius: 12, padding: 24, maxWidth: 520, width: "100%", boxShadow: "0 0 0 1px rgba(0,0,0,0.05), 0 4px 16px rgba(0,0,0,0.1), 0 8px 32px rgba(0,0,0,0.1)" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: "#1A1313", margin: 0, letterSpacing: "-0.31px" }}>Upload Document</h3>
                <p style={{ fontSize: 13, color: "#878787", margin: "4px 0 0" }}>Max 25MB. Supported: PDF, images, Word, txt.</p>
              </div>
              <button onClick={closeUpload} style={{ background: "none", border: "none", cursor: "pointer", color: "#878787" }} aria-label="Close">
                <X size={20} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>Document type</label>
                <select
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value as ContractDocType)}
                  style={{ width: "100%", height: 40, background: "#F4F5F7", border: "1px solid #E8EAED", borderRadius: 8, padding: "0 12px", fontSize: 14, color: "#1A1313", outline: "none", boxSizing: "border-box" }}
                >
                  {CONTRACT_DOC_TYPES.map((dt) => (
                    <option key={dt} value={dt}>{CONTRACT_DOC_TYPE_LABELS[dt]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>File</label>
                <div
                  style={{ border: uploadFile ? "1px solid #017ea7" : "2px dashed #E8EAED", borderRadius: 8, padding: 16, background: "#F9FAFB", cursor: "pointer", textAlign: "center" }}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    style={{ display: "none" }}
                    onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif,.docx,.doc,.txt"
                  />
                  {uploadFile ? (
                    <div>
                      <FileText size={24} color="#017ea7" style={{ margin: "0 auto 8px", display: "block" }} />
                      <p style={{ fontSize: 13, fontWeight: 500, color: "#1A1313", marginBottom: 2 }}>{uploadFile.name}</p>
                      <p style={{ fontSize: 12, color: "#878787" }}>{fmtBytes(uploadFile.size)}</p>
                    </div>
                  ) : (
                    <div>
                      <Upload size={20} color="#878787" style={{ margin: "0 auto 8px", display: "block" }} />
                      <p style={{ fontSize: 13, color: "#4A4A4A" }}>Click to choose a file</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#1A1313", marginBottom: 6, display: "block" }}>Notes (optional)</label>
                <textarea
                  value={uploadNotes}
                  onChange={(e) => setUploadNotes(e.target.value)}
                  maxLength={500}
                  placeholder="Optional context about this document"
                  style={{ width: "100%", minHeight: 60, padding: 10, borderRadius: 8, border: "1px solid #E8EAED", background: "#F4F5F7", fontSize: 13, fontFamily: "inherit", color: "#1A1313", resize: "vertical", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 24 }}>
              <Button variant="ghost" onClick={closeUpload}>Cancel</Button>
              <Button variant="primary" onClick={handleUpload} loading={uploading} disabled={!uploadFile}>Upload</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
