export type TimelineProjectCandidate = {
  key: string;
  reportingYear: string;
  dataSource: string;
};

export type TimeResolutionReason =
  | "no_candidate"
  | "single"
  | "exact_year"
  | "source_hint"
  | "unresolved"
  | "manual_override";

export type TimeResolutionResult = {
  key: string | null;
  reason: TimeResolutionReason;
};

type TimeResolutionEntry = {
  courseName: string;
  date: string;
};

function normKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseEntryYear(entryDate: string): number | null {
  if (!entryDate) return null;
  const match = String(entryDate).trim().match(/^(\d{4})-/);
  if (!match) return null;
  const year = Number.parseInt(match[1], 10);
  return Number.isFinite(year) ? year : null;
}

export function resolveProjectKeyForTimeEntry(
  entry: TimeResolutionEntry,
  byName: Map<string, TimelineProjectCandidate[]>,
): TimeResolutionResult {
  return resolveProjectKeyForTimeEntryWithOverride(entry, byName, null);
}

export function resolveProjectKeyForTimeEntryWithOverride(
  entry: TimeResolutionEntry,
  byName: Map<string, TimelineProjectCandidate[]>,
  manualOverrideKey: string | null,
): TimeResolutionResult {
  if (manualOverrideKey) return { key: manualOverrideKey, reason: "manual_override" };

  const nameKey = normKey(entry.courseName);
  const candidates = byName.get(nameKey) || [];
  if (candidates.length === 0) return { key: null, reason: "no_candidate" };
  if (candidates.length === 1) return { key: candidates[0].key, reason: "single" };

  const entryYear = parseEntryYear(entry.date);
  if (entryYear === null) return { key: null, reason: "unresolved" };

  const exactYear = candidates.filter((candidate) => candidate.reportingYear === String(entryYear));
  if (exactYear.length === 1) return { key: exactYear[0].key, reason: "exact_year" };
  if (exactYear.length > 1) return { key: null, reason: "unresolved" };

  const preferredSource = entryYear <= 2025 ? "legacy" : "modern";
  const sourceMatch = candidates.filter((candidate) => candidate.dataSource === preferredSource);
  if (sourceMatch.length === 1) return { key: sourceMatch[0].key, reason: "source_hint" };

  return { key: null, reason: "unresolved" };
}
