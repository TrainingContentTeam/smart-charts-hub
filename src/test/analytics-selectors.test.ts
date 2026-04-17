import { describe, expect, it } from "vitest";
import { buildAnalyticsSnapshot } from "@/lib/analytics/snapshot";
import {
  selectDashboardModel,
  selectDevelopmentModel,
  selectGroupedReconciliationModel,
  selectProjectDetailModel,
  selectSmeCollaborationModel,
} from "@/lib/analytics/selectors";
import type { AnalyticsPersistenceBundle, RawProjectImportRow, RawTimeLogRow } from "@/lib/analytics/types";
import { createUiSnapshot } from "@/test/fixtures/analytics-ui-fixture";

function bundleWithRows(rows: {
  projects: RawProjectImportRow[];
  timeLogs: RawTimeLogRow[];
}): AnalyticsPersistenceBundle {
  return {
    uploadHistory: [],
    rawProjectImportRows: rows.projects,
    rawTimeLogRows: rows.timeLogs,
    rawSmeFeedbackRows: [],
    courseAliasConfig: [],
    personAliasConfig: [],
    personRoleConfig: [],
    smeManualJoinOverrides: [],
    workEntityDecisions: [],
  };
}

function project(id: string, status: string, minutes: number, year = "2026"): RawProjectImportRow {
  return {
    id,
    upload_id: null,
    user_id: null,
    source_dataset: "legacy",
    source_file_name: "legacy.csv",
    row_number: 1,
    raw_row: {},
    raw_course_name: `Project ${id}`,
    normalized_course_name: `Project ${id}`,
    compact_course_name: `project${id.toLowerCase()}`,
    reporting_label: `${year} Courses`,
    reporting_year: year,
    raw_status: status,
    raw_time_spent: "2:00",
    project_total_minutes: minutes,
    id_assigned_raw: "Alex Doe",
    sme_assigned_raw: "Taylor SME",
    legal_reviewer_raw: "",
    vertical_raw: "Fire",
    course_type: "New",
    authoring_tool: "Rise",
    course_style: "Scenario",
    course_length_raw: "1 hr",
    interaction_count: 4,
    parse_warnings: [],
    created_at: "2026-04-17T00:00:00.000Z",
  };
}

function timeLog(id: string, courseName: string, category: string, minutes: number | null, date = "2026-04-10"): RawTimeLogRow {
  return {
    id,
    upload_id: null,
    user_id: null,
    source_file_name: "time.csv",
    row_number: 1,
    raw_row: {},
    raw_course_name: courseName,
    normalized_course_name: courseName,
    compact_course_name: "",
    raw_category: category,
    raw_date: date,
    log_date: date,
    raw_time_spent: "1:00",
    minutes,
    raw_user: "Alex Doe",
    parse_warnings: [],
    created_at: "2026-04-17T00:00:00.000Z",
  };
}

describe("analytics selectors", () => {
  it("keeps dashboard project hours and logged hours distinct while counting active projects from status only", () => {
    const snapshot = buildAnalyticsSnapshot(bundleWithRows({
      projects: [
        project("A", "LP Development", 180),
        project("B", "**Published**", 120),
      ],
      timeLogs: [
        timeLog("1", "Project A", "LP Development LC", 90),
        timeLog("2", "Project B", "Testing LC", 30),
      ],
    }));

    const model = selectDashboardModel(snapshot);

    expect(model.cards.totalProjectHours).toBe(5);
    expect(model.cards.totalLoggedHours).toBe(2);
    expect(model.cards.activeProjects).toBe(1);
    expect(model.activeProjectsByStatus).toEqual([{ status: "LP Development", count: 1 }]);
    expect(model.hoursByTimeLogPhase.find((row) => row.phase === "Planning")?.hours).toBe(1.5);
  });

  it("limits development metrics to active canonical projects and matched development logs", () => {
    const snapshot = buildAnalyticsSnapshot(bundleWithRows({
      projects: [
        project("A", "LP Development", 180),
        project("B", "Completed", 120),
      ],
      timeLogs: [
        timeLog("1", "Project A", "LP Development LC", 90),
        timeLog("2", "Project B", "Testing LC", 30),
      ],
    }));

    const model = selectDevelopmentModel(snapshot);

    expect(model.activeProjectCount).toBe(1);
    expect(model.activeProjectsByStatus).toEqual([{ status: "LP Development", count: 1 }]);
    expect(model.developmentHoursByPhase).toEqual([{ phase: "Planning", hours: 1.5 }]);
    expect(model.latestActivityRows[0].courseName).toBe("Project A");
  });

  it("treats null parsed time-log durations as zero in rollups instead of producing NaN", () => {
    const snapshot = buildAnalyticsSnapshot(bundleWithRows({
      projects: [project("A", "LP Development", 180)],
      timeLogs: [
        timeLog("1", "Project A", "LP Development LC", 90),
        timeLog("2", "Project A", "LP Development LC", null as number | null),
      ],
    }));

    const dashboard = selectDashboardModel(snapshot);
    const development = selectDevelopmentModel(snapshot);

    expect(dashboard.cards.totalLoggedHours).toBe(1.5);
    expect(development.developmentHoursByPhase).toEqual([{ phase: "Planning", hours: 1.5 }]);
  });

  it("keeps dashboard chart filters local to the chart being requested", () => {
    const snapshot = createUiSnapshot();

    const unfiltered = selectDashboardModel(snapshot);
    const filtered = selectDashboardModel(snapshot, {
      projectsByReportingYear: { statuses: ["Published"] },
    });

    expect(unfiltered.projectsByReportingYear).toEqual([
      { year: "2025", count: 1 },
      { year: "2026", count: 1 },
    ]);
    expect(filtered.projectsByReportingYear).toEqual([{ year: "2025", count: 1 }]);
    expect(filtered.hoursByTimeLogPhase).toEqual(unfiltered.hoursByTimeLogPhase);
  });

  it("builds grouped reconciliation rows and surfaces shared suggestions", () => {
    const snapshot = createUiSnapshot();

    const model = selectGroupedReconciliationModel(snapshot);

    expect(model.timeLogGroups).toHaveLength(1);
    expect(model.timeLogGroups[0].title).toBe("Alpha Project Video");
    expect(model.timeLogGroups[0].rowCount).toBe(2);
    expect(model.timeLogGroups[0].topSuggestion?.projectName).toBe("Alpha Project");
    expect(model.standaloneGroups[0].title).toBe("Standalone Safety Video");
  });

  it("builds a project detail model with timeline, feedback, and similar projects", () => {
    const snapshot = createUiSnapshot();

    const model = selectProjectDetailModel(snapshot, "alpha-project|2026");

    expect(model?.projectName).toBe("Alpha Project");
    expect(model?.timeline.points).toHaveLength(2);
    expect(model?.smeFeedback.designerComments[0].comment).toContain("Great collaboration");
    expect(model?.comparison.similarProjects[0].projectName).toBe("Beta Project");
    expect(model?.comparison.percentileRank).toBeGreaterThan(0);
  });

  it("uses instrument-specific dates when filtering SME collaboration data", () => {
    const snapshot = createUiSnapshot();

    const idWindow = selectSmeCollaborationModel(snapshot, {
      startDate: "2026-03-09",
      endDate: "2026-03-09",
    });
    const smeWindow = selectSmeCollaborationModel(snapshot, {
      startDate: "2026-03-08",
      endDate: "2026-03-08",
      internalValues: ["Internal"],
    });

    expect(idWindow.cards.responseCount).toBe(1);
    expect(idWindow.matchedResponses[0].projectName).toBe("Alpha Project");
    expect(smeWindow.cards.responseCount).toBe(1);
    expect(smeWindow.bySme[0].sme).toBe("Taylor SME");
  });
});
