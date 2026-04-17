import * as XLSX from "xlsx";
import type {
  RawProjectImportRowDraft,
  RawSmeFeedbackRowDraft,
  RawTimeLogRowDraft,
} from "@/lib/analytics/types";
import {
  compactCourseName,
  normalizeCourseName,
  normalizeLookupValue,
  normalizeTextPreserveMeaning,
  parseDurationToMinutes,
  parseReportingYear,
} from "@/lib/analytics/normalization";
import { parseUploadDate } from "@/lib/analytics/parse-upload-date";

export interface ParsedImportFile<T> {
  rows: T[];
  warnings: string[];
  encoding: string | null;
}

/**
 * Re-export of the centralized strict date parser. Kept under the original
 * `parseDateToIso` name for backward compatibility with existing callers/tests.
 */
export const parseDateToIso = parseUploadDate;

const WINDOWS_SAFE_ENCODINGS = ["windows-1252", "latin1", "utf-8"];
const UTF8_SAFE_ENCODINGS = ["utf-8", "windows-1252", "latin1"];

function isCsvFile(fileName: string) {
  return /\.csv$/i.test(fileName);
}

function describeRawValue(value: unknown): string {
  if (value == null) return "(empty)";
  if (typeof value === "string") return JSON.stringify(value);
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = normalizeTextPreserveMeaning(value);
  if (!text) return null;
  const cleaned = text.replace(/[$,%\s,]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Pull rows from the first sheet as raw text where possible. We pass
 * `raw: false` so XLSX returns formatted strings instead of inferring
 * JS Date / number types — this is critical for date columns where Excel
 * serials would otherwise be silently coerced into JS Date instances that
 * could later round-trip into malformed timestamp strings.
 */
function getSheetRowsFromWorkbook(workbook: XLSX.WorkBook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
    blankrows: false,
  });
}

function tryDecodeCsv(buffer: ArrayBuffer, encodings: string[]) {
  const warnings: string[] = [];

  for (const encoding of encodings) {
    try {
      const text = new TextDecoder(encoding).decode(buffer);
      // raw: false ensures values come back as strings, not as inferred Date/number types.
      const workbook = XLSX.read(text, { type: "string", raw: false, cellDates: false });
      const rows = getSheetRowsFromWorkbook(workbook);
      if (rows.length > 0) {
        if (encoding !== encodings[0]) {
          warnings.push(`Decoded CSV using fallback encoding ${encoding}.`);
        }
        return { rows, encoding, warnings };
      }
    } catch {
      warnings.push(`Failed to decode CSV as ${encoding}.`);
    }
  }

  return { rows: [] as Record<string, unknown>[], encoding: null, warnings };
}

async function readTabularRows(file: File, preferredEncodings: string[]) {
  const buffer = await file.arrayBuffer();
  if (isCsvFile(file.name)) return tryDecodeCsv(buffer, preferredEncodings);

  // Force text-safe reading for XLS/XLSX as well so date columns don't get
  // pre-coerced into JS Date or huge numeric serials.
  const workbook = XLSX.read(buffer, { type: "array", raw: false, cellDates: false });
  return {
    rows: getSheetRowsFromWorkbook(workbook),
    encoding: null,
    warnings: [] as string[],
  };
}

function validateRequiredHeaders(
  rows: Record<string, unknown>[],
  required: string[],
  fileName: string,
): string[] {
  if (rows.length === 0) return [];
  const headerKeys = Object.keys(rows[0]);
  const normalizedKeys = headerKeys.map((key) => normalizeLookupValue(key));
  const warnings: string[] = [];

  // Duplicate detection
  const seen = new Set<string>();
  for (const key of normalizedKeys) {
    if (!key) continue;
    if (seen.has(key)) {
      warnings.push(`${fileName}: duplicate header detected ("${key}"). Mapping may be ambiguous.`);
    }
    seen.add(key);
  }

  // Missing required headers
  for (const candidate of required) {
    const target = normalizeLookupValue(candidate);
    if (!normalizedKeys.includes(target)) {
      warnings.push(`${fileName}: expected header "${candidate}" not found.`);
    }
  }

  return warnings;
}

function getCell(row: Record<string, unknown>, candidates: string[]) {
  for (const candidate of candidates) {
    if (candidate in row) return row[candidate];
    const lookup = normalizeLookupValue(candidate);
    const found = Object.entries(row).find(([key]) => normalizeLookupValue(key) === lookup);
    if (found) return found[1];
  }
  return "";
}

function buildProjectDraft(
  row: Record<string, unknown>,
  rowNumber: number,
  sourceDataset: "legacy" | "modern",
  sourceFileName: string,
): RawProjectImportRowDraft | null {
  const suffix = sourceDataset === "legacy" ? "(L)" : "(M)";
  const rawCourseName = normalizeTextPreserveMeaning(getCell(row, ["Course Name"]));
  if (!rawCourseName || rawCourseName.toLowerCase().startsWith("total:")) return null;

  const reportingLabel = normalizeTextPreserveMeaning(getCell(row, [`[LCT] Reporting ${suffix}`]));
  const reportingYear = parseReportingYear(reportingLabel);
  const rawStatus = normalizeTextPreserveMeaning(
    getCell(row, ["Status", `[LCT] Status ${suffix}`]),
  );
  const rawTimeSpent = normalizeTextPreserveMeaning(getCell(row, ["Time spent"]));
  const parseWarnings: string[] = [];

  if (rawTimeSpent && parseDurationToMinutes(rawTimeSpent) === 0) {
    parseWarnings.push("Could not confidently parse project total duration.");
  }

  return {
    source_dataset: sourceDataset,
    source_file_name: sourceFileName,
    row_number: rowNumber,
    raw_row: row,
    raw_course_name: rawCourseName,
    normalized_course_name: normalizeCourseName(rawCourseName),
    compact_course_name: compactCourseName(rawCourseName),
    reporting_label: reportingLabel,
    reporting_year: reportingYear,
    raw_status: rawStatus,
    raw_time_spent: rawTimeSpent,
    project_total_minutes: parseDurationToMinutes(rawTimeSpent),
    id_assigned_raw: normalizeTextPreserveMeaning(getCell(row, [`[LCT] ID Assigned ${suffix}`])),
    sme_assigned_raw: normalizeTextPreserveMeaning(getCell(row, [`[LCT] SME ${suffix}`])),
    legal_reviewer_raw: normalizeTextPreserveMeaning(getCell(row, [`[LCT] Legal Reviewer ${suffix}`])),
    vertical_raw: normalizeTextPreserveMeaning(getCell(row, [`[LCT] Vertical ${suffix}`])),
    course_type: normalizeTextPreserveMeaning(getCell(row, [`[LCT] Course Type ${suffix}`])),
    authoring_tool: normalizeTextPreserveMeaning(getCell(row, [`[LCT] Authoring Tool ${suffix}`])),
    course_style: normalizeTextPreserveMeaning(getCell(row, [`[LCT] Course Style ${suffix}`])),
    course_length_raw: normalizeTextPreserveMeaning(getCell(row, [`[LCT] Course Length ${suffix}`])),
    interaction_count: parseNumber(getCell(row, [`[LCT] Interaction Count ${suffix}`])) ?? null,
    parse_warnings: parseWarnings,
  };
}

function buildTimeLogDraft(
  row: Record<string, unknown>,
  rowNumber: number,
  sourceFileName: string,
): RawTimeLogRowDraft | null {
  const rawCourseName = normalizeTextPreserveMeaning(
    getCell(row, ["Cousre name", "Course name", "Course Name"]),
  );
  if (!rawCourseName || rawCourseName.toLowerCase().startsWith("total:")) return null;

  const rawDate = normalizeTextPreserveMeaning(getCell(row, ["Date"]));
  const logDate = parseDateToIso(rawDate);
  const rawTimeSpent = normalizeTextPreserveMeaning(getCell(row, ["Time spent"]));
  const parseWarnings: string[] = [];

  if (rawDate && !logDate) parseWarnings.push("Could not confidently parse log date.");
  if (rawTimeSpent && parseDurationToMinutes(rawTimeSpent) === 0) {
    parseWarnings.push("Could not confidently parse log duration.");
  }

  return {
    source_file_name: sourceFileName,
    row_number: rowNumber,
    raw_row: row,
    raw_course_name: rawCourseName,
    normalized_course_name: normalizeCourseName(rawCourseName),
    compact_course_name: compactCourseName(rawCourseName),
    raw_category: normalizeTextPreserveMeaning(getCell(row, ["Category"])),
    raw_date: rawDate,
    log_date: logDate,
    raw_time_spent: rawTimeSpent,
    minutes: parseDurationToMinutes(rawTimeSpent),
    raw_user: normalizeTextPreserveMeaning(getCell(row, ["User"])),
    parse_warnings: parseWarnings,
  };
}

function buildSmeDraft(
  row: Record<string, unknown>,
  rowNumber: number,
  sourceFileName: string,
): RawSmeFeedbackRowDraft | null {
  const courseNameRaw = normalizeTextPreserveMeaning(getCell(row, ["Course Name"]));
  if (!courseNameRaw) return null;

  const courseKeyRaw = normalizeTextPreserveMeaning(getCell(row, ["CourseKey"]));
  const reportingYear = parseReportingYear(getCell(row, ["Year"]));
  const surveyDate = parseDateToIso(getCell(row, ["Survey Date"]));
  const parseWarnings: string[] = [];

  if (getCell(row, ["Survey Date"]) && !surveyDate) {
    parseWarnings.push("Could not confidently parse survey date.");
  }

  return {
    source_file_name: sourceFileName,
    row_number: rowNumber,
    raw_row: row,
    course_key_raw: courseKeyRaw,
    course_key_normalized: normalizeCourseName(courseKeyRaw),
    course_key_compact: compactCourseName(courseKeyRaw),
    course_name_raw: courseNameRaw,
    course_name_normalized: normalizeCourseName(courseNameRaw),
    course_name_compact: compactCourseName(courseNameRaw),
    reporting_year: reportingYear,
    survey_date: surveyDate,
    sme_raw: normalizeTextPreserveMeaning(getCell(row, ["SME"])),
    instructional_designer_raw: normalizeTextPreserveMeaning(getCell(row, ["Instructional Designer - ID"])),
    sme_email_raw: normalizeTextPreserveMeaning(getCell(row, ["SME Email"])),
    internal_raw: normalizeTextPreserveMeaning(getCell(row, ["Internal"])),
    hours_worked: parseNumber(getCell(row, ["Hours Worked"])),
    amount_billed: parseNumber(getCell(row, ["Amount Billed"])),
    parse_warnings: parseWarnings,
  };
}

export async function parseLegacyProjectImportFile(file: File): Promise<ParsedImportFile<RawProjectImportRowDraft>> {
  const { rows, warnings, encoding } = await readTabularRows(file, WINDOWS_SAFE_ENCODINGS);
  return {
    rows: rows
      .map((row, index) => buildProjectDraft(row, index + 1, "legacy", file.name))
      .filter((row): row is RawProjectImportRowDraft => row !== null),
    warnings,
    encoding,
  };
}

export async function parseModernProjectImportFile(file: File): Promise<ParsedImportFile<RawProjectImportRowDraft>> {
  const { rows, warnings, encoding } = await readTabularRows(file, UTF8_SAFE_ENCODINGS);
  return {
    rows: rows
      .map((row, index) => buildProjectDraft(row, index + 1, "modern", file.name))
      .filter((row): row is RawProjectImportRowDraft => row !== null),
    warnings,
    encoding,
  };
}

export async function parseTimeLogImportFile(file: File): Promise<ParsedImportFile<RawTimeLogRowDraft>> {
  const { rows, warnings, encoding } = await readTabularRows(file, WINDOWS_SAFE_ENCODINGS);
  return {
    rows: rows
      .map((row, index) => buildTimeLogDraft(row, index + 1, file.name))
      .filter((row): row is RawTimeLogRowDraft => row !== null),
    warnings,
    encoding,
  };
}

export async function parseSmeImportFile(file: File): Promise<ParsedImportFile<RawSmeFeedbackRowDraft>> {
  const { rows, warnings, encoding } = await readTabularRows(file, UTF8_SAFE_ENCODINGS);
  return {
    rows: rows
      .map((row, index) => buildSmeDraft(row, index + 1, file.name))
      .filter((row): row is RawSmeFeedbackRowDraft => row !== null),
    warnings,
    encoding,
  };
}
