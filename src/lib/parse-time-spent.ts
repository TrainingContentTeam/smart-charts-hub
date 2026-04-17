import * as XLSX from "xlsx";
import { parseDurationHours } from "@/lib/parse-duration";
import { parseUploadDate } from "@/lib/analytics/parse-upload-date";

export interface TimeSpentEntry {
  courseName: string;
  category: string;
  date: string; // ISO date string
  hours: number;
  userName: string;
}

function normalize(s: string | undefined | null): string {
  return (s || "").trim().replace(/\s+/g, " ");
}

function parseDate(raw: unknown): string {
  return parseUploadDate(raw) ?? "";
}

export async function parseTimeSpentFile(file: File): Promise<TimeSpentEntry[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const results: TimeSpentEntry[] = [];

  for (const row of rows) {
    // Handle the typo "Cousre name" in the source CSV
    const courseName = normalize(row["Cousre name"] || row["Course name"] || row["Course Name"]);
    if (!courseName) continue;

    results.push({
      courseName,
      category: normalize(row["Category"]),
      date: parseDate(row["Date"]),
      hours: parseDurationHours(row["Time spent"]),
      userName: normalize(row["User"]),
    });
  }

  return results;
}
