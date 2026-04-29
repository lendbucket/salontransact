import { createClient } from "@supabase/supabase-js";

const BUCKET = "contracts";

function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface UploadResult {
  storagePath: string;
}

export async function uploadContractFile(args: {
  merchantId: string;
  fileName: string;
  mimeType: string;
  body: ArrayBuffer | Uint8Array;
  uniqueId: string;
}): Promise<UploadResult> {
  const safeName = args.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
  const path = `${args.merchantId}/${args.uniqueId}-${safeName}`;

  const client = getServiceClient();
  const { error } = await client.storage.from(BUCKET).upload(path, args.body, {
    contentType: args.mimeType,
    upsert: false,
  });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return { storagePath: path };
}

export async function getSignedDownloadUrl(storagePath: string): Promise<string> {
  const client = getServiceClient();
  const { data, error } = await client.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 60 * 60);

  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL failed: ${error?.message ?? "unknown"}`);
  }

  return data.signedUrl;
}

export async function deleteContractFile(storagePath: string): Promise<boolean> {
  const client = getServiceClient();
  const { error } = await client.storage.from(BUCKET).remove([storagePath]);
  if (error) {
    throw new Error(`Supabase delete failed: ${error.message}`);
  }
  return true;
}
