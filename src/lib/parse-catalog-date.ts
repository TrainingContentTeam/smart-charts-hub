import { parseUploadDate } from "@/lib/analytics/parse-upload-date";

export function normalizeCatalogText(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function pickCatalogCell(row: Record<string, unknown>, candidates: string[]): unknown {
  const entries = Object.entries(row);

  for (const candidate of candidates) {
    if (candidate in row) return row[candidate];
  }

  for (const [key, value] of entries) {
    const normalizedKey = key.trim().toLowerCase();
    if (candidates.some((candidate) => normalizedKey === candidate.trim().toLowerCase())) {
      return value;
    }
  }

  return "";
}

export function parseCatalogDate(value: unknown): string | null {
  return parseUploadDate(value);
}

export function parseCatalogInteger(value: unknown): number | null {
  if (value == null || value === "") return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number.parseInt(text.replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function deriveCourseVersionFromDate(dateIso: string | null): string | null {
  if (!dateIso) return null;
  const match = dateIso.match(/^(\d{4})-(\d{2})-\d{2}$/);
  if (!match) return null;
  const [, year, month] = match;
  return `v.${year}.${month}.00`;
}

export function isValidCourseVersion(value: string): boolean {
  return /^v\.\d{4}\.\d{2}\.\d{2}$/.test(value.trim());
}
