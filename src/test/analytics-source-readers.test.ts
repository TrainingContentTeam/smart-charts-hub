import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseSmeImportFile, parseTimeLogImportFile } from "@/lib/analytics/source-readers";

function makeWorkbookFile(name: string, rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return {
    name,
    arrayBuffer: async () => buffer,
  } as File;
}

describe("analytics source readers", () => {
  it("parses time-log entry dates and durations using approved file-specific rules", async () => {
    const file = makeWorkbookFile("Time Spent Category Data Export.xlsx", [
      {
        "Cousre name": "Course Alpha",
        Category: "LP Development LC",
        Date: "10/18/23",
        "Time Spent": "01:15",
        User: "Alex Doe",
      },
      {
        "Cousre name": "Course Beta",
        Category: "Testing LC",
        Date: "3/9/26",
        "Time Spent": "00:05",
        User: "Sam Roe",
      },
    ]);

    const result = await parseTimeLogImportFile(file);

    expect(result.warnings).toEqual([]);
    expect(result.rows[0].raw_date).toBe("10/18/23");
    expect(result.rows[0].log_date).toBe("2023-10-18");
    expect(result.rows[0].raw_time_spent).toBe("01:15");
    expect(result.rows[0].minutes).toBe(75);
    expect(result.rows[1].log_date).toBe("2026-03-09");
    expect(result.rows[1].minutes).toBe(5);
  });

  it("preserves invalid time-log raw values and emits targeted warnings only for the bad fields", async () => {
    const file = makeWorkbookFile("Time Spent Category Data Export.xlsx", [
      {
        "Cousre name": "Course Alpha",
        Category: "LP Development LC",
        Date: "2026-03-09",
        "Time Spent": "1.25 hours",
        User: "Alex Doe",
      },
    ]);

    const result = await parseTimeLogImportFile(file);

    expect(result.rows[0].raw_date).toBe("2026-03-09");
    expect(result.rows[0].log_date).toBeNull();
    expect(result.rows[0].raw_time_spent).toBe("1.25 hours");
    expect(result.rows[0].minutes).toBeNull();
    expect(result.warnings).toHaveLength(2);
    expect(result.warnings[0]).toContain('column "Date"');
    expect(result.warnings[1]).toContain('column "Time Spent"');
  });

  it("parses the SME survey date as the canonical date and ignores any legacy Created column", async () => {
    const file = makeWorkbookFile("SME Data Report.xlsx", [
      {
        "Course Name": "Course Alpha",
        CourseKey: "ALPHA-1",
        Year: "2026",
        "Survey Date": "3/9/26",
        SME: "Taylor SME",
        "Instructional Designer - ID": "Alex Doe",
      },
    ]);

    const result = await parseSmeImportFile(file);

    expect(result.warnings).toEqual([]);
    expect(result.rows[0].survey_date).toBe("2026-03-09");
    expect(result.rows[0].instructional_designer_raw).toBe("Alex Doe");
  });

  it("sets survey_date to null and emits a single targeted warning for an unparseable Survey Date", async () => {
    const file = makeWorkbookFile("SME Data Report.xlsx", [
      {
        "Course Name": "Course Alpha",
        CourseKey: "ALPHA-1",
        Year: "2026",
        "Survey Date": "not a date",
        SME: "Taylor SME",
        "Instructional Designer - ID": "Alex Doe",
      },
    ]);

    const result = await parseSmeImportFile(file);

    expect(result.rows[0].survey_date).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('column "Survey Date"');
  });
});
