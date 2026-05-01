import ExcelJS from "exceljs";
import path from "path";
import { promises as fs } from "fs";

interface CertRunData {
  id: string;
  sheetName: string;
  sectionName: string;
  transactionType: string;
  scenario: string;
  status: string;
  paymentId: string | null;
  notes: string | null;
  errorMessage: string | null;
  ranAt: Date | null;
}

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "lib",
  "cert",
  "templates",
  "cert-test-template.xlsx"
);

const CNP_SHEET = "GENERAL CNP TEST HF CASES";
const CP_SHEET = "GENERAL CP TEST CASES";

// CNP column indices (1-based for ExcelJS)
const CNP_COL = {
  TRANSACTION_TYPE: 2,
  SCENARIO: 3,
  PAYMENT_ID: 5,
  DATE: 6,
  NOTES: 8,
};

// CP column indices — Notes is in column G (7) instead of H
const CP_COL = {
  TRANSACTION_TYPE: 2,
  SCENARIO: 3,
  PAYMENT_ID: 5,
  DATE: 6,
  NOTES: 7,
};

/**
 * Section name aliases. Maps Matt's xlsx section name (normalized) to
 * one or more DB section names. DB names were chosen for UI clarity;
 * exporter translates back at export time.
 */
const SECTION_ALIASES: Record<string, string[]> = {
  // CNP + CP: Matt's single "Credit Card Pre-Auth | Capture" section
  // maps to both the basic and adjust DB sections
  "credit card pre-auth | capture": [
    "credit card pre-auth | capture",
    "credit card pre-auth | capture (with adjust)",
  ],
  // CP: Matt's verbose token section title (broken across lines)
  "create a credit card secure token without processing a sale * if there are scenarios where a customer is adding or updating a secure token through the hardware terminal.":
    ["create a credit card secure token via terminal"],
};

function resolveDbSections(mattSection: string): string[] {
  const key = norm(mattSection);
  return SECTION_ALIASES[key] ?? [key];
}

/**
 * Transaction type aliases. Matt's xlsx contains typos in some transaction
 * type labels (column B). Map Matt's value (after normalization) to the
 * corresponding DB-spelled value.
 */
const TRANSACTION_TYPE_ALIASES: Record<string, string> = {
  "caprture (pre-auth completion)": "capture (pre-auth completion)",
  "recurrnig sale - first trans": "recurring sale - first trans",
  "recurrnig sale - subsequent trans": "recurring sale - subsequent trans",
  "void/ reversal (same day)": "void/reversal (same day)",
};

function resolveDbTxnType(mattTxn: string): string {
  const key = mattTxn.replace(/\n/g, " ").trim().toLowerCase().replace(/\s+/g, " ");
  return TRANSACTION_TYPE_ALIASES[key] ?? key;
}

/**
 * Extract plain text from an ExcelJS cell value.
 * Handles: plain strings, richText arrays, numbers, booleans, null.
 */
function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && "richText" in value) {
    return (value as { richText: Array<{ text: string }> }).richText
      .map((rt) => rt.text)
      .join("");
  }
  return String(value);
}

const norm = (s: string) =>
  s.replace(/\n/g, " ").trim().toLowerCase().replace(/\s+/g, " ");

function findMatch(
  runs: CertRunData[],
  sheetCode: "CNP" | "CP",
  sectionName: string,
  transactionType: string,
  scenario: string,
  consumedIds: Set<string>
): CertRunData | null {
  const acceptableDbSections = new Set(resolveDbSections(sectionName));
  const targetTxn = resolveDbTxnType(transactionType);
  const targetScenario = norm(scenario);

  const available = (r: CertRunData) =>
    !consumedIds.has(r.id) && r.sheetName === sheetCode;

  // Pass 1: exact match on (sheet, alias-resolved section, alias-resolved txn, scenario)
  for (const r of runs) {
    if (!available(r)) continue;
    if (!acceptableDbSections.has(norm(r.sectionName))) continue;
    if (norm(r.transactionType) !== targetTxn) continue;
    if (norm(r.scenario) !== targetScenario) continue;
    consumedIds.add(r.id);
    return r;
  }

  // Pass 2: section + txn only (fallback when scenario text drifted)
  for (const r of runs) {
    if (!available(r)) continue;
    if (!acceptableDbSections.has(norm(r.sectionName))) continue;
    if (norm(r.transactionType) !== targetTxn) continue;
    consumedIds.add(r.id);
    return r;
  }

  return null;
}

function formatDate(d: Date | null): string {
  if (!d) return "";
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
}

function buildNotes(run: CertRunData): string {
  const parts: string[] = [];
  parts.push(`Status: ${run.status.toUpperCase()}`);
  if (run.errorMessage) parts.push(`Error: ${run.errorMessage}`);
  if (run.notes) parts.push(run.notes);
  return parts.join(" | ");
}

function fillSheet(
  worksheet: ExcelJS.Worksheet,
  runs: CertRunData[],
  sheetCode: "CNP" | "CP"
): { matched: number; total: number } {
  const cols = sheetCode === "CNP" ? CNP_COL : CP_COL;
  let currentSection = "";
  let matched = 0;
  let total = 0;
  const consumedIds = new Set<string>();

  for (let r = 4; r <= worksheet.rowCount; r++) {
    const row = worksheet.getRow(r);
    const colA = row.getCell(1).value;
    const colB = cellText(row.getCell(cols.TRANSACTION_TYPE).value);
    const colC = cellText(row.getCell(cols.SCENARIO).value);

    // Section header: column A has rich text or non-boolean text,
    // and column B either matches A or is empty/rich-text
    const isDataRow = colA === true || colA === false;

    if (!isDataRow) {
      const headerText = cellText(colA).trim();
      if (headerText.length > 3) {
        currentSection = headerText;
      }
      continue;
    }

    if (!colB.trim()) continue;

    total += 1;

    const match = findMatch(runs, sheetCode, currentSection, colB, colC, consumedIds);
    if (!match) continue;
    matched += 1;

    if (match.paymentId) {
      row.getCell(cols.PAYMENT_ID).value = match.paymentId;
    }
    if (match.ranAt) {
      row.getCell(cols.DATE).value = formatDate(match.ranAt);
    }
    row.getCell(cols.NOTES).value = buildNotes(match);
  }

  return { matched, total };
}

export async function buildExportXlsx(
  runs: CertRunData[],
  sessionName: string
): Promise<{
  buffer: Buffer;
  filename: string;
  cnpStats: { matched: number; total: number };
  cpStats: { matched: number; total: number };
}> {
  try {
    await fs.access(TEMPLATE_PATH);
  } catch {
    throw new Error(
      `Cert template not found at ${TEMPLATE_PATH}. ` +
        `Confirm lib/cert/templates/cert-test-template.xlsx is bundled.`
    );
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);

  const cnpSheet = workbook.getWorksheet(CNP_SHEET);
  const cpSheet = workbook.getWorksheet(CP_SHEET);

  if (!cnpSheet) throw new Error(`Template missing sheet: ${CNP_SHEET}`);
  if (!cpSheet) throw new Error(`Template missing sheet: ${CP_SHEET}`);

  const cnpStats = fillSheet(cnpSheet, runs, "CNP");
  const cpStats = fillSheet(cpSheet, runs, "CP");

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const safeName = sessionName.replace(/[^a-zA-Z0-9-_]/g, "_").slice(0, 60);
  const today = new Date().toISOString().slice(0, 10);
  const filename = `cert-results-${safeName}-${today}.xlsx`;

  return { buffer, filename, cnpStats, cpStats };
}
