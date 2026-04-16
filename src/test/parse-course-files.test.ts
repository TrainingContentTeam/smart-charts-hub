import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseLegacyCourseFile } from "@/lib/parse-legacy-course";
import { parseModernCourseFile } from "@/lib/parse-modern-course";

function makeFile(rows: Record<string, unknown>[]) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return {
    name: "courses.xlsx",
    arrayBuffer: async () => buffer,
  } as File;
}

describe("course file parsers", () => {
  it("prefers the modern LCT status when both modern and generic statuses exist", async () => {
    const file = makeFile([
      {
        "Course Name": "Child Safety Check Alert List (TCOLE 4068)",
        "Time spent": "2:00",
        "Status": "Ready for Loading",
        "[LCT] Status (M)": "**Published**",
        "[LCT] Reporting (M)": "2026 Courses",
      },
    ]);

    const [row] = await parseModernCourseFile(file);

    expect(row.status).toBe("**Published**");
    expect(row.reportingYear).toBe("2026");
  });

  it("prefers the legacy LCT status when both legacy and generic statuses exist", async () => {
    const file = makeFile([
      {
        "Course Name": "Legacy Course",
        "Time spent": "1:30",
        "Status": "Ready for Loading",
        "[LCT] Status (L)": "Published",
        "[LCT] Reporting (L)": "2025 Courses",
      },
    ]);

    const [row] = await parseLegacyCourseFile(file);

    expect(row.status).toBe("Published");
    expect(row.reportingYear).toBe("2025");
  });

  it("uses generic Status when no LCT status column is present", async () => {
    const file = makeFile([
      {
        "Course Name": "Generic Status Course",
        "Time spent": "0:45",
        "Status": "Ready to Publish",
        "[LCT] Reporting (M)": "2026",
      },
    ]);

    const [row] = await parseModernCourseFile(file);

    expect(row.status).toBe("");
  });
});
