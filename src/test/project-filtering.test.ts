import { describe, expect, it } from "vitest";
import {
  buildProjectFilterOptions,
  DEFAULT_PROJECT_MULTI_FILTERS,
  getNormalizedProjectFilterValue,
  matchesProjectMultiFilters,
} from "@/lib/project-filtering";

describe("project filtering helpers", () => {
  const completedProject = {
    reporting_year: " 2026 Courses ",
    status: " completed ",
    course_type: " New ",
    authoring_tool: " Rise ",
    vertical: " Fire ",
    id_assigned: "Alex Doe",
    course_length: "1 hr",
    data_source: " Modern ",
  };

  const publishedProject = {
    reporting_year: "2025",
    status: "Published",
    course_type: "Revamp",
    authoring_tool: "Storyline",
    vertical: "EMS",
    id_assigned: "Jordan Lee",
    course_length: "2 hr",
    data_source: "legacy",
  };

  it("normalizes reporting year and status values before filtering", () => {
    expect(getNormalizedProjectFilterValue(completedProject, "year")).toBe("2026");
    expect(getNormalizedProjectFilterValue(completedProject, "status")).toBe("Completed");
  });

  it("builds unique normalized options", () => {
    const options = buildProjectFilterOptions([
      completedProject,
      { ...completedProject, reporting_year: "2026", status: "Completed" },
      publishedProject,
    ]);

    expect(options.year).toEqual(["2025", "2026"]);
    expect(options.status).toEqual(["Completed", "Published"]);
    expect(options.source).toEqual(["legacy", "modern"]);
  });

  it("matches multi-select filters with OR within a field and AND across fields", () => {
    const filters = {
      ...DEFAULT_PROJECT_MULTI_FILTERS,
      year: ["2025", "2026"],
      status: ["Completed", "Published"],
      tool: ["Rise"],
    };

    expect(matchesProjectMultiFilters(completedProject, filters)).toBe(true);
    expect(matchesProjectMultiFilters(publishedProject, filters)).toBe(false);
  });

  it("treats empty selections as no restriction", () => {
    expect(matchesProjectMultiFilters(completedProject, DEFAULT_PROJECT_MULTI_FILTERS)).toBe(true);
    expect(matchesProjectMultiFilters(publishedProject, DEFAULT_PROJECT_MULTI_FILTERS)).toBe(true);
  });
});
