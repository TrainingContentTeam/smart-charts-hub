/**
 * Strict, centralized date parser for upload ingestion.
 *
 * Accepts ONLY:
 *   - Excel serial numbers (number or numeric string, including decimals like "45217.0")
 *     within a safe window (30000 < n < 60000)
 *   - YYYY-MM-DD (optionally followed by time, which is ignored)
 *   - M/D/YYYY or MM/DD/YYYY (optionally followed by time, which is ignored)
 *
 * Returns ISO date string (YYYY-MM-DD) when valid, otherwise null.
 *
 * NEVER falls back to `new Date(string)` — that fallback was the root cause of
 * the Postgres "time zone displacement out of range: +045217-01" error, where a
 * stray Excel serial would be interpreted as a year (e.g. 45217).
 */

const EXCEL_EPOCH_OFFSET_DAYS = 25569;
const MS_PER_DAY = 86400 * 1000;
const MIN_SAFE_SERIAL = 30000; // ~1982
const MAX_SAFE_SERIAL = 60000; // ~2064

function excelSerialToIso(serial: number): string | null {
  if (!Number.isFinite(serial)) return null;
  if (serial <= MIN_SAFE_SERIAL || serial >= MAX_SAFE_SERIAL) return null;
  const ms = Math.round((serial - EXCEL_EPOCH_OFFSET_DAYS) * MS_PER_DAY);
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  if (year < 1900 || year > 2100) return null;
  return date.toISOString().slice(0, 10);
}

function normalize(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

export function parseUploadDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear();
    if (y < 1900 || y > 2100) return null;
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "number") {
    return excelSerialToIso(value);
  }

  const text = normalize(value);
  if (!text) return null;

  // ISO date YYYY-MM-DD (optional time suffix ignored)
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${iso[1]}-${iso[2]}-${iso[3]}`;
    }
    return null;
  }

  // M/D/YYYY or MM/DD/YYYY (optional time suffix ignored)
  const mdy = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[ T].*)?$/);
  if (mdy) {
    const m = Number(mdy[1]);
    const d = Number(mdy[2]);
    const y = Number(mdy[3]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31 && y >= 1900 && y <= 2100) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    return null;
  }

  // Excel serial as string — integer or decimal (e.g. "45217" or "45217.0")
  if (/^\d{4,6}(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    return excelSerialToIso(serial);
  }

  return null;
}
