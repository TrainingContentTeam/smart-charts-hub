import * as XLSX from "xlsx";

export interface TimeSpentEntry {
  courseName: string;
  category: string;
  date: string; // ISO date string
  hours: number;
  userName: string;
}

function parseHHMM(raw: string): number {
  if (!raw) return 0;
  const str = String(raw).trim();
  const match = str.match(/^(\d+):(\d{2})$/);
  if (match) return parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function normalize(s: string | undefined | null): string {
  return (s || "").trim().replace(/\s+/g, " ");
}

function parseDate(raw: string): string {
  if (!raw) return "";
  const str = String(raw).trim();
  // Try M/D/YYYY format
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, m, d, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // Try ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  // Excel serial number
  const num = parseFloat(str);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const d = new Date((num - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return str;
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
      hours: parseHHMM(row["Time spent"]),
      userName: normalize(row["User"]),
    });
  }

  return results;
}
