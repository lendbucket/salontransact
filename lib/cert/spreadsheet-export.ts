import ExcelJS from "exceljs";
import path from "path";
import { promises as fs } from "fs";

interface CertRunData {
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

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

function findMatch(
  runs: CertRunData[],
  sheetCode: "CNP" | "CP",
  sectionName: string,
  transactionType: string,
  scenario: string
): CertRunData | null {
  const targetSection = norm(sectionName);
  const targetTxn = norm(transactionType);
  const targetScenario = norm(scenario);

  // Exact match on all three
  for (const r of runs) {
    if (r.sheetName !== sheetCode) continue;
    if (norm(r.sectionName) !== targetSection) continue;
    if (norm(r.transactionType) !== targetTxn) continue;
    if (norm(r.scenario) !== targetScenario) continue;
    return r;
  }

  // Fallback: section + transactionType + scenario starts-with (handle truncation)
  for (const r of runs) {
    if (r.sheetName !== sheetCode) continue;
    if (norm(r.sectionName) !== targetSection) continue;
    if (norm(r.transactionType) !== targetTxn) continue;
    if (targetScenario.startsWith(norm(r.scenario).slice(0, 40))) return r;
  }

  // Last resort: section + transactionType only (may produce wrong match for
  // same-section same-type tests with different amounts, but better than nothing)
  for (const r of runs) {
    if (r.sheetName !== sheetCode) continue;
    if (norm(r.sectionName) !== targetSection) continue;
    if (norm(r.transactionType) !== targetTxn) continue;
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
  const usedRuns = new Set<CertRunData>();

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

    const match = findMatch(runs, sheetCode, currentSection, colB, colC);
    if (!match || usedRuns.has(match)) continue;

    usedRuns.add(match);
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
