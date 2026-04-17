import { SAFE_COURSE_ALIASES, SAFE_PERSON_ALIASES } from "@/lib/analytics/constants";

const TEXT_REPLACEMENTS: Array<[string | RegExp, string]> = [
  [/\u2018|\u2019|\u2032/g, "'"],
  [/\u201c|\u201d/g, '"'],
  [/\u2013|\u2014|\u2212|\u0096|\u0097/g, "-"],
  [/\u00c3\u00a2\u00e2\u201a\u00ac\u00e2\u20ac\u0153/g, "-"],
  [/\u00e2\u20ac["\u201c\u201d]/g, "-"],
  [/\u00e2\u20ac[\u02dc\u2122]/g, "'"],
  [/â€™/g, "'"],
  [/â€˜/g, "'"],
  [/â€œ|â€/g, '"'],
  [/â€“|â€”/g, "-"],
  [/\u00a0/g, " "],
];

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function stripWrappingQuotes(value: string) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

export function normalizeTextPreserveMeaning(value: unknown): string {
  let text = String(value ?? "");
  TEXT_REPLACEMENTS.forEach(([pattern, replacement]) => {
    text = text.replace(pattern as never, replacement);
  });

  text = text
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+-\s+|\s+-|-\s+/g, " - ")
    .replace(/\s+/g, " ")
    .trim();

  return text;
}

export function parseReportingYear(value: unknown): string | null {
  const text = normalizeTextPreserveMeaning(value);
  const match = text.match(/\b(20\d{2})\b/);
  return match ? match[1] : null;
}

function parseClockLikeDurationToMinutes(text: string): number | null {
  const clock = text.match(/^(\d+):(\d{2})(?::(\d{2}))?$/);
  if (clock) {
    const hours = Number.parseInt(clock[1], 10);
    const minutes = Number.parseInt(clock[2], 10);
    const seconds = clock[3] ? Number.parseInt(clock[3], 10) : 0;
    return Math.round(hours * 60 + minutes + seconds / 60);
  }

  const excelDateTime = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i,
  );
  if (!excelDateTime) return null;

  const day = Number.parseInt(excelDateTime[2], 10);
  const year = Number.parseInt(excelDateTime[3], 10);
  let hour = Number.parseInt(excelDateTime[4], 10);
  const minute = Number.parseInt(excelDateTime[5], 10);
  const second = excelDateTime[6] ? Number.parseInt(excelDateTime[6], 10) : 0;
  const ampm = excelDateTime[7].toUpperCase();

  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  if (year === 1900) {
    const dayBucket = Math.max(day - 1, 0);
    return Math.round(dayBucket * 24 * 60 + hour * 60 + minute + second / 60);
  }

  return Math.round(hour * 60 + minute + second / 60);
}

function parseUnitDurationToMinutes(text: string): number | null {
  const normalized = text.toLowerCase();
  const matches = [...normalized.matchAll(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|minutes?|mins?|min)\b/g)];
  if (matches.length === 0) return null;

  const remainder = normalized
    .replace(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|hr|minutes?|mins?|min)\b/g, "")
    .replace(/[,+]/g, " ")
    .trim();

  if (remainder) return null;

  return Math.round(
    matches.reduce((total, match) => {
      const amount = Number.parseFloat(match[1]);
      if (!Number.isFinite(amount)) return total;
      return total + (match[2].startsWith("h") ? amount * 60 : amount);
    }, 0),
  );
}

export function parseDurationToMinutes(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value < 10) return Math.round(value * 24 * 60);
    return Math.round(value * 60);
  }

  const text = normalizeTextPreserveMeaning(value);
  if (!text) return 0;

  const clockMinutes = parseClockLikeDurationToMinutes(text);
  if (clockMinutes !== null) return clockMinutes;

  const unitMinutes = parseUnitDurationToMinutes(text);
  if (unitMinutes !== null) return unitMinutes;

  const numeric = Number.parseFloat(text);
  if (Number.isFinite(numeric) && /^-?\d+(?:\.\d+)?$/.test(text)) {
    if (numeric >= 0 && numeric < 10) return Math.round(numeric * 24 * 60);
    return Math.round(numeric * 60);
  }

  return 0;
}

export function splitMultiValueField(value: unknown): string[] {
  const text = normalizeTextPreserveMeaning(value);
  if (!text) return [];

  const items: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;

  for (const char of text) {
    if ((char === '"' || char === "'") && (!quote || quote === char)) {
      quote = quote ? null : (char as '"' | "'");
      continue;
    }

    if ((char === "," || char === ";" || char === "\n") && !quote) {
      const token = stripWrappingQuotes(current);
      if (token) items.push(token);
      current = "";
      continue;
    }

    current += char;
  }

  const tail = stripWrappingQuotes(current);
  if (tail) items.push(tail);

  return items
    .map((item) => normalizeTextPreserveMeaning(item))
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index);
}

function removeTrailingDateArtifacts(value: string) {
  return value
    .replace(/\s+\(?\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\)?$/g, "")
    .replace(/\s+\(?20\d{2}-\d{2}-\d{2}\)?$/g, "")
    .trim();
}

export function normalizeCourseName(
  value: unknown,
  manualAliasLookup?: Map<string, string>,
): string {
  let text = normalizeTextPreserveMeaning(value);
  text = removeTrailingDateArtifacts(text);
  text = text.replace(/\s*-\s*(20\d{2})$/g, " $1");
  text = normalizeTextPreserveMeaning(text);

  const lookupKey = normalizeLookupKey(text);
  if (manualAliasLookup?.has(lookupKey)) {
    return normalizeTextPreserveMeaning(manualAliasLookup.get(lookupKey));
  }

  if (SAFE_COURSE_ALIASES[lookupKey]) {
    return normalizeTextPreserveMeaning(SAFE_COURSE_ALIASES[lookupKey]);
  }

  return text;
}

export function compactCourseName(value: unknown, manualAliasLookup?: Map<string, string>): string {
  return normalizeCourseName(value, manualAliasLookup)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export function normalizePersonName(
  value: unknown,
  manualAliasLookup?: Map<string, string>,
): string {
  const text = normalizeTextPreserveMeaning(value);
  const lookupKey = normalizeLookupKey(text);

  if (manualAliasLookup?.has(lookupKey)) {
    return normalizeTextPreserveMeaning(manualAliasLookup.get(lookupKey));
  }

  if (SAFE_PERSON_ALIASES[lookupKey]) {
    return normalizeTextPreserveMeaning(SAFE_PERSON_ALIASES[lookupKey]);
  }

  return text;
}

export function normalizeVerticalValue(value: unknown): string {
  const text = normalizeTextPreserveMeaning(value).toUpperCase();
  if (!text) return "";
  if (text === "EMS1A") return "EMS1";
  return text;
}

export function normalizeLookupValue(value: unknown): string {
  return normalizeLookupKey(normalizeTextPreserveMeaning(value));
}
