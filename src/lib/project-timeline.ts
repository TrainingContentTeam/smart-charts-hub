import { parseEntryYear } from "@/lib/time-entry-resolution";

export function parseReportingYear(value: unknown): number | null {
  const year = Number.parseInt(String(value || "").trim(), 10);
  return Number.isFinite(year) ? year : null;
}

export function getEarliestTimelineYear(entryDates: Array<string | null | undefined>): number | null {
  const years = entryDates
    .map((entryDate) => parseEntryYear(String(entryDate || "")))
    .filter((year): year is number => year !== null);

  if (years.length === 0) return null;
  return Math.min(...years);
}

export function isCarryoverFromTimeline(
  reportingYear: unknown,
  entryDates: Array<string | null | undefined>,
): boolean {
  const projectYear = parseReportingYear(reportingYear);
  if (projectYear === null) return false;

  const earliestTimelineYear = getEarliestTimelineYear(entryDates);
  if (earliestTimelineYear === null) return false;

  return earliestTimelineYear < projectYear;
}
