import * as XLSX from "xlsx";
import { parseDurationHours } from "@/lib/parse-duration";

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
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 30000 && raw < 60000) {
    const d = new Date((raw - 25569) * 86400 * 1000);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  if (raw == null) return "";
  const str = String(raw).trim();
  if (!str) return "";

  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);

  // M/D/YYYY
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T].*)?$/);
  if (match) {
    const [, m, d, y] = match;
    const mm = Number(m), dd = Number(d), yy = Number(y);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31 && yy >= 1900 && yy <= 2100) {
      return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    }
    return "";
  }

  // Excel serial as string (integer or decimal)
  if (/^\d{4,6}(?:\.\d+)?$/.test(str)) {
    const num = Number(str);
    if (Number.isFinite(num) && num > 30000 && num < 60000) {
      const d = new Date((num - 25569) * 86400 * 1000);
      return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
    }
    return "";
  }

  return "";
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
