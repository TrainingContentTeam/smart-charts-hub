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

  it("keeps the ID survey created timestamp and SME survey date separate", async () => {
    const file = makeWorkbookFile("SME Data Report.xlsx", [
      {
        "Course Name": "Course Alpha",
        CourseKey: "ALPHA-1",
        Year: "2026",
        "Survey Date": "3/9/26",
        Created: "03/09/2026 14:30",
        SME: "Taylor SME",
        "Instructional Designer - ID": "Alex Doe",
      },
    ]);

    const result = await parseSmeImportFile(file);

    expect(result.warnings).toEqual([]);
    expect(result.rows[0].id_survey_raw_created).toBe("03/09/2026 14:30");
    expect(result.rows[0].id_survey_created_at).toBe("2026-03-09T14:30:00");
    expect(result.rows[0].id_survey_date).toBe("2026-03-09");
    expect(result.rows[0].id_survey_date_source).toBe("Created");
    expect(result.rows[0].sme_survey_raw_date).toBe("3/9/26");
    expect(result.rows[0].sme_survey_date).toBe("2026-03-09");
    expect(result.rows[0].sme_survey_date_source).toBe("Survey Date");
  });

  it("fails invalid SME survey dates softly without reusing the ID created timestamp", async () => {
    const file = makeWorkbookFile("SME Data Report.xlsx", [
      {
        "Course Name": "Course Alpha",
        CourseKey: "ALPHA-1",
        Year: "2026",
        "Survey Date": "not a date",
        Created: "03/09/2026 14:30",
        SME: "Taylor SME",
        "Instructional Designer - ID": "Alex Doe",
      },
    ]);

    const result = await parseSmeImportFile(file);

    expect(result.rows[0].id_survey_created_at).toBe("2026-03-09T14:30:00");
    expect(result.rows[0].id_survey_date).toBe("2026-03-09");
    expect(result.rows[0].sme_survey_raw_date).toBe("not a date");
    expect(result.rows[0].sme_survey_date).toBeNull();
    expect(result.rows[0].sme_survey_date_source).toBeNull();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain("SME survey block");
    expect(result.warnings[0]).not.toContain("ID survey block");
  });
});
