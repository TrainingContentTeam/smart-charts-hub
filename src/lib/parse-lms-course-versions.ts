import * as XLSX from "xlsx";
import {
  deriveCourseVersionFromDate,
  isValidCourseVersion,
  normalizeCatalogText,
  parseCatalogDate,
  parseCatalogInteger,
  pickCatalogCell,
} from "@/lib/parse-catalog-date";

export interface LmsCourseVersionImport {
  courseId: string;
  courseVersion: string;
  versionSource: "provided" | "derived";
  versionValid: boolean;
  versionError: string | null;
  courseName: string;
  authoringTool: string;
  courseDescription: string;
  durationMinutes: number | null;
  publishedDate: string | null;
  changeType: string;
  lessonPlan: string;
  special: string;
  ems1a: string;
  p1a: string;
  fr1a: string;
  c1a: string;
  lgu: string;
  d1a: string;
  revampDate: string | null;
}

export async function parseLmsCourseVersionsFile(file: File): Promise<LmsCourseVersionImport[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const results: LmsCourseVersionImport[] = [];

  for (const row of rows) {
    const courseId = normalizeCatalogText(
      pickCatalogCell(row, ["Course ID", "course_id", "CourseId", "Course Id", "ID"]),
    );
    if (!courseId) continue;

    const publishedDate = parseCatalogDate(
      pickCatalogCell(row, ["Update Date", "Published Date", "published_date", "update_date", "Updated Date"]),
    );
    const rawCourseVersion = normalizeCatalogText(
      pickCatalogCell(row, ["Version", "Course Version", "course_version"]),
    );
    const derivedVersion = rawCourseVersion ? null : deriveCourseVersionFromDate(publishedDate);
    const courseVersion = rawCourseVersion || derivedVersion || "";
    const versionSource = rawCourseVersion ? "provided" : "derived";
    const versionValid = !!courseVersion && isValidCourseVersion(courseVersion);
    const versionError = courseVersion
      ? versionValid
        ? null
        : "Version must use the format v.YYYY.MM.DD"
      : "Version is required or must be derivable from the update date";

    results.push({
      courseId,
      courseVersion,
      versionSource,
      versionValid,
      versionError,
      courseName: normalizeCatalogText(pickCatalogCell(row, ["Course Name", "course_name", "Name"])),
      authoringTool: normalizeCatalogText(pickCatalogCell(row, ["Authoring Tool", "authoring_tool"])),
      courseDescription: normalizeCatalogText(
        pickCatalogCell(row, ["Course Description", "course_description", "Description"]),
      ),
      durationMinutes: parseCatalogInteger(pickCatalogCell(row, ["Duration", "Duration Minutes", "duration_minutes"])),
      publishedDate,
      changeType: normalizeCatalogText(
        pickCatalogCell(row, ["Update Type", "Change Type", "change_type", "Version Type", "Course Change Type"]),
      ),
      lessonPlan: normalizeCatalogText(pickCatalogCell(row, ["Lesson Plan", "lesson_plan"])),
      special: normalizeCatalogText(pickCatalogCell(row, ["Special", "special"])),
      ems1a: normalizeCatalogText(pickCatalogCell(row, ["EMS1A", "ems1a"])),
      p1a: normalizeCatalogText(pickCatalogCell(row, ["P1A", "p1a"])),
      fr1a: normalizeCatalogText(pickCatalogCell(row, ["FR1A", "fr1a"])),
      c1a: normalizeCatalogText(pickCatalogCell(row, ["C1A", "c1a"])),
      lgu: normalizeCatalogText(pickCatalogCell(row, ["LGU", "lgu"])),
      d1a: normalizeCatalogText(pickCatalogCell(row, ["D1A", "d1a"])),
      revampDate: parseCatalogDate(pickCatalogCell(row, ["Revamp Date", "revamp_date"])),
    });
  }

  return results;
}
