import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseLmsCourseInfoFile } from "@/lib/parse-lms-course-info";
import { parseLmsCourseVersionsFile } from "@/lib/parse-lms-course-versions";

function buildWorkbookFile(name: string, rows: Record<string, unknown>[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  return {
    name,
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    arrayBuffer: async () => buffer,
  } as unknown as File;
}

describe("catalog import parsers", () => {
  it("parses LMS course info rows with normalized headers", async () => {
    const file = buildWorkbookFile("info.xlsx", [
      {
        "Course ID": "C-101",
        "Published Date": "10/15/2024",
        "Content Type": "Policy",
        "Backend Hyperlink": "https://backend.example/course/101",
        "Frontend Hyperlink": "https://frontend.example/course/101",
      },
    ]);

    const rows = await parseLmsCourseInfoFile(file);

    expect(rows).toEqual([
      {
        courseId: "C-101",
        originalPublishDate: "2024-10-15",
        courseType: "Policy",
        backendUrl: "https://backend.example/course/101",
        frontendUrl: "https://frontend.example/course/101",
      },
    ]);
  });

  it("allows duplicate course IDs in versions and preserves valid versions", async () => {
    const file = buildWorkbookFile("versions.xlsx", [
      {
        "Course ID": "C-101",
        "Version": "v.2026.10.00",
        "Course Name": "Course A",
        "Update Date": "2026-10-15",
        "Update Type": "Maintenance",
        "Lesson Plan": "LP-1",
        "Special": "Special note",
        "EMS1A": "Yes",
      },
      {
        "Course ID": "C-101",
        "Version": "v.2026.11.00",
        "Course Name": "Course A",
        "Update Date": "2026-11-02",
        "Update Type": "Revamp",
        "P1A": "Yes",
      },
    ]);

    const rows = await parseLmsCourseVersionsFile(file);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.courseId)).toEqual(["C-101", "C-101"]);
    expect(rows.every((row) => row.versionValid)).toBe(true);
    expect(rows.map((row) => row.courseVersion)).toEqual(["v.2026.10.00", "v.2026.11.00"]);
    expect(rows[0].changeType).toBe("Maintenance");
    expect(rows[0].lessonPlan).toBe("LP-1");
    expect(rows[0].special).toBe("Special note");
    expect(rows[0].ems1a).toBe("Yes");
    expect(rows[1].p1a).toBe("Yes");
  });

  it("preserves vertical columns when the cell contains the vertical label itself", async () => {
    const file = buildWorkbookFile("versions-vertical-labels.xlsx", [
      {
        "Course ID": "C-505",
        "Version": "v.2026.12.00",
        "Course Name": "Course D",
        "Update Date": "2026-12-01",
        "EMS1A": "EMS1A",
        "P1A": "",
        "FR1A": "FR1A",
        "LGU": "LGU",
      },
    ]);

    const rows = await parseLmsCourseVersionsFile(file);

    expect(rows[0].ems1a).toBe("EMS1A");
    expect(rows[0].fr1a).toBe("FR1A");
    expect(rows[0].lgu).toBe("LGU");
    expect(rows[0].p1a).toBe("");
  });

  it("derives missing course version from update date using v.YYYY.MM.DD", async () => {
    const file = buildWorkbookFile("versions-derived.xlsx", [
      {
        "Course ID": "C-202",
        "Version": "",
        "Update Date": "10/15/2026",
        "Course Name": "Course B",
      },
    ]);

    const rows = await parseLmsCourseVersionsFile(file);

    expect(rows[0].courseVersion).toBe("v.2026.10.00");
    expect(rows[0].versionSource).toBe("derived");
    expect(rows[0].versionValid).toBe(true);
  });

  it("rejects rows where version cannot be provided or derived", async () => {
    const file = buildWorkbookFile("versions-invalid.xlsx", [
      {
        "Course ID": "C-303",
        "Version": "",
        "Course Name": "Course C",
      },
    ]);

    const rows = await parseLmsCourseVersionsFile(file);

    expect(rows[0].versionValid).toBe(false);
    expect(rows[0].versionError).toContain("required");
  });

  it("flags invalid version formats from the source", async () => {
    const file = buildWorkbookFile("versions-bad-format.xlsx", [
      {
        "Course ID": "C-404",
        "Version": "2026.10",
        "Update Date": "2026-10-15",
      },
    ]);

    const rows = await parseLmsCourseVersionsFile(file);

    expect(rows[0].courseVersion).toBe("2026.10");
    expect(rows[0].versionValid).toBe(false);
    expect(rows[0].versionError).toContain("v.YYYY.MM.DD");
  });
});
