import * as XLSX from "xlsx";

export interface SmeCollaborationSurveyImport {
  courseKeyRaw: string;
  courseName: string;
  reportingYear: string;
  hoursWorked: number;
  amountBilled: number;
  effectiveHourlyRate: number | null;
  surveyDate: string;
  sme: string;
  smeEmail: string;
  smeOverallExperienceScore: number | null;
  clarityGoalsScore: number | null;
  staffResponsivenessScore: number | null;
  toolsResourcesScore: number | null;
  trainingSupportScore: number | null;
  useExpertiseScore: number | null;
  incorporationFeedbackScore: number | null;
  autonomyCourseDesignScore: number | null;
  feelingValuedScore: number | null;
  recommendLexipolScore: number | null;
  additionalFeedbackSme: string;
  instructionalDesigner: string;
  idOverallCollaborationScore: number | null;
  idSmeKnowledgeScore: number | null;
  idResponsivenessScore: number | null;
  idInstructionalDesignKnowledgeScore: number | null;
  idContributionDevelopmentScore: number | null;
  idOpennessFeedbackScore: number | null;
  idDeadlinesScheduleScore: number | null;
  idOverallQualityScore: number | null;
  idAssistanceInteractionsScore: number | null;
  idRealworldExamplesIncluded: boolean | null;
  idSmePromoterScore: number | null;
  additionalCommentsId: string;
  sourceCreatedAt: string;
  sourceRow: Record<string, unknown>;
}

function normalize(value: unknown): string {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeKey(value: string): string {
  return normalize(value).toLowerCase();
}

function buildLookup(row: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeKey(key), value])
  );
}

function getCell(row: Record<string, unknown>, lookup: Record<string, unknown>, header: string): unknown {
  if (header in row) return row[header];
  return lookup[normalizeKey(header)] ?? "";
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = normalize(value);
  if (!raw) return null;
  const cleaned = raw.replace(/[$,%\s,]/g, "");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseBoundedInteger(value: unknown, min: number, max: number): number | null {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  const rounded = Math.round(parsed);
  return rounded >= min && rounded <= max ? rounded : null;
}

function parseLikertScore(value: unknown): number | null {
  const raw = normalize(value);
  if (!raw) return null;

  const numeric = parseBoundedInteger(raw, 1, 5);
  if (numeric !== null) return numeric;

  const map: Record<string, number> = {
    "strongly agree": 5,
    agree: 4,
    neutral: 3,
    disagree: 2,
    "strongly disagree": 1,
  };

  return map[raw.toLowerCase()] ?? null;
}

function parseBooleanLike(value: unknown): boolean | null {
  const raw = normalize(value).toLowerCase();
  if (!raw) return null;
  if (["yes", "y", "true", "1"].includes(raw)) return true;
  if (["no", "n", "false", "0"].includes(raw)) return false;
  return null;
}

function toIsoDate(value: unknown): string {
  if (typeof value === "number" && value > 30000 && value < 60000) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
  }

  const raw = normalize(value);
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);

  const shortDate = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (shortDate) {
    const [, month, day, year] = shortDate;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

function toIsoDateTime(value: unknown): string {
  if (typeof value === "number" && value > 30000 && value < 60000) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  const raw = normalize(value);
  if (!raw) return "";

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
}

function toYear(value: unknown): string {
  const raw = normalize(value);
  const match = raw.match(/(20\d{2}|\d{4})/);
  return match ? match[1] : raw;
}

export async function parseSmeSurveyFile(file: File): Promise<SmeCollaborationSurveyImport[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const results: SmeCollaborationSurveyImport[] = [];

  for (const row of rows) {
    const lookup = buildLookup(row);
    const courseName = normalize(getCell(row, lookup, "Course Name"));
    if (!courseName) continue;

    const reportingYear = toYear(getCell(row, lookup, "Year"));
    const hoursWorked = parseNumber(getCell(row, lookup, "Hours Worked")) ?? 0;
    const amountBilled = parseNumber(getCell(row, lookup, "Amount Billed")) ?? 0;

    results.push({
      courseKeyRaw: normalize(getCell(row, lookup, "CourseKey")),
      courseName,
      reportingYear,
      hoursWorked,
      amountBilled,
      effectiveHourlyRate: hoursWorked > 0 ? Math.round((amountBilled / hoursWorked) * 100) / 100 : null,
      surveyDate: toIsoDate(getCell(row, lookup, "Survey Date")),
      sme: normalize(getCell(row, lookup, "SME")),
      smeEmail: normalize(getCell(row, lookup, "SME Email")).toLowerCase(),
      smeOverallExperienceScore: parseLikertScore(getCell(row, lookup, "Overall Experience with Lexipol")),
      clarityGoalsScore: parseLikertScore(getCell(row, lookup, "Clarity of Goals and Objectives")),
      staffResponsivenessScore: parseLikertScore(getCell(row, lookup, "Staff Responsiveness")),
      toolsResourcesScore: parseLikertScore(getCell(row, lookup, "Adequacy of Tools and Resources")),
      trainingSupportScore: parseLikertScore(getCell(row, lookup, "Training and Support Provided")),
      useExpertiseScore: parseLikertScore(getCell(row, lookup, "Use of My Expertise")),
      incorporationFeedbackScore: parseLikertScore(getCell(row, lookup, "Incorporation of My Feedback")),
      autonomyCourseDesignScore: parseLikertScore(getCell(row, lookup, "Autonomy in Course Design")),
      feelingValuedScore: parseLikertScore(getCell(row, lookup, "Feeling Valued as an SME")),
      recommendLexipolScore: parseLikertScore(getCell(row, lookup, "Likelihood to Recommend Lexipol")),
      additionalFeedbackSme: String(getCell(row, lookup, "Additional Feedback or Suggestions") || "").trim(),
      instructionalDesigner: normalize(getCell(row, lookup, "Instructional Designer - ID")),
      idOverallCollaborationScore: parseBoundedInteger(getCell(row, lookup, "Overall Rating of SME Collaboration - ID"), 1, 5),
      idSmeKnowledgeScore: parseBoundedInteger(getCell(row, lookup, "SME's knowledge and expertise - ID"), 1, 5),
      idResponsivenessScore: parseBoundedInteger(getCell(row, lookup, "Responsiveness - ID"), 1, 5),
      idInstructionalDesignKnowledgeScore: parseBoundedInteger(getCell(row, lookup, "Instructional design knowledge - ID"), 1, 5),
      idContributionDevelopmentScore: parseBoundedInteger(getCell(row, lookup, "Contribution to development - ID"), 1, 5),
      idOpennessFeedbackScore: parseBoundedInteger(getCell(row, lookup, "Openness suggestions and feedback - ID"), 1, 5),
      idDeadlinesScheduleScore: parseBoundedInteger(getCell(row, lookup, "Deadlines and schedule - ID"), 1, 5),
      idOverallQualityScore: parseBoundedInteger(getCell(row, lookup, "Overall quality end product - ID"), 1, 5),
      idAssistanceInteractionsScore: parseBoundedInteger(getCell(row, lookup, "SME assistance in interactions - ID"), 1, 5),
      idRealworldExamplesIncluded: parseBooleanLike(getCell(row, lookup, "Realworld examples - ID")),
      idSmePromoterScore: parseBoundedInteger(getCell(row, lookup, "SME Promoter Score - ID"), 1, 10),
      additionalCommentsId: String(getCell(row, lookup, "Additional Comments - ID") || "").trim(),
      sourceCreatedAt: toIsoDateTime(getCell(row, lookup, "Created")),
      sourceRow: row,
    });
  }

  return results;
}
