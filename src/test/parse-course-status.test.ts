import { describe, expect, it } from "vitest";
import { pickPreferredCourseStatus } from "@/lib/parse-course-status";
import { normalizeProjectStatus } from "@/lib/project-status";

describe("pickPreferredCourseStatus", () => {
  it("prefers the LCT status column over generic Status", () => {
    const row = {
      Status: "Ready for Loading",
      "[LCT] Status (M)": "**Published**",
    };

    expect(pickPreferredCourseStatus(row, "[LCT] Status (M)")).toBe("**Published**");
  });

  it("returns blank when the LCT column is missing, even if generic Status exists", () => {
    const row = {
      Status: "Ready to Publish",
    };

    expect(pickPreferredCourseStatus(row, "[LCT] Status (M)")).toBe("");
  });

  it("returns blank when only another status-like column exists", () => {
    const row = {
      "Workflow Status": "In Review",
    };

    expect(pickPreferredCourseStatus(row, "[LCT] Status (L)")).toBe("");
  });
});

describe("normalizeProjectStatus", () => {
  it("normalizes markdown-styled finalized statuses", () => {
    expect(normalizeProjectStatus("**Published**")).toBe("Published");
  });
});
