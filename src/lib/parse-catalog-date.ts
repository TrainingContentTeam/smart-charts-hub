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

function formatDateParts(year: number, month: number, day: number): string {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

export function parseCatalogDate(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  let match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, month, day, year] = match;
    return formatDateParts(Number(year), Number(month), Number(day));
  }

  match = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return formatDateParts(Number(year), Number(month), Number(day));
  }

  const serial = Number(text);
  if (Number.isFinite(serial) && serial > 30000 && serial < 70000) {
    const jsDate = new Date((serial - 25569) * 86400 * 1000);
    if (!Number.isNaN(jsDate.getTime())) return jsDate.toISOString().slice(0, 10);
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);

  return null;
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
