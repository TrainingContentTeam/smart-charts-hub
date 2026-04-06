import * as XLSX from "xlsx";
import { normalizeCatalogText, parseCatalogDate, pickCatalogCell } from "@/lib/parse-catalog-date";

export interface LmsCourseInfoImport {
  courseId: string;
  originalPublishDate: string | null;
  courseType: string;
  backendUrl: string;
  frontendUrl: string;
}

export async function parseLmsCourseInfoFile(file: File): Promise<LmsCourseInfoImport[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const results: LmsCourseInfoImport[] = [];

  for (const row of rows) {
    const courseId = normalizeCatalogText(
      pickCatalogCell(row, ["Course ID", "course_id", "CourseId", "Course Id", "ID"]),
    );
    if (!courseId) continue;

    results.push({
      courseId,
      originalPublishDate: parseCatalogDate(
        pickCatalogCell(row, ["Published Date", "Original Publish Date", "original_publish_date", "Publish Date"]),
      ),
      courseType: normalizeCatalogText(pickCatalogCell(row, ["Content Type", "Course Type", "course_type", "Type"])),
      backendUrl: normalizeCatalogText(pickCatalogCell(row, ["Backend Hyperlink", "Backend URL", "backend_url", "Backend Url"])),
      frontendUrl: normalizeCatalogText(pickCatalogCell(row, ["Frontend Hyperlink", "Frontend URL", "frontend_url", "Frontend Url"])),
    });
  }

  return results;
}
