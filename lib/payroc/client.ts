import { prisma } from "@/lib/prisma";
import crypto from "crypto";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

export async function getPayrocToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.token;
  }

  const dbToken = await prisma.payrocToken.findFirst({
    orderBy: { createdAt: "desc" },
  });

  if (dbToken && dbToken.expiresAt.getTime() > Date.now() + 60000) {
    tokenCache = {
      token: dbToken.token,
      expiresAt: dbToken.expiresAt.getTime(),
    };
    return dbToken.token;
  }

  const apiKey = process.env.PAYROC_API_KEY;
  const authUrl = process.env.PAYROC_AUTH_URL;

  if (!apiKey || !authUrl) {
    throw new Error("Payroc credentials not configured");
  }

  const response = await fetch(authUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Payroc auth failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  console.log("[PAYROC-AUTH] Bearer response keys:", Object.keys(data));

  // Payroc returns { access_token, expires_in, token_type }
  const accessToken = data.access_token ?? data.token;
  const expiresInSeconds = data.expires_in ?? data.expiresIn ?? 3600;
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  if (!accessToken) {
    throw new Error(
      `Payroc auth returned no token. Response: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  tokenCache = { token: accessToken, expiresAt };

  try {
    await prisma.payrocToken.deleteMany({});
    await prisma.payrocToken.create({
      data: {
        token: accessToken,
        expiresAt: new Date(expiresAt),
      },
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

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Payroc API error: ${response.status} ${path} ${error}`);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export async function getHostedFieldsSessionToken(
  scenario: "payment" | "tokenization"
): Promise<{ token: string; expiresAt: string }> {
  const bearerToken = await getPayrocToken();
  const sessionHost =
    process.env.PAYROC_SESSION_HOST || process.env.PAYROC_API_URL;
  const terminalId = process.env.PAYROC_TERMINAL_ID;

  if (!sessionHost || !terminalId) {
    throw new Error("Payroc session host or Terminal ID not configured");
  }

  // Extract libVersion from CDN URL so it always matches the loaded SDK
  const { getHostedFieldsConfig } = await import("./hosted-fields");
  const config = getHostedFieldsConfig();
  const urlMatch = config.url.match(/hosted-fields-([\d.]+)\.js/);
  const libVersion = urlMatch ? urlMatch[1] : "1.7.0.261457";

  console.log("[SESSION] libVersion:", libVersion);
  console.log(
    "[PAYROC-DIAG] Minting session token from:",
    `${sessionHost}/processing-terminals/${terminalId}/hosted-fields-sessions`
  );

  const response = await fetch(
    `${sessionHost}/processing-terminals/${terminalId}/hosted-fields-sessions`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${bearerToken}`,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        libVersion,
        scenario,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Payroc hosted fields session failed: ${response.status} ${error}`
    );
  }

  const data = await response.json();
  console.log("[PAYROC-SESSION] Session response keys:", Object.keys(data));

  const sessionToken = data.token;
  const expiresAt = data.expiresAt ?? data.expires_at;

  if (!sessionToken) {
    throw new Error(
      `Payroc session returned no token. Response: ${JSON.stringify(data).slice(0, 200)}`
    );
  }

  return {
    token: sessionToken,
    expiresAt: expiresAt ?? new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
}
