import * as XLSX from "xlsx";
import { parseDurationHours, toReportingYear } from "@/lib/parse-duration";

export interface ModernCourse {
  courseName: string;
  totalHours: number; // authoritative course total from the Modern export
  status: string;
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
      totalHours: parseDurationHours(row["Time spent"]),
      status: normalize(row["Status"] || row["[LCT] Status (M)"]),
      reportingYear: toReportingYear(row["[LCT] Reporting (M)"]),
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
