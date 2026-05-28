import { describe, expect, it } from "vitest";
import { buildAnalyticsSnapshot } from "@/lib/analytics/snapshot";
import {
  selectAdminDevelopmentAnalyticsModel,
  selectDashboardModel,
  selectDevelopmentModel,
  selectExternalTeamsModel,
  selectGroupedReconciliationModel,
  selectPersonDetailModel,
  selectProjectDetailModel,
  selectProjectsPageRows,
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

function project(
  id: string,
  status: string,
  minutes: number,
  year = "2026",
  overrides: Partial<RawProjectImportRow> = {},
): RawProjectImportRow {
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
    ...overrides,
  };
}

function timeLog(
  id: string,
  courseName: string,
  category: string,
  minutes: number | null,
  date = "2026-04-10",
  overrides: Partial<RawTimeLogRow> = {},
): RawTimeLogRow {
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
    ...overrides,
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
    expect(model.activeProjectStatusMix).toEqual([{ label: "LP Development", value: 1 }]);
    expect(model.hoursByTimeLogPhase.find((row) => row.phase === "Planning")?.hours).toBe(1.5);
  });

  it("builds active project status mix from project statuses instead of derived time-log phases", () => {
    const snapshot = buildAnalyticsSnapshot(bundleWithRows({
      projects: [
        project("A", "LP Development", 180),
        project("B", "SME Review", 120),
        project("C", "Testing", 90),
        project("D", "Completed", 60),
        project("E", "Published", 60),
        project("F", "Cancelled", 60),
      ],
      timeLogs: [
        timeLog("1", "Project A", "LP Development LC", 90),
        timeLog("2", "Project B", "SME Review LC", 30),
        timeLog("3", "Project C", "Testing LC", 45),
      ],
    }));

    const model = selectDashboardModel(snapshot);

    expect(model.activeProjectStatusMix).toEqual([
      { label: "LP Development", value: 1 },
      { label: "SME Review", value: 1 },
      { label: "Testing", value: 1 },
    ]);
    expect(model.activeProjectStatusMix.map((row) => row.label)).not.toEqual(
      expect.arrayContaining(["Planning", "QA/Release", "Review"]),
    );
  });

  it("groups active external-team projects by project status and excludes inactive records", () => {
    const snapshot = buildAnalyticsSnapshot(bundleWithRows({
      projects: [
        project("LegalA", "Process Legal Review", 120),
        project("LegalB", "Staging - Legal Review", 120),
        project("Cqo", "CQO Review", 120),
        project("Compliance", "Compliance Review", 120),
        project("PublishedLegal", "Published", 120),
        project("CancelledCqo", "Cancelled", 120),
        project("CompletedCompliance", "Completed", 120),
      ],
      timeLogs: [],
    }));

    const model = selectExternalTeamsModel(snapshot);

    expect(model.activeExternalTeamProjects.legal.map((row) => row.status)).toEqual([
      "Process Legal Review",
      "Staging - Legal Review",
    ]);
    expect(model.activeExternalTeamProjects.cqo.map((row) => row.status)).toEqual(["CQO Review"]);
    expect(model.activeExternalTeamProjects.compliance.map((row) => row.status)).toEqual(["Compliance Review"]);
    expect([
      ...model.activeExternalTeamProjects.legal,
      ...model.activeExternalTeamProjects.cqo,
      ...model.activeExternalTeamProjects.compliance,
    ].map((row) => row.status)).not.toEqual(expect.arrayContaining(["Completed", "Published", "Cancelled"]));
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

    const model = selectDevelopmentModel(snapshot, { currentYear: "2026" });

    expect(model.activeProjectCount).toBe(1);
    expect(model.activeProjectsCurrentYear).toBe(1);
    expect(model.activeProjectsPreviousYear).toBe(0);
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
    const development = selectDevelopmentModel(snapshot, { currentYear: "2026" });

    expect(dashboard.cards.totalLoggedHours).toBe(1.5);
    expect(development.developmentHoursByPhase).toEqual([{ phase: "Planning", hours: 1.5 }]);
  });

  it("builds admin development analytics from assigned IDs and direct ID-role project logs", () => {
    const snapshot = buildAnalyticsSnapshot(bundleWithRows({
      projects: [
        project("A", "Completed", 120, "2026", { id_assigned_raw: "Alex Doe", course_length_raw: "2 hr" }),
        project("B", "LP Development", 120, "2026", { id_assigned_raw: "Alex Doe", course_length_raw: "1 hr" }),
        project("C", "Published", 120, "2026", { id_assigned_raw: "Jordan Lee", course_length_raw: "3 hr" }),
        project("D", "Completed", 120, "2026", { id_assigned_raw: "Zero ID", course_length_raw: "1 hr" }),
      ],
      timeLogs: [
        timeLog("1", "Project A", "LP Development LC", 60, "2026-04-01", { raw_user: "Alex Doe" }),
        timeLog("2", "Project A", "Rise Development LC", 30, "2026-04-02", { raw_user: "Alex Doe" }),
        timeLog("3", "Project A", "LP Development LC", 120, "2026-04-03", { raw_user: "Jordan Lee" }),
        timeLog("4", "Project B", "LP Development LC", 90, "2026-04-04", { raw_user: "Alex Doe" }),
        timeLog("5", "Project C", "Rise Development LC", 60, "2026-04-05", { raw_user: "Jordan Lee" }),
        timeLog("6", "Project C", "Rise Development LC", 300, "2026-04-06", { raw_user: "Taylor SME" }),
      ],
    }));

    const model = selectAdminDevelopmentAnalyticsModel(snapshot);

    expect(model.developmentTimeByCategory).toEqual([
      { category: "LP Development LC", hours: 2.5, percentOfTotal: 62.5 },
      { category: "Rise Development LC", hours: 1.5, percentOfTotal: 37.5 },
    ]);
    expect(model.idProjectHours).toEqual([
      expect.objectContaining({ projectName: "Project A", assignedId: "Alex Doe", hours: 1.5 }),
      expect.objectContaining({ projectName: "Project B", assignedId: "Alex Doe", hours: 1.5 }),
      expect.objectContaining({ projectName: "Project C", assignedId: "Jordan Lee", hours: 1 }),
    ]);
    expect(model.efficiencyById).toEqual([
      expect.objectContaining({ assignedId: "Jordan Lee", completedCourseCount: 1, completedCourseLengthHours: 3, totalDevelopmentHours: 1, efficiency: 3, tier: "High" }),
      expect.objectContaining({ assignedId: "Alex Doe", completedCourseCount: 1, completedCourseLengthHours: 2, totalDevelopmentHours: 3, efficiency: 0.67, progressWeightedCompleted: 1.11 }),
      expect.objectContaining({ assignedId: "Zero ID", completedCourseCount: 1, completedCourseLengthHours: 1, totalDevelopmentHours: 0, efficiency: null, tier: "Unranked" }),
    ]);
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

  it("applies dashboard project filters by year, owner, and tool", () => {
    const snapshot = buildAnalyticsSnapshot(bundleWithRows({
      projects: [
        project("A", "LP Development", 180, "2026", {
          id_assigned_raw: "Alex Doe",
          authoring_tool: "Rise",
          course_type: "New",
        }),
        project("B", "SME Review", 120, "2026", {
          id_assigned_raw: "Jordan Lee",
          authoring_tool: "Storyline",
          course_type: "Revamp",
        }),
        project("C", "Testing", 90, "2025", {
          id_assigned_raw: "Alex Doe",
          authoring_tool: "Storyline",
          course_type: "New",
        }),
        project("D", "Published", 60, "2026", {
          id_assigned_raw: "Alex Doe",
          authoring_tool: "Rise",
          course_type: "Revamp",
        }),
      ],
      timeLogs: [],
    }));

    expect(selectDashboardModel(snapshot, {
      projectsByReportingYear: { authoringTools: ["Rise"] },
    }).projectsByReportingYear).toEqual([{ year: "2026", count: 2 }]);

    expect(selectDashboardModel(snapshot, {
      projectMixByCourseType: { reportingYears: ["2025"] },
    }).projectMixByCourseType).toEqual([{ label: "New", value: 1 }]);

    expect(selectDashboardModel(snapshot, {
      projectMixByAuthoringTool: { owners: ["Jordan Lee"] },
    }).projectMixByAuthoringTool).toEqual([{ label: "Storyline", value: 1 }]);

    expect(selectDashboardModel(snapshot, {
      activeProjectStatusMix: {
        reportingYears: ["2026"],
        owners: ["Alex Doe"],
        authoringTools: ["Rise"],
      },
    }).activeProjectStatusMix).toEqual([{ label: "LP Development", value: 1 }]);
  });

  it("sorts latest activity rows by the requested column and falls back to the default order", () => {
    const snapshot = createUiSnapshot();
    snapshot.canonicalProjects[1].status = "LP Development";
    snapshot.canonicalProjects[1].raw_status = "LP Development";

    const defaultModel = selectDevelopmentModel(snapshot, { currentYear: "2026" });
    const sortedByProject = selectDevelopmentModel(snapshot, {
      currentYear: "2026",
      latestActivity: {
        sortKey: "projectName",
        sortDirection: "asc",
      },
    });

    expect(defaultModel.latestActivityRows[0].projectName).toBe("Alpha Project");
    expect(sortedByProject.latestActivityRows[0].projectName).toBe("Alpha Project");
    expect(sortedByProject.latestActivityRows[1].projectName).toBe("Beta Project");
  });

  it("applies expanded development chart filters independently", () => {
    const snapshot = createUiSnapshot();
    snapshot.canonicalProjects[1].status = "LP Development";
    snapshot.canonicalProjects[1].raw_status = "LP Development";

    const model = selectDevelopmentModel(snapshot, {
      currentYear: "2026",
      chartFilters: {
        activeProjectsByStatus: { reportingYears: ["2026"], authoringTools: ["Rise"], courseTypes: ["New"] },
        activeProjectsByCourseType: { reportingYears: ["2025"], authoringTools: ["Storyline"] },
      },
    });

    expect(model.activeProjectsByStatus).toEqual([{ status: "LP Development", count: 1 }]);
    expect(model.activeProjectsByCourseType).toEqual([{ type: "Revamp", count: 1 }]);
  });

  it("applies external team chart filters to time-log rollups", () => {
    const snapshot = createUiSnapshot();

    const model = selectExternalTeamsModel(snapshot, {
      users: ["Legal Ops"],
      phases: ["Other"],
      classifications: ["non_project_work"],
      reportingYears: ["Unknown"],
    });

    expect(model.hoursByExternalRoleGroup).toEqual([{ roleGroup: "Non-Project Work", hours: 0.3 }]);
    expect(model.usersByHours).toEqual([{ user: "Legal Ops", hours: 0.3 }]);
  });

  it("applies SME collaboration chart-specific filters", () => {
    const snapshot = createUiSnapshot();

    const model = selectSmeCollaborationModel(snapshot, {
      matrix: { internalValues: ["Internal"], reportingYears: ["2026"] },
      bySme: { internalValues: ["Non-Internal"] },
      matchedResponses: { internalValues: ["Internal"] },
    });

    expect(model.smeQuestionMatrix[0].responseCount).toBe(1);
    expect(model.bySme.map((row) => row.instructionalDesigner)).toEqual(["Jordan Lee"]);
    expect(model.matchedResponses.map((row) => row.sme)).toEqual(["Taylor SME"]);
  });

  it("applies project and person detail chart filters", () => {
    const snapshot = createUiSnapshot();
    snapshot.canonicalProjects[1].status = "Testing";
    snapshot.canonicalProjects[1].raw_status = "Testing";
    snapshot.canonicalProjects[1].primary_id_assigned = "Alex Doe";
    snapshot.canonicalProjects[1].id_assigned_raw = "Alex Doe";
    snapshot.canonicalProjects[1].owner_names = ["Alex Doe"];

    const projectModel = selectProjectDetailModel(snapshot, "alpha-project|2026", {
      timeline: { phases: ["Review"] },
    });
    const personModel = selectPersonDetailModel(snapshot, "Alex Doe", {
      idStatusBreakdown: { authoringTools: ["Storyline"] },
    });

    expect(projectModel?.timeline.points).toEqual([{ date: "2026-03-10", label: "2026-03-10", hours: 3 }]);
    expect(personModel?.idView.statusBreakdown).toEqual([{ status: "Testing", count: 1 }]);
  });

  it("returns project-page metadata for chart click-through filters", () => {
    const snapshot = createUiSnapshot();
    const rows = selectProjectsPageRows(snapshot);
    const alpha = rows.find((row) => row.projectKey === "alpha-project|2026");

    expect(alpha?.exactProjectValues).toEqual(["Alpha Project", "alpha-project|2026"]);
    expect(alpha?.timeLogUsers).toEqual(["Alex Doe"]);
    expect(alpha?.timeLogWorkScopes).toEqual(["matched_project_work"]);
    expect(alpha?.timeLogExternalClassifications).toEqual(["other_external"]);
    expect(alpha?.timeLogDates).toEqual(["2026-03-01", "2026-03-10"]);
    expect(alpha?.smeFeedbackInstructionalDesigners).toEqual(["Alex Doe"]);
    expect(alpha?.smeFeedbackInternalLabels).toEqual(["Internal"]);
    expect(alpha?.smeFeedbackDates).toEqual(["2026-03-08", "2026-03-09"]);
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
    expect(smeWindow.bySme[0].instructionalDesigner).toBe("Alex Doe");
  });

  it("keeps SME matrix rows on SME-view data only and locks source verification metadata", () => {
    const snapshot = createUiSnapshot();
    const model = selectSmeCollaborationModel(snapshot);
    const overallExperienceRow = model.smeQuestionMatrix.find((row) => row.question === "overall_experience_with_lexipol");

    expect(overallExperienceRow?.counts[4]).toBe(1);
    expect(overallExperienceRow?.counts[5]).toBe(1);
    expect(overallExperienceRow?.average).toBe(4.5);
    expect(model.sourceVerification.smeExperienceBreakdown).toBe("smeFeedbackSmeView");
    expect(model.sourceVerification.instructionalDesignerBreakdown).toBe("smeFeedbackIdView");
  });

  it("attributes SME collaboration ratings to the rated person and builds course coverage bars", () => {
    const snapshot = createUiSnapshot();
    snapshot.canonicalProjects[0].sme_assigned_raw = "Taylor SME, Casey SME";
    snapshot.canonicalProjects[0].owner_names = ["Alex Doe", "Jordan Lee"];

    const model = selectSmeCollaborationModel(snapshot);

    expect(model.smeCourseSurveyCoverage).toEqual([
      { sme: "Casey SME", assignedCourses: 2, completedSurveys: 1, averageRating: 4 },
      { sme: "Taylor SME", assignedCourses: 1, completedSurveys: 1, averageRating: 4.67 },
    ]);
    expect(model.idCourseSurveyCoverage).toEqual([
      { instructionalDesigner: "Jordan Lee", assignedCourses: 2, completedSurveys: 1, averageRating: 4 },
      { instructionalDesigner: "Alex Doe", assignedCourses: 1, completedSurveys: 1, averageRating: 4.6 },
    ]);
    expect(model.byInstructionalDesigner).toEqual([
      { sme: "Casey SME", responses: 1, averageRating: 4 },
      { sme: "Taylor SME", responses: 1, averageRating: 4.67 },
    ]);
    expect(model.bySme).toEqual([
      { instructionalDesigner: "Alex Doe", responses: 1, averageScore: 4.6 },
      { instructionalDesigner: "Jordan Lee", responses: 1, averageScore: 4 },
    ]);
  });

  it("excludes SMEs without averageable scores from the SME experience breakdown", () => {
    const snapshot = createUiSnapshot();
    snapshot.smeFeedbackSmeView.push({
      raw_sme_feedback_row_id: "sme-empty",
      matched_project_key: null,
      join_status: "unresolved",
      join_method: null,
      join_confidence: null,
      reporting_year: "2026",
      survey_date: "2026-04-01",
      course_name_raw: "Unmatched Course",
      course_key_raw: "Unmatched Course",
      instructional_designer: "No Score ID",
      sme: "No Score SME",
      sme_email: "noscore@example.com",
      internal: "No",
      hours_worked: null,
      amount_billed: null,
      overall_experience_with_lexipol: null,
      clarity_of_goals_and_objectives: null,
      staff_responsiveness: null,
      adequacy_of_tools_and_resources: null,
      training_and_support_provided: null,
      use_of_my_expertise: null,
      incorporation_of_my_feedback: null,
      autonomy_in_course_design: null,
      feeling_valued_as_an_sme: null,
      likelihood_to_recommend_lexipol: null,
      additional_feedback_or_suggestions: "",
    });

    const model = selectSmeCollaborationModel(snapshot);
    expect(model.bySme.some((row) => row.instructionalDesigner === "No Score ID")).toBe(false);
  });

  it("builds a person detail model from the correct survey and project relationships", () => {
    const snapshot = createUiSnapshot();

    const idModel = selectPersonDetailModel(snapshot, "Alex Doe");
    const smeModel = selectPersonDetailModel(snapshot, "Taylor SME");

    expect(idModel?.roles).toContain("ID");
    expect(idModel?.idView.assignedProjectCount).toBe(1);
    expect(idModel?.idView.smeExperienceSurveyCount).toBe(1);
    expect(idModel?.overview.recentProjects[0].projectName).toBe("Alpha Project");
    expect(smeModel?.roles).toContain("SME");
    expect(smeModel?.smeView.surveyCount).toBe(1);
    expect(smeModel?.smeView.evaluationCount).toBe(1);
    expect(smeModel?.smeView.contributedProjectCount).toBeGreaterThan(0);
  });
});
