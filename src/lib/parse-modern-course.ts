import * as XLSX from "xlsx";

export interface ModernCourse {
  courseName: string;
  totalHours: number; // from CSV but NOT authoritative — use Time Spent aggregation
  reportingYear: string;
  idAssigned: string;
  sme: string;
  legalReviewer: string;
  vertical: string;
  courseType: string;
  authoringTool: string;
  courseStyle: string;
  courseLength: string;
  interactionCount: number | null;
}

function parseHHMM(raw: string): number {
  if (!raw) return 0;
  const str = String(raw).trim();
  const match = str.match(/^(\d+):(\d{2})$/);
  if (match) return parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function extractYear(reporting: string): string {
  if (!reporting) return "";
  return String(reporting).replace(/\s*Courses\s*$/i, "").trim();
}

function normalize(s: string | undefined | null): string {
  return (s || "").trim().replace(/\s+/g, " ");
}

export async function parseModernCourseFile(file: File): Promise<ModernCourse[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const results: ModernCourse[] = [];

  for (const row of rows) {
    const courseName = normalize(row["Course Name"]);
    if (!courseName || courseName.toLowerCase().startsWith("total:")) continue;

    results.push({
      courseName,
      totalHours: parseHHMM(row["Time spent"]),
      reportingYear: extractYear(row["[LCT] Reporting (M)"]),
      idAssigned: normalize(row["[LCT] ID Assigned (M)"]),
      sme: normalize(row["[LCT] SME (M)"]),
      legalReviewer: normalize(row["[LCT] Legal Reviewer (M)"]),
      vertical: normalize(row["[LCT] Vertical (M)"]),
      courseType: normalize(row["[LCT] Course Type (M)"]),
      authoringTool: normalize(row["[LCT] Authoring Tool (M)"]),
      courseStyle: normalize(row["[LCT] Course Style (M)"]),
      courseLength: normalize(row["[LCT] Course Length (M)"]),
      interactionCount: row["[LCT] Interaction Count (M)"]
        ? parseInt(String(row["[LCT] Interaction Count (M)"]), 10) || null
        : null,
    });
  }

  return results;
}
