import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseTimeSpentFile } from "@/lib/parse-time-spent";

function makeFile(rows: Record<string, unknown>[]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Sheet1");
  const buffer = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return {
    name: "time-spent.xlsx",
    arrayBuffer: async () => buffer,
  } as File;
}

describe("parseTimeSpentFile", () => {
  it("parses time-log dates and durations with the approved file semantics", async () => {
    const file = makeFile([
      {
        "Cousre name": "Course Alpha",
        Category: "LP Development LC",
        Date: "10/18/23",
        "Time Spent": "01:30",
        User: "Alex Doe",
      },
    ]);

    const [row] = await parseTimeSpentFile(file);

    expect(row.rawDate).toBe("10/18/23");
    expect(row.date).toBe("2023-10-18");
    expect(row.rawTimeSpent).toBe("01:30");
    expect(row.minutes).toBe(90);
    expect(row.hours).toBe(1.5);
  });

  it("fails invalid values softly instead of inferring timestamps", async () => {
    const file = makeFile([
      {
        "Cousre name": "Course Alpha",
        Category: "LP Development LC",
        Date: "2026-03-09",
        "Time Spent": "2026-03-09T14:30:00Z",
        User: "Alex Doe",
      },
    ]);

    const [row] = await parseTimeSpentFile(file);

    expect(row.date).toBeNull();
    expect(row.minutes).toBeNull();
    expect(row.hours).toBeNull();
  });
});
