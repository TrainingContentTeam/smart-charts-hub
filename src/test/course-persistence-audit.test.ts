import { describe, expect, it } from "vitest";
import {
  buildCoursePersistenceAuditRows,
  type CoursePersistenceInputRow,
} from "@/lib/course-persistence-audit";

function makeRow(overrides: Partial<CoursePersistenceInputRow> = {}): CoursePersistenceInputRow {
  return {
    key: "course-a::2026",
    courseName: "Course A",
    year: "2026",
    rawYear: "2026",
    source: "modern",
    rawStatus: "Published",
    isComplete: true,
    ...overrides,
  };
}

describe("buildCoursePersistenceAuditRows", () => {
  it("marks matched upload and persisted rows as persisted", () => {
    const rows = buildCoursePersistenceAuditRows([makeRow()], [makeRow()]);

    expect(rows).toHaveLength(1);
    expect(rows[0].reason).toBe("Persisted");
    expect(rows[0].persisted).toBe(true);
  });

  it("flags upload rows missing from persisted projects", () => {
    const rows = buildCoursePersistenceAuditRows([makeRow()], []);

    expect(rows[0].reason).toBe("Missing from persisted projects");
    expect(rows[0].persisted).toBe(false);
  });

  it("flags extra persisted rows as stale deletions on import", () => {
    const rows = buildCoursePersistenceAuditRows([], [makeRow()]);

    expect(rows[0].reason).toBe("Will be deleted as stale on import");
    expect(rows[0].persisted).toBe(true);
  });

  it("flags duplicate upload rows that collapse to the same course key", () => {
    const duplicate = makeRow({ rawStatus: "Ready for Loading" });
    const rows = buildCoursePersistenceAuditRows([makeRow(), duplicate], [makeRow()]);

    expect(rows[0].reason).toBe("Duplicate course key collision");
    expect(rows[0].uploadRowCount).toBe(2);
  });

  it("flags blank reporting years explicitly", () => {
    const rows = buildCoursePersistenceAuditRows(
      [makeRow({ key: "course-a::", year: "Unknown", rawYear: "" })],
      [],
    );

    expect(rows[0].reason).toBe("Missing reporting year");
  });

  it("flags raw status mismatches when upload and persisted rows disagree", () => {
    const rows = buildCoursePersistenceAuditRows(
      [makeRow({ rawStatus: "Published", isComplete: true })],
      [makeRow({ rawStatus: "Ready for Loading", isComplete: true })],
    );

    expect(rows[0].reason).toBe("Raw status mismatch");
  });
});
