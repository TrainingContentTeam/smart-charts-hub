import { describe, expect, it } from "vitest";
import {
  resolveProjectKeyForTimeEntryWithOverride,
  type TimelineProjectCandidate,
} from "@/lib/time-entry-resolution";

function makeCandidates(courseName: string, candidates: TimelineProjectCandidate[]) {
  return new Map([[courseName.trim().toLowerCase(), candidates]]);
}

describe("resolveProjectKeyForTimeEntryWithOverride", () => {
  it("maps duplicate titles by exact entry-date year first", () => {
    const candidates: TimelineProjectCandidate[] = [
      { key: "course-a::2025", reportingYear: "2025", dataSource: "legacy" },
      { key: "course-a::2026", reportingYear: "2026", dataSource: "modern" },
    ];

    const resolved = resolveProjectKeyForTimeEntryWithOverride(
      { courseName: "Course A", date: "2026-04-12" },
      makeCandidates("Course A", candidates),
      null,
    );

    expect(resolved).toEqual({ key: "course-a::2026", reason: "exact_year" });
  });

  it("uses a unique source hint when the entry year points cleanly to one source", () => {
    const candidates: TimelineProjectCandidate[] = [
      { key: "course-a::2024", reportingYear: "2024", dataSource: "legacy" },
      { key: "course-a::2026", reportingYear: "2026", dataSource: "modern" },
    ];

    const resolved = resolveProjectKeyForTimeEntryWithOverride(
      { courseName: "Course A", date: "2025-01-15" },
      makeCandidates("Course A", candidates),
      null,
    );

    expect(resolved).toEqual({ key: "course-a::2024", reason: "source_hint" });
  });

  it("leaves undated duplicate-title rows unresolved for review", () => {
    const candidates: TimelineProjectCandidate[] = [
      { key: "course-a::2025", reportingYear: "2025", dataSource: "legacy" },
      { key: "course-a::2026", reportingYear: "2026", dataSource: "modern" },
    ];

    const resolved = resolveProjectKeyForTimeEntryWithOverride(
      { courseName: "Course A", date: "" },
      makeCandidates("Course A", candidates),
      null,
    );

    expect(resolved).toEqual({ key: null, reason: "unresolved" });
  });

  it("does not fall back to the latest year when the source hint is still ambiguous", () => {
    const candidates: TimelineProjectCandidate[] = [
      { key: "course-a::2024", reportingYear: "2024", dataSource: "legacy" },
      { key: "course-a::2026", reportingYear: "2026", dataSource: "modern" },
      { key: "course-a::2027", reportingYear: "2027", dataSource: "modern" },
    ];

    const resolved = resolveProjectKeyForTimeEntryWithOverride(
      { courseName: "Course A", date: "2028-03-01" },
      makeCandidates("Course A", candidates),
      null,
    );

    expect(resolved).toEqual({ key: null, reason: "unresolved" });
  });
});
