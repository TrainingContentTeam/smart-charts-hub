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

export function parseApprovedUsLocalDateTime(value: unknown): string | null {
  const text = normalizeCellText(value);
  if (!text) return null;

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;

  const month = Number.parseInt(match[1], 10);
  const day = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  const hour = Number.parseInt(match[4], 10);
  const minute = Number.parseInt(match[5], 10);
  const second = match[6] ? Number.parseInt(match[6], 10) : 0;

  if (!isValidDateParts(year, month, day)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;

  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

export function extractDateFromLocalDateTime(value: string | null): string | null {
  return value ? value.slice(0, 10) : null;
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
