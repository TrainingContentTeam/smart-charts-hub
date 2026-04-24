import { normalizeTextPreserveMeaning } from "@/lib/analytics/normalization";

function normalizeCellText(value: unknown) {
  return normalizeTextPreserveMeaning(value);
}

function toModernYear(yearText: string) {
  if (yearText.length === 2) return 2000 + Number.parseInt(yearText, 10);
  return Number.parseInt(yearText, 10);
}

function isValidDateParts(year: number, month: number, day: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function parseApprovedUsShortDate(value: unknown): string | null {
  const text = normalizeCellText(value);
  if (!text) return null;

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!match) return null;

  const month = Number.parseInt(match[1], 10);
  const day = Number.parseInt(match[2], 10);
  const year = toModernYear(match[3]);

  if (!isValidDateParts(year, month, day)) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseApprovedDurationHoursMinutes(value: unknown): number | null {
  const text = normalizeCellText(value);
  if (!text) return null;

  const match = text.match(/^(\d+):(\d{2})$/);
  if (!match) return null;

  const hours = Number.parseInt(match[1], 10);
  const minutes = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) return null;

  return hours * 60 + minutes;
}
