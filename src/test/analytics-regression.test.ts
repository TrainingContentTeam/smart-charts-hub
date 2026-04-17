import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  parseLegacyProjectImportFile,
  parseModernProjectImportFile,
  parseSmeImportFile,
  parseTimeLogImportFile,
} from "@/lib/analytics/source-readers";
import { buildAnalyticsSnapshot } from "@/lib/analytics/snapshot";
import type { AnalyticsPersistenceBundle } from "@/lib/analytics/types";

const regressionDir = path.resolve(process.cwd(), "test-fixtures", "regression");
const fixtureNames = {
  legacy: "Legacy Course Data for Export (2).csv",
  modern: "Modern Course Data for Export (2).csv",
  time: "Time Spent Category Data Export (2).csv",
  sme: "SME Data Report for Export.csv",
} as const;

function fixturePath(fileName: string) {
  return path.join(regressionDir, fileName);
}

function makeFile(filePath: string) {
  const buffer = fs.readFileSync(filePath);
  return new File([buffer], path.basename(filePath));
}

const fixturesAvailable = Object.values(fixtureNames).every((fileName) => fs.existsSync(fixturePath(fileName)));

describe("canonical analytics regression fixtures", () => {
  (fixturesAvailable ? it : it.skip)("matches the expected counts for the current uploaded CSV exports", async () => {
    const legacy = await parseLegacyProjectImportFile(makeFile(fixturePath(fixtureNames.legacy)));
    const modern = await parseModernProjectImportFile(makeFile(fixturePath(fixtureNames.modern)));
    const timeLogs = await parseTimeLogImportFile(makeFile(fixturePath(fixtureNames.time)));
    const sme = await parseSmeImportFile(makeFile(fixturePath(fixtureNames.sme)));

    const bundle: AnalyticsPersistenceBundle = {
      uploadHistory: [],
      rawProjectImportRows: [...legacy.rows, ...modern.rows].map((row, index) => ({
        id: `project-${index}`,
        upload_id: null,
        user_id: null,
        created_at: "2026-04-17T00:00:00.000Z",
        ...row,
      })),
      rawTimeLogRows: timeLogs.rows.map((row, index) => ({
        id: `time-${index}`,
        upload_id: null,
        user_id: null,
        created_at: "2026-04-17T00:00:00.000Z",
        ...row,
      })),
      rawSmeFeedbackRows: sme.rows.map((row, index) => ({
        id: `sme-${index}`,
        upload_id: null,
        user_id: null,
        created_at: "2026-04-17T00:00:00.000Z",
        ...row,
      })),
      courseAliasConfig: [],
      personAliasConfig: [],
      personRoleConfig: [],
      smeManualJoinOverrides: [],
      workEntityDecisions: [],
    };

    const snapshot = buildAnalyticsSnapshot(bundle);
    const autoJoinableSme = snapshot.smeJoinAudit.filter((row) => row.join_status === "matched").length;
    const unresolvedSme = snapshot.smeJoinAudit.filter((row) => row.join_status !== "matched").length;
    const timeDates = snapshot.timeLogs.map((row) => row.log_date).filter((value): value is string => !!value).sort();

    expect(legacy.rows).toHaveLength(427);
    expect(modern.rows).toHaveLength(142);
    expect(snapshot.projectsRawUnion).toHaveLength(569);
    expect(snapshot.canonicalProjects).toHaveLength(568);
    expect(snapshot.canonicalProjects.filter((project) => !["Completed", "Published", "Cancelled"].includes(project.status))).toHaveLength(157);
    expect(snapshot.projectDuplicateAudit).toHaveLength(1);
    expect(snapshot.timeLogs).toHaveLength(11020);
    expect(timeDates[0]).toBe("2023-09-28");
    expect(timeDates[timeDates.length - 1]).toBe("2026-04-16");
    expect(snapshot.smeJoinAudit).toHaveLength(40);
    expect(autoJoinableSme).toBe(33);
    expect(unresolvedSme).toBe(7);
  });
});
