import { describe, expect, it } from "vitest";
import { getEarliestTimelineYear, isCarryoverFromTimeline } from "@/lib/project-timeline";

describe("project timeline carryover", () => {
  it("classifies a project as carryover when dated work starts before its reporting year", () => {
    expect(isCarryoverFromTimeline("2026", ["2025-11-12", "2026-01-03"])).toBe(true);
  });

  it("does not classify same-year work as carryover", () => {
    expect(isCarryoverFromTimeline("2026", ["2026-02-15", "2026-06-01"])).toBe(false);
  });

  it("treats projects with no usable dated entries as not carryover", () => {
    expect(isCarryoverFromTimeline("2026", ["", "unknown", null])).toBe(false);
    expect(getEarliestTimelineYear(["", "unknown", null])).toBeNull();
  });
});
