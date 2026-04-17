import * as XLSX from "xlsx";
import {
  parseApprovedDurationHoursMinutes,
  parseApprovedUsShortDate,
} from "@/lib/analytics/field-parsers";

export interface TimeSpentEntry {
  courseName: string;
  category: string;
  rawDate: string;
  date: string | null;
  rawTimeSpent: string;
  minutes: number | null;
  hours: number | null;
  userName: string;
}

function normalize(s: string | undefined | null): string {
  return (s || "").trim().replace(/\s+/g, " ");
}

function rawText(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

export async function parseTimeSpentFile(file: File): Promise<TimeSpentEntry[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", raw: false, cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false, blankrows: false });

  const results: TimeSpentEntry[] = [];

  for (const row of rows) {
    // Handle the typo "Cousre name" in the source CSV
    const courseName = normalize(row["Cousre name"] || row["Course name"] || row["Course Name"]);
    if (!courseName) continue;
    const rawDate = rawText(row["Date"]);
    const rawTimeSpent = rawText(row["Time Spent"] || row["Time spent"]);
    const minutes = parseApprovedDurationHoursMinutes(rawTimeSpent);

    results.push({
      courseName,
      category: normalize(row["Category"]),
      rawDate,
      date: parseApprovedUsShortDate(rawDate),
      rawTimeSpent,
      minutes,
      hours: minutes === null ? null : minutes / 60,
      userName: normalize(row["User"]),
    });
  }

  return results;
}
