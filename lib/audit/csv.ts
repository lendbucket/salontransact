import type { AuditLogPublic } from "./types";

function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function auditLogsToCsv(
  rows: Array<AuditLogPublic & { merchantBusinessName?: string | null }>
): string {
  const headers = [
    "id",
    "createdAt",
    "actorEmail",
    "actorRole",
    "action",
    "targetType",
    "targetId",
    "merchantId",
    "merchantBusinessName",
    "metadata",
  ];

  const lines: string[] = [headers.join(",")];

  for (const row of rows) {
    const cells = [
      row.id,
      row.createdAt,
      row.actorEmail,
      row.actorRole,
      row.action,
      row.targetType,
      row.targetId,
      row.merchantId ?? "",
      row.merchantBusinessName ?? "",
      row.metadata ? JSON.stringify(row.metadata) : "",
    ];
    lines.push(cells.map(escapeCsvCell).join(","));
  }

  return lines.join("\n");
}

export function csvFilename(prefix: string): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  return `${prefix}-${stamp}.csv`;
}
