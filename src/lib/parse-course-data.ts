import * as XLSX from "xlsx";

export interface ParsedCourse {
  title: string;
  idAssigned: string;
  authoringTool: string;
  vertical: string;
  courseLength: string;
  courseType: string;
  courseStyle: string;
  reportingYear: string;
  interactionCount: number | null;
}

function stripHyperlink(value: any): string {
  if (!value) return "";
  const str = String(value).trim();
  // Wrike hyperlinks sometimes show as "=HYPERLINK(..., "Title")" or just the title
  const match = str.match(/=HYPERLINK\([^,]+,\s*"([^"]+)"\)/i);
  if (match) return match[1].trim();
  return str;
}

function isYearGroupingRow(title: string): boolean {
  // Skip rows like "2022 Courses (45)" or "2023 Courses"
  return /^\d{4}\s+Courses/i.test(title);
}

function findColumn(row: Record<string, any>, patterns: string[]): string {
  for (const key of Object.keys(row)) {
    const lower = key.toLowerCase().trim();
    for (const p of patterns) {
      if (lower.includes(p.toLowerCase())) return key;
    }
  }
  return "";
}

export function parseCourseDataFile(file: File): Promise<ParsedCourse[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        if (rows.length === 0) {
          resolve([]);
          return;
        }

        // Detect columns dynamically
        const sample = rows[0];
        const titleCol = findColumn(sample, ["title", "task name", "name"]);
        const assignedCol = findColumn(sample, ["id assigned", "assigned"]);
        const toolCol = findColumn(sample, ["authoring tool", "authoring"]);
        const verticalCol = findColumn(sample, ["vertical"]);
        const lengthCol = findColumn(sample, ["course length", "length"]);
        const typeCol = findColumn(sample, ["course type", "type"]);
        const styleCol = findColumn(sample, ["course style", "style"]);
        const yearCol = findColumn(sample, ["reporting year", "year"]);
        const interactionCol = findColumn(sample, ["interaction", "interactions"]);

        let currentYear = "";
        const courses: ParsedCourse[] = [];

        for (const row of rows) {
          const rawTitle = stripHyperlink(row[titleCol] || "");
          if (!rawTitle || isYearGroupingRow(rawTitle)) {
            // Check if this row itself declares a reporting year
            const possibleYear = rawTitle || String(row[yearCol] || "");
            if (/\d{4}/.test(possibleYear)) {
              currentYear = possibleYear.trim();
            }
            continue;
          }

          const interactionRaw = row[interactionCol];
          const interactionCount = interactionRaw ? parseInt(String(interactionRaw), 10) : null;

          courses.push({
            title: rawTitle,
            idAssigned: String(row[assignedCol] || "").trim(),
            authoringTool: String(row[toolCol] || "").trim(),
            vertical: String(row[verticalCol] || "").trim(),
            courseLength: String(row[lengthCol] || "").trim(),
            courseType: String(row[typeCol] || "").trim(),
            courseStyle: String(row[styleCol] || "").trim(),
            reportingYear: String(row[yearCol] || currentYear || "").trim(),
            interactionCount: isNaN(interactionCount as number) ? null : interactionCount,
          });
        }

        resolve(courses);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}
