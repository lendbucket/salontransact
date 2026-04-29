import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit/log";
import { uploadContractFile } from "@/lib/supabase/storage";
import {
  canUploadContractsForMerchant,
  canViewContractsForMerchant,
  type AuthedUser,
} from "@/lib/contracts/permissions";
import {
  isValidDocType,
  type ContractListResponse,
  type ContractPublic,
  type ContractDocType,
} from "@/lib/contracts/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
]);

function rowToPublic(row: {
  id: string;
  merchantId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  docType: string;
  uploadedById: string;
  uploadedByEmail: string;
  uploadedByRole: string;
  notes: string | null;
  createdAt: Date;
}): ContractPublic {
  return {
    id: row.id,
    merchantId: row.merchantId,
    fileName: row.fileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes,
    docType: row.docType as ContractDocType,
    uploadedById: row.uploadedById,
    uploadedByEmail: row.uploadedByEmail,
    uploadedByRole: row.uploadedByRole,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
  };
}

async function getAuthedUser(): Promise<AuthedUser | null> {
  const session = await getServerSession(authOptions);
  const u = session?.user as
    | { id?: string; email?: string | null; role?: string }
    | undefined;
  if (!u || !u.id) return null;
  return { id: u.id, email: u.email ?? "", role: u.role ?? "" };
}

export async function GET(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const merchantId = url.searchParams.get("merchantId");
  if (!merchantId) {
    return NextResponse.json({ error: "merchantId required" }, { status: 400 });
  }

  if (!(await canViewContractsForMerchant(user, merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows = await prisma.contract.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const data = rows.map(rowToPublic);
  const response: ContractListResponse = { data, count: data.length };
  return NextResponse.json(response);
}

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
  }

  const merchantId = formData.get("merchantId");
  const docType = formData.get("docType");
  const notes = formData.get("notes");
  const file = formData.get("file");

  if (typeof merchantId !== "string" || merchantId.length === 0) {
    return NextResponse.json({ error: "merchantId required" }, { status: 400 });
  }
  if (typeof docType !== "string" || !isValidDocType(docType)) {
    return NextResponse.json({ error: "valid docType required" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "file is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File exceeds ${MAX_BYTES / 1024 / 1024}MB limit` },
      { status: 413 }
    );
  }
  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 415 }
    );
  }

  if (!(await canUploadContractsForMerchant(user, merchantId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true },
  });
  if (!merchant) {
    return NextResponse.json({ error: "Merchant not found" }, { status: 404 });
  }

  const notesValue =
    typeof notes === "string" && notes.trim().length > 0
      ? notes.trim().slice(0, 500)
      : null;

  const { randomUUID } = await import("crypto");
  const uniqueId = randomUUID().replace(/-/g, "").slice(0, 16);

  const arrayBuffer = await file.arrayBuffer();

  let storagePath: string;
  try {
    const result = await uploadContractFile({
      merchantId,
      fileName: file.name,
      mimeType: file.type,
      body: arrayBuffer,
      uniqueId,
    });
    storagePath = result.storagePath;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 502 }
    );
  }

  let row;
  try {
    row = await prisma.contract.create({
      data: {
        merchantId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath,
        docType,
        uploadedById: user.id,
        uploadedByEmail: user.email,
        uploadedByRole: user.role,
        notes: notesValue,
      },
    });
  } catch (e) {
    try {
      const { deleteContractFile } = await import("@/lib/supabase/storage");
      await deleteContractFile(storagePath);
    } catch {
      // best effort
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "DB write failed" },
      { status: 500 }
    );
  }

  await writeAuditLog({
    actor: { id: user.id, email: user.email, role: user.role },
    action: "contract.upload",
    targetType: "Contract",
    targetId: row.id,
    merchantId,
    metadata: {
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      docType,
      hasNotes: notesValue !== null,
    },
  });

  return NextResponse.json(rowToPublic(row), { status: 201 });
}
