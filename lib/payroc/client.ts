import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import { PayrocApiError } from "./errors";
import type { PayrocApiErrorBody } from "./types";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export async function getPayrocToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    console.log("[PAYROC-AUTH] Using cached bearer token");
    return tokenCache.token;
  }

  const dbToken = await prisma.payrocToken.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (dbToken && dbToken.expiresAt.getTime() > Date.now() + 60000) {
    console.log("[PAYROC-AUTH] Using DB-cached bearer token");
    tokenCache = {
      token: dbToken.token,
      expiresAt: dbToken.expiresAt.getTime(),
    };
    return dbToken.token;
  }

  const apiKey = process.env.PAYROC_API_KEY;
  const authUrl = process.env.PAYROC_AUTH_URL;

  console.log("=========== PAYROC BEARER REQUEST ===========");
  console.log("Auth URL:", authUrl);
  console.log("API Key set:", !!apiKey);
  console.log("API Key prefix:", apiKey?.substring(0, 10));
  console.log("=============================================");

  if (!apiKey || !authUrl) {
    throw new Error("Payroc credentials not configured");
  }

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "Content-Type": "application/json",
    },
  });

  const responseText = await response.text();

  console.log("=========== PAYROC BEARER RESPONSE ===========");
  console.log("Status:", response.status);
  console.log("Body:", responseText.substring(0, 500));
  console.log("==============================================");

  if (!response.ok) {
    throw new Error(`Bearer token failed: ${response.status} - ${responseText}`);
  }

  const data = JSON.parse(responseText);
  const accessToken = data.access_token ?? data.token;
  const expiresInSeconds = data.expires_in ?? data.expiresIn ?? 3600;
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  if (!accessToken) {
    console.error("No token in response. Keys:", Object.keys(data));
    throw new Error("Token not found in response");
  }

  tokenCache = { token: accessToken, expiresAt };

  try {
    await prisma.payrocToken.deleteMany({});
    await prisma.payrocToken.create({
      data: { token: accessToken, expiresAt: new Date(expiresAt) },
    });
  } catch (dbError) {
    console.error("[PAYROC-AUTH] DB cache save failed (non-fatal):", dbError);
  }

  return tokenCache.token;
}

export async function payrocRequest<T>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getPayrocToken();
  const baseUrl = process.env.PAYROC_API_URL;

  if (!baseUrl) {
    throw new Error("Payroc API URL not configured");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  if (method === "POST") {
    headers["Idempotency-Key"] = crypto.randomUUID();
  }

  const bodyJson = body ? JSON.stringify(body) : undefined;
  const cid = Math.random().toString(36).slice(2, 10);

  console.log(`[PAYROC-REQ] ${cid} ${method} ${path}`);
  if (bodyJson) {
    console.log(`[PAYROC-REQ] ${cid} body: ${bodyJson.substring(0, 2000)}`);
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: bodyJson,
  });

  const responseText = await response.text();
  console.log(`[PAYROC-RESP] ${cid} status=${response.status}`);
  console.log(`[PAYROC-RESP] ${cid} body: ${responseText.substring(0, 2000)}`);

  if (!response.ok) {
    let errorBody: PayrocApiErrorBody | string | null = responseText || null;
    try {
      const parsed = JSON.parse(responseText);
      if (parsed && typeof parsed === "object") {
        errorBody = parsed as PayrocApiErrorBody;
      }
    } catch {
      // body is not JSON, keep as string
    }
    throw new PayrocApiError(response.status, path, errorBody);
  }

  if (response.status === 204 || responseText.length === 0) {
    return {} as T;
  }

  return JSON.parse(responseText);
}

export async function getHostedFieldsSessionToken(
  scenario: "payment" | "tokenization" = "payment"
): Promise<{ token: string; expiresAt: string }> {
  const bearerToken = await getPayrocToken();
  const terminalId = process.env.PAYROC_TERMINAL_ID;
  const apiUrl =
    process.env.PAYROC_SESSION_HOST || process.env.PAYROC_API_URL;

  const { getHostedFieldsConfig } = await import("./hosted-fields");
  const config = getHostedFieldsConfig();
  const urlMatch = config.url.match(/hosted-fields-([\d.]+)\.js/);
  const libVersion = urlMatch ? urlMatch[1] : "1.6.0.172429";

  const idempotencyKey = crypto.randomUUID();
  const requestUrl = `${apiUrl}/processing-terminals/${terminalId}/hosted-fields-sessions`;

  const requestHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${bearerToken}`,
    "Idempotency-Key": idempotencyKey,
    Accept: "application/json",
  };

  const requestBody = {
    libVersion,
    scenario,
  };

  console.log("=========== PAYROC SESSION REQUEST ===========");
  console.log("URL:", requestUrl);
  console.log("Method: POST");
  console.log("Terminal ID:", terminalId);
  console.log("API URL env:", apiUrl);
  console.log(
    "Bearer token (first 30 chars):",
    bearerToken?.substring(0, 30)
  );
  console.log(
    "Headers:",
    JSON.stringify(
      {
        ...requestHeaders,
        Authorization: `Bearer ${bearerToken?.substring(0, 20)}...`,
      },
      null,
      2
    )
  );
  console.log("Body:", JSON.stringify(requestBody, null, 2));
  console.log("================================================");

  const response = await fetch(requestUrl, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(requestBody),
  });

  const responseText = await response.text();

  console.log("=========== PAYROC SESSION RESPONSE ===========");
  console.log("Status:", response.status);
  console.log("Status Text:", response.statusText);
  console.log("Response Headers:");
  response.headers.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });
  console.log("Response Body (raw):", responseText);
  console.log("================================================");

  if (!response.ok) {
    let errorDetail = responseText;
    try {
      const errorJson = JSON.parse(responseText);
      errorDetail = JSON.stringify(errorJson, null, 2);
      console.log("=========== ERROR DETAILS ===========");
      console.log("Type:", errorJson.type);
      console.log("Title:", errorJson.title);
      console.log("Status:", errorJson.status);
      console.log("Detail:", errorJson.detail);
      if (errorJson.errors) {
        console.log(
          "Errors array:",
          JSON.stringify(errorJson.errors, null, 2)
        );
      }
      console.log("=====================================");
    } catch {
      console.log("Could not parse error response as JSON");
    }
    throw new Error(
      `Payroc session creation failed: ${response.status} - ${errorDetail}`
    );
  }

  const data = JSON.parse(responseText);

  console.log("=========== SESSION TOKEN PARSED ===========");
  console.log("processingTerminalId:", data.processingTerminalId);
  console.log("token (first 30 chars):", data.token?.substring(0, 30));
  console.log("expiresAt:", data.expiresAt);
  console.log("All response keys:", Object.keys(data).join(", "));
  console.log("=============================================");

  return {
    token: data.token,
    expiresAt:
      data.expiresAt ||
      new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}
