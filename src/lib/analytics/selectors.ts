import { format, parseISO, startOfWeek } from "date-fns";
import { FINALIZED_PROJECT_STATUSES } from "@/lib/analytics/constants";
import { EXTERNAL_WORK_CLASSIFICATION_LABELS, SME_QUESTION_LABELS, WORK_SCOPE_LABELS } from "@/lib/analytics/labels";
import { compactCourseName, normalizePersonName, parseDurationToMinutes, splitMultiValueField } from "@/lib/analytics/normalization";
import { buildProjectDetailPath } from "@/lib/analytics/project-routing";
import type {
  AnalyticsSnapshot,
  CanonicalProject,
  JoinConfidence,
  RoleGroup,
  SmeSmeFeedbackRow,
  TimeLogMatchAuditRow,
  TimeLogRow,
} from "@/lib/analytics/types";

type DashboardWorkScope = keyof typeof WORK_SCOPE_LABELS;
type ExternalWorkClassification = keyof typeof EXTERNAL_WORK_CLASSIFICATION_LABELS;

export type DashboardChartFilters = {
  projectsByReportingYear?: {
    statuses?: string[];
    courseTypes?: string[];
    authoringTools?: string[];
  };
  activeProjectsByStatus?: {
    reportingYears?: string[];
    owners?: string[];
    authoringTools?: string[];
  };
  projectMixByCourseType?: {
    reportingYears?: string[];
    statuses?: string[];
  };
  projectMixByAuthoringTool?: {
    reportingYears?: string[];
    statuses?: string[];
  };
  hoursByTimeLogPhase?: {
    reportingYears?: string[];
    roleGroups?: string[];
    workScopes?: DashboardWorkScope[];
  };
  hoursByRoleGroup?: {
    reportingYears?: string[];
    phases?: string[];
    workScopes?: DashboardWorkScope[];
  };
};

export type SmeCollaborationFilters = {
  internalValues?: string[];
  startDate?: string | null;
  endDate?: string | null;
  matchedResponses?: SmeMatchedResponseFilters;
};

export type ExternalTeamsFilters = {
  roleGroups?: string[];
  phases?: string[];
  classifications?: ExternalWorkClassification[];
  reportingYears?: string[];
  users?: string[];
};

export type DevelopmentChartFilters = {
  activeProjectsByStatus?: {
    owners?: string[];
    authoringTools?: string[];
  };
  activeProjectsByIdOwner?: {
    reportingYears?: string[];
    courseTypes?: string[];
  };
  developmentHoursByPhase?: {
    owners?: string[];
    courseTypes?: string[];
    authoringTools?: string[];
  };
  activeProjectsByAuthoringTool?: {
    reportingYears?: string[];
    owners?: string[];
  };
  activeProjectsByCourseType?: {
    reportingYears?: string[];
    owners?: string[];
  };
};

export type DevelopmentLatestActivitySortKey = "projectName" | "status" | "owner" | "latestTimeLogDate";
export type SortDirection = "asc" | "desc";

export type DevelopmentLatestActivityFilters = {
  search?: string;
  statuses?: string[];
  owners?: string[];
  sortKey?: DevelopmentLatestActivitySortKey;
  sortDirection?: SortDirection;
};

export type DevelopmentModelOptions = {
  currentYear?: string;
  chartFilters?: DevelopmentChartFilters;
  latestActivity?: DevelopmentLatestActivityFilters;
};

export type SmeMatchedResponseFilters = {
  instructionalDesigners?: string[];
  smes?: string[];
  reportingYears?: string[];
};

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function labelOrUnknown(value: string | null | undefined) {
  return value || "Unknown";
}

function matchesSelected(selected: string[] | undefined, value: string) {
  return !selected?.length || selected.includes(value);
}

function matchesSearch(search: string | undefined, values: Array<string | null | undefined>) {
  const query = String(search || "").trim().toLowerCase();
  if (!query) return true;
  return values.some((value) => String(value || "").toLowerCase().includes(query));
}

function inDateRange(value: string | null, startDate?: string | null, endDate?: string | null) {
  if (!value) return false;
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
}

function compareNullableText(a: string | null | undefined, b: string | null | undefined) {
  return String(a || "").localeCompare(String(b || ""));
}

function compareNullableDate(a: string | null | undefined, b: string | null | undefined) {
  return String(a || "").localeCompare(String(b || ""));
}

function normalizePersonLookup(value: string | null | undefined) {
  return normalizePersonName(value).toLowerCase();
}

function matchesCanonicalPerson(canonicalName: string, candidate: string | null | undefined) {
  const canonicalLookup = normalizePersonLookup(canonicalName);
  if (!canonicalLookup) return false;
  return normalizePersonLookup(candidate) === canonicalLookup;
}

function matchesCanonicalPersonInList(canonicalName: string, values: Array<string | null | undefined>) {
  return values.some((value) => matchesCanonicalPerson(canonicalName, value));
}

function uniqueSorted(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function toProjectDisplay(project: CanonicalProject) {
  return {
    projectKey: project.project_key,
    projectName: project.raw_course_name,
    reportingYear: project.reporting_year || "Unknown",
    status: project.status,
    href: buildProjectDetailPath(project),
  };
}

function buildProjectMap(snapshot: AnalyticsSnapshot) {
  return new Map(snapshot.canonicalProjects.map((project) => [project.project_key, project]));
}

function buildWorkEntityMap(snapshot: AnalyticsSnapshot) {
  return new Map(snapshot.dimWorkEntity.map((entity) => [entity.work_entity_key, entity]));
}

function getDashboardWorkScope(row: TimeLogRow): DashboardWorkScope {
  if (row.work_entity_type === "standalone_course") return "standalone_work";
  if (row.work_entity_type === "operational_work") return "non_project_work";
  return "matched_project_work";
}

function getExternalWorkClassification(row: TimeLogRow): ExternalWorkClassification {
  if (row.work_entity_type === "standalone_course") return "standalone_work";
  if (row.work_entity_type === "operational_work") return "non_project_work";
  if (row.role_group === "Legal") return "legal";
  return "other_external";
}

function getTimeLogReportingYear(
  row: TimeLogRow,
  projectMap: Map<string, CanonicalProject>,
  workEntityMap: Map<string, AnalyticsSnapshot["dimWorkEntity"][number]>,
) {
  if (row.matched_project_key) {
    return projectMap.get(row.matched_project_key)?.reporting_year || "Unknown";
  }

  if (row.matched_work_entity_key) {
    return workEntityMap.get(row.matched_work_entity_key)?.reporting_year || "Unknown";
  }

  return "Unknown";
}

function buildCountSeries(items: string[]) {
  return Object.entries(
    items.reduce<Record<string, number>>((acc, item) => {
      acc[item] = (acc[item] || 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function buildHoursSeries(items: Array<{ key: string; minutes: number | null }>) {
  return Object.entries(
    items.reduce<Record<string, number>>((acc, item) => {
      acc[item.key] = (acc[item.key] || 0) + (item.minutes ?? 0) / 60;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function similarityScore(source: string, target: string) {
  if (!source || !target) return 0;
  if (source === target) return 1;
  if (source.includes(target) || target.includes(source)) return 0.94;

  const sourceTokens = new Set(source.split(/(?=[A-Z])|[^a-z0-9]+/i).filter(Boolean));
  const targetTokens = new Set(target.split(/(?=[A-Z])|[^a-z0-9]+/i).filter(Boolean));
  if (!sourceTokens.size || !targetTokens.size) return 0;

  let overlap = 0;
  sourceTokens.forEach((token) => {
    if (targetTokens.has(token)) overlap += 1;
  });

  return overlap / Math.max(sourceTokens.size, targetTokens.size);
}

export function isProjectActive(project: CanonicalProject) {
  return !FINALIZED_PROJECT_STATUSES.has(project.status) && project.status !== "Cancelled";
}

export function compareYearLabel(a: string | null | undefined, b: string | null | undefined) {
  const aText = String(a || "Unknown");
  const bText = String(b || "Unknown");
  const aYear = /^\d{4}$/.test(aText) ? Number(aText) : Number.NaN;
  const bYear = /^\d{4}$/.test(bText) ? Number(bText) : Number.NaN;
  if (!Number.isNaN(aYear) && !Number.isNaN(bYear)) return aYear - bYear;
  if (!Number.isNaN(aYear)) return -1;
  if (!Number.isNaN(bYear)) return 1;
  return aText.localeCompare(bText);
}

export function getSmeInternalLabel(value: string | null | undefined) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "Unknown";
  if (["true", "yes", "y", "internal", "1"].includes(normalized)) return "Internal";
  return "Non-Internal";
}

export function selectProjectDisplayInfo(snapshot: AnalyticsSnapshot, projectKey: string) {
  const project = snapshot.canonicalProjects.find((entry) => entry.project_key === projectKey);
  return project ? toProjectDisplay(project) : null;
}

export function selectDashboardModel(snapshot: AnalyticsSnapshot, filters: DashboardChartFilters = {}) {
  const projectMap = buildProjectMap(snapshot);
  const workEntityMap = buildWorkEntityMap(snapshot);
  const totalProjects = snapshot.canonicalProjects.length;
  const activeProjects = snapshot.canonicalProjects.filter(isProjectActive);
  const completedProjects = snapshot.canonicalProjects.filter((project) =>
    project.status === "Completed" || project.status === "Published",
  );
  const totalProjectHours = round(
    snapshot.canonicalProjects.reduce((sum, project) => sum + project.project_total_minutes / 60, 0),
    1,
  );
  const totalLoggedHours = round(snapshot.timeLogs.reduce((sum, row) => sum + (row.minutes ?? 0) / 60, 0), 1);
  const standaloneHours = round(
    snapshot.timeLogs
      .filter((row) => row.work_entity_type === "standalone_course")
      .reduce((sum, row) => sum + (row.minutes ?? 0) / 60, 0),
    1,
  );
  const operationalHours = round(
    snapshot.timeLogs
      .filter((row) => row.work_entity_type === "operational_work")
      .reduce((sum, row) => sum + (row.minutes ?? 0) / 60, 0),
    1,
  );
  const discrepancyCount = snapshot.canonicalProjects.filter((project) => project.hours_discrepancy_flag).length;

  const projectsByReportingYearSource = snapshot.canonicalProjects.filter((project) =>
    matchesSelected(filters.projectsByReportingYear?.statuses, project.status) &&
    matchesSelected(filters.projectsByReportingYear?.courseTypes, labelOrUnknown(project.course_type)) &&
    matchesSelected(filters.projectsByReportingYear?.authoringTools, labelOrUnknown(project.authoring_tool)),
  );

  const activeProjectsByStatusSource = activeProjects.filter((project) =>
    matchesSelected(filters.activeProjectsByStatus?.reportingYears, project.reporting_year || "Unknown") &&
    matchesSelected(filters.activeProjectsByStatus?.owners, project.primary_id_assigned || "Unassigned") &&
    matchesSelected(filters.activeProjectsByStatus?.authoringTools, labelOrUnknown(project.authoring_tool)),
  );

  const projectMixByCourseTypeSource = snapshot.canonicalProjects.filter((project) =>
    matchesSelected(filters.projectMixByCourseType?.reportingYears, project.reporting_year || "Unknown") &&
    matchesSelected(filters.projectMixByCourseType?.statuses, project.status),
  );

  const projectMixByAuthoringToolSource = snapshot.canonicalProjects.filter((project) =>
    matchesSelected(filters.projectMixByAuthoringTool?.reportingYears, project.reporting_year || "Unknown") &&
    matchesSelected(filters.projectMixByAuthoringTool?.statuses, project.status),
  );

  const hoursByTimeLogPhaseSource = snapshot.timeLogs.filter((row) =>
    matchesSelected(
      filters.hoursByTimeLogPhase?.reportingYears,
      getTimeLogReportingYear(row, projectMap, workEntityMap) || "Unknown",
    ) &&
    matchesSelected(filters.hoursByTimeLogPhase?.roleGroups, row.role_group) &&
    matchesSelected(filters.hoursByTimeLogPhase?.workScopes, getDashboardWorkScope(row)),
  );

  const hoursByRoleGroupSource = snapshot.timeLogs.filter((row) =>
    matchesSelected(
      filters.hoursByRoleGroup?.reportingYears,
      getTimeLogReportingYear(row, projectMap, workEntityMap) || "Unknown",
    ) &&
    matchesSelected(filters.hoursByRoleGroup?.phases, row.category_phase) &&
    matchesSelected(filters.hoursByRoleGroup?.workScopes, getDashboardWorkScope(row)),
  );

  return {
    cards: {
      totalProjects,
      activeProjects: activeProjects.length,
      completedPublishedProjects: completedProjects.length,
      totalProjectHours,
      totalLoggedHours,
      standaloneHours,
      operationalHours,
      discrepancyCount,
      discrepancyRate: totalProjects ? round((discrepancyCount / totalProjects) * 100, 1) : 0,
    },
    hoursComparison: [
      {
        label: "Project Hours",
        hours: totalProjectHours,
        description: "Total project time from project records, including all work whether categorized or not",
      },
      {
        label: "Logged Hours",
        hours: totalLoggedHours,
        description: "Time from structured learning workflow categories in the time-log dataset",
      },
      {
        label: WORK_SCOPE_LABELS.standalone_work,
        hours: standaloneHours,
        description: "Course-like work tracked outside the canonical project exports",
      },
      {
        label: WORK_SCOPE_LABELS.non_project_work,
        hours: operationalHours,
        description: "Operational or support work that is not tied to a course project",
      },
    ],
    projectsByReportingYear: buildCountSeries(
      projectsByReportingYearSource.map((project) => project.reporting_year || "Unknown"),
    )
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => compareYearLabel(a.year, b.year)),
    activeProjectsByStatus: buildCountSeries(activeProjectsByStatusSource.map((project) => project.status))
      .map(([status, count]) => ({ status, count })),
    projectMixByCourseType: buildCountSeries(
      projectMixByCourseTypeSource.map((project) => labelOrUnknown(project.course_type)),
    ).map(([label, value]) => ({ label, value })),
    projectMixByAuthoringTool: buildCountSeries(
      projectMixByAuthoringToolSource.map((project) => labelOrUnknown(project.authoring_tool)),
    ).map(([label, value]) => ({ label, value })),
    hoursByTimeLogPhase: buildHoursSeries(
      hoursByTimeLogPhaseSource.map((row) => ({ key: row.category_phase, minutes: row.minutes })),
    ).map(([phase, hours]) => ({ phase, hours: round(hours, 1) })),
    hoursByRoleGroup: buildHoursSeries(
      hoursByRoleGroupSource.map((row) => ({ key: row.role_group, minutes: row.minutes })),
    ).map(([roleGroup, hours]) => ({ roleGroup: roleGroup as RoleGroup, hours: round(hours, 1) })),
  };
}

export function selectDevelopmentModel(snapshot: AnalyticsSnapshot, options: DevelopmentModelOptions = {}) {
  const activeProjects = snapshot.canonicalProjects.filter(isProjectActive);
  const activeKeys = new Set(activeProjects.map((project) => project.project_key));
  const currentYear = options.currentYear || String(new Date().getFullYear());
  const previousYear = String(Number(currentYear) - 1);

  const chartFilterOptions = {
    reportingYears: uniqueSorted(activeProjects.map((project) => project.reporting_year || "Unknown")),
    owners: uniqueSorted(activeProjects.map((project) => project.primary_id_assigned || "Unassigned")),
    authoringTools: uniqueSorted(activeProjects.map((project) => labelOrUnknown(project.authoring_tool))),
    courseTypes: uniqueSorted(activeProjects.map((project) => labelOrUnknown(project.course_type))),
    statuses: uniqueSorted(activeProjects.map((project) => project.status)),
  };

  const activeProjectsByStatusSource = activeProjects.filter((project) =>
    matchesSelected(options.chartFilters?.activeProjectsByStatus?.owners, project.primary_id_assigned || "Unassigned") &&
    matchesSelected(options.chartFilters?.activeProjectsByStatus?.authoringTools, labelOrUnknown(project.authoring_tool)),
  );

  const activeProjectsByIdOwnerSource = activeProjects.filter((project) =>
    matchesSelected(options.chartFilters?.activeProjectsByIdOwner?.reportingYears, project.reporting_year || "Unknown") &&
    matchesSelected(options.chartFilters?.activeProjectsByIdOwner?.courseTypes, labelOrUnknown(project.course_type)),
  );

  const activeProjectsByAuthoringToolSource = activeProjects.filter((project) =>
    matchesSelected(options.chartFilters?.activeProjectsByAuthoringTool?.reportingYears, project.reporting_year || "Unknown") &&
    matchesSelected(options.chartFilters?.activeProjectsByAuthoringTool?.owners, project.primary_id_assigned || "Unassigned"),
  );

  const activeProjectsByCourseTypeSource = activeProjects.filter((project) =>
    matchesSelected(options.chartFilters?.activeProjectsByCourseType?.reportingYears, project.reporting_year || "Unknown") &&
    matchesSelected(options.chartFilters?.activeProjectsByCourseType?.owners, project.primary_id_assigned || "Unassigned"),
  );

  const activeProjectsByStatus = buildCountSeries(activeProjectsByStatusSource.map((project) => project.status))
    .map(([status, count]) => ({ status, count }));

  const activeProjectsByIdOwner = buildCountSeries(
    activeProjectsByIdOwnerSource.map((project) => project.primary_id_assigned || "Unassigned"),
  ).map(([owner, count]) => ({ owner, count }));

  const activeProjectsByAuthoringTool = buildCountSeries(
    activeProjectsByAuthoringToolSource.map((project) => labelOrUnknown(project.authoring_tool)),
  ).map(([tool, count]) => ({ tool, count }));

  const activeProjectsByCourseType = buildCountSeries(
    activeProjectsByCourseTypeSource.map((project) => labelOrUnknown(project.course_type)),
  ).map(([type, count]) => ({ type, count }));

  const developmentHoursByPhase = buildHoursSeries(
    snapshot.timeLogs
      .filter((row) => row.matched_project_key && activeKeys.has(row.matched_project_key))
      .filter((row) => {
        const project = row.matched_project_key
          ? activeProjects.find((entry) => entry.project_key === row.matched_project_key)
          : null;
        if (!project) return false;

        return (
          matchesSelected(options.chartFilters?.developmentHoursByPhase?.owners, project.primary_id_assigned || "Unassigned") &&
          matchesSelected(options.chartFilters?.developmentHoursByPhase?.courseTypes, labelOrUnknown(project.course_type)) &&
          matchesSelected(options.chartFilters?.developmentHoursByPhase?.authoringTools, labelOrUnknown(project.authoring_tool))
        );
      })
      .map((row) => ({ key: row.category_phase, minutes: row.minutes })),
  ).map(([phase, hours]) => ({ phase, hours: round(hours, 1) }));

  const latestActivityFilterOptions = {
    statuses: chartFilterOptions.statuses,
    owners: chartFilterOptions.owners,
  };

  const latestActivitySource = activeProjects
    .map((project) => ({
      projectKey: project.project_key,
      projectName: project.raw_course_name,
      courseName: project.raw_course_name,
      reportingYear: project.reporting_year || "Unknown",
      status: project.status,
      owner: project.primary_id_assigned || "Unassigned",
      latestTimeLogDate: project.latest_time_log_date,
      authoringTool: labelOrUnknown(project.authoring_tool),
      courseType: labelOrUnknown(project.course_type),
    }))
    .filter((row) =>
      matchesSearch(options.latestActivity?.search, [row.projectName, row.status, row.owner]) &&
      matchesSelected(options.latestActivity?.statuses, row.status) &&
      matchesSelected(options.latestActivity?.owners, row.owner),
    );

  const sortKey = options.latestActivity?.sortKey || "latestTimeLogDate";
  const sortDirection = options.latestActivity?.sortDirection || "desc";
  const directionMultiplier = sortDirection === "asc" ? 1 : -1;

  const latestActivityRows = latestActivitySource.sort((a, b) => {
    let comparison = 0;

    if (sortKey === "projectName") {
      comparison = compareNullableText(a.projectName, b.projectName);
    } else if (sortKey === "status") {
      comparison = compareNullableText(a.status, b.status);
    } else if (sortKey === "owner") {
      comparison = compareNullableText(a.owner, b.owner);
    } else {
      comparison = compareNullableDate(a.latestTimeLogDate, b.latestTimeLogDate);
    }

    if (comparison === 0) {
      comparison = compareNullableText(a.projectName, b.projectName);
    }

    return comparison * directionMultiplier;
  });

  return {
    activeProjectCount: activeProjects.length,
    currentYear,
    previousYear,
    activeProjectsCurrentYear: activeProjects.filter((project) => (project.reporting_year || "Unknown") === currentYear).length,
    activeProjectsPreviousYear: activeProjects.filter((project) => (project.reporting_year || "Unknown") === previousYear).length,
    activeProjectsByStatus,
    activeProjectsByIdOwner,
    activeProjectsByAuthoringTool,
    activeProjectsByCourseType,
    developmentHoursByPhase,
    latestActivityRows,
    latestActivityFilterOptions,
    chartFilterOptions,
  };
}

export function selectSmeCollaborationModel(snapshot: AnalyticsSnapshot, filters: SmeCollaborationFilters = {}) {
  const projectMap = buildProjectMap(snapshot);
  // ID-facing metrics must come only from the instructional designer survey instrument.
  const allIdRows = snapshot.smeFeedbackIdView.filter((row) =>
    (!filters.startDate && !filters.endDate ? true : inDateRange(row.id_survey_date, filters.startDate, filters.endDate)),
  );

  // SME-facing metrics must come only from the SME survey instrument.
  const smeRows = snapshot.smeFeedbackSmeView.filter((row) =>
    matchesSelected(filters.internalValues, getSmeInternalLabel(row.internal)) &&
    (!filters.startDate && !filters.endDate ? true : inDateRange(row.sme_survey_date, filters.startDate, filters.endDate)),
  );

  const internalFilteredIds = filters.internalValues?.length
    ? new Set(smeRows.map((row) => row.raw_sme_feedback_row_id))
    : null;
  const idRows = allIdRows.filter((row) => !internalFilteredIds || internalFilteredIds.has(row.raw_sme_feedback_row_id));

  const relevantIds = new Set([...idRows, ...smeRows].map((row) => row.raw_sme_feedback_row_id));
  const relevantJoinRows = snapshot.smeJoinAudit.filter((row) => relevantIds.has(row.raw_sme_feedback_row_id));

  const unresolvedCount = relevantJoinRows.filter((row) => row.join_status !== "matched").length;
  const idOverallRatings = idRows
    .map((row) => row.overall_collaboration_rating)
    .filter((value): value is number => value !== null);
  const promoterScores = idRows
    .map((row) => row.promoter_score)
    .filter((value): value is number => value !== null);

  const smeQuestionKeys: Array<keyof SmeSmeFeedbackRow> = [
    "overall_experience_with_lexipol",
    "clarity_of_goals_and_objectives",
    "staff_responsiveness",
    "adequacy_of_tools_and_resources",
    "training_and_support_provided",
    "use_of_my_expertise",
    "incorporation_of_my_feedback",
    "autonomy_in_course_design",
    "feeling_valued_as_an_sme",
    "likelihood_to_recommend_lexipol",
  ];

  const smeQuestionMatrix = smeQuestionKeys.map((key) => {
    const scores = smeRows
      .map((row) => row[key] as number | null)
      .filter((value): value is number => value !== null);

    const counts = {
      1: scores.filter((value) => value === 1).length,
      2: scores.filter((value) => value === 2).length,
      3: scores.filter((value) => value === 3).length,
      4: scores.filter((value) => value === 4).length,
      5: scores.filter((value) => value === 5).length,
    };

    return {
      question: key,
      label: SME_QUESTION_LABELS[key as keyof typeof SME_QUESTION_LABELS],
      counts,
      responseCount: scores.length,
      average: round(average(scores), 2),
    };
  });

  const averageSmeQuestionScores = smeQuestionMatrix.map((row) => ({
    question: row.question,
    label: row.label,
    average: row.average,
  }));

  const bySme = smeRows.reduce<Record<string, { responses: number; scores: number[] }>>((acc, row) => {
    const key = row.sme || "Unknown SME";
    const scores = [
      row.overall_experience_with_lexipol,
      row.clarity_of_goals_and_objectives,
      row.staff_responsiveness,
      row.adequacy_of_tools_and_resources,
      row.training_and_support_provided,
      row.use_of_my_expertise,
      row.incorporation_of_my_feedback,
      row.autonomy_in_course_design,
      row.feeling_valued_as_an_sme,
      row.likelihood_to_recommend_lexipol,
    ].filter((value): value is number => value !== null);
    if (!acc[key]) acc[key] = { responses: 0, scores: [] };
    acc[key].responses += 1;
    acc[key].scores.push(...scores);
    return acc;
  }, {});

  const byInstructionalDesigner = idRows.reduce<Record<string, { responses: number; ratings: number[]; promoters: number[] }>>((acc, row) => {
    const key = row.instructional_designer || "Unknown ID";
    if (!acc[key]) acc[key] = { responses: 0, ratings: [], promoters: [] };
    acc[key].responses += 1;
    if (row.overall_collaboration_rating !== null) acc[key].ratings.push(row.overall_collaboration_rating);
    if (row.promoter_score !== null) acc[key].promoters.push(row.promoter_score);
    return acc;
  }, {});

  const byReportingYear = relevantJoinRows.reduce<Record<string, number>>((acc, row) => {
    const year = row.reporting_year || "Unknown";
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {});

  const byProject = relevantJoinRows
    .filter((row) => row.matched_project_key)
    .reduce<Record<string, number>>((acc, row) => {
      const key = row.matched_project_key!;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const idByRawId = new Map(idRows.map((row) => [row.raw_sme_feedback_row_id, row]));
  const smeByRawId = new Map(smeRows.map((row) => [row.raw_sme_feedback_row_id, row]));
  const matchedResponses = relevantJoinRows
    .filter((row) => row.matched_project_key)
    .map((row) => {
      const project = projectMap.get(row.matched_project_key!);
      const idRow = idByRawId.get(row.raw_sme_feedback_row_id);
      const smeRow = smeByRawId.get(row.raw_sme_feedback_row_id);

      return {
        rawSmeFeedbackRowId: row.raw_sme_feedback_row_id,
        projectKey: row.matched_project_key!,
        projectName: project?.raw_course_name || row.course_name_raw,
        reportingYear: project?.reporting_year || row.reporting_year || "Unknown",
        instructionalDesigner: idRow?.instructional_designer || smeRow?.instructional_designer || "Unknown ID",
        sme: smeRow?.sme || idRow?.sme || "Unknown SME",
        smeResponse: smeRow?.additional_feedback_or_suggestions || "",
        designerComments: idRow?.additional_comments || "",
      };
    })
    .filter((row) => row.smeResponse || row.designerComments)
    .sort((a, b) => a.projectName.localeCompare(b.projectName) || a.rawSmeFeedbackRowId.localeCompare(b.rawSmeFeedbackRowId));

  const matchedResponseFilterOptions = {
    instructionalDesigners: uniqueSorted(matchedResponses.map((row) => row.instructionalDesigner)),
    smes: uniqueSorted(matchedResponses.map((row) => row.sme)),
    reportingYears: uniqueSorted(matchedResponses.map((row) => row.reportingYear)),
  };

  const filteredMatchedResponses = matchedResponses.filter((row) =>
    matchesSelected(filters.matchedResponses?.instructionalDesigners, row.instructionalDesigner) &&
    matchesSelected(filters.matchedResponses?.smes, row.sme) &&
    matchesSelected(filters.matchedResponses?.reportingYears, row.reportingYear),
  );

  return {
    cards: {
      responseCount: relevantIds.size,
      averageOverallCollaborationRating: round(average(idOverallRatings), 2),
      averagePromoterScore: round(average(promoterScores), 2),
      unresolvedRowsCount: unresolvedCount,
    },
    smeQuestionMatrix,
    averageSmeQuestionScores,
    bySme: Object.entries(bySme)
      .map(([sme, data]) => ({ sme, responses: data.responses, averageScore: round(average(data.scores), 2) }))
      .filter((row) => Number.isFinite(row.averageScore) && row.averageScore > 0)
      .sort((a, b) => b.responses - a.responses || a.sme.localeCompare(b.sme)),
    byInstructionalDesigner: Object.entries(byInstructionalDesigner)
      .map(([instructionalDesigner, data]) => ({
        instructionalDesigner,
        responses: data.responses,
        averageRating: round(average(data.ratings), 2),
        averagePromoter: round(average(data.promoters), 2),
      }))
      .sort((a, b) => b.responses - a.responses || a.instructionalDesigner.localeCompare(b.instructionalDesigner)),
    byReportingYear: Object.entries(byReportingYear)
      .map(([reportingYear, responses]) => ({ reportingYear, responses }))
      .sort((a, b) => compareYearLabel(a.reportingYear, b.reportingYear)),
    byProject: Object.entries(byProject)
      .map(([projectKey, responses]) => {
        const project = projectMap.get(projectKey);
        return {
          projectKey,
          projectName: project?.raw_course_name || projectKey,
          reportingYear: project?.reporting_year || "Unknown",
          responses,
        };
      })
      .sort((a, b) => b.responses - a.responses || a.projectName.localeCompare(b.projectName)),
    matchedResponses: filteredMatchedResponses,
    matchedResponseFilterOptions,
    sourceVerification: {
      instructionalDesignerBreakdown: "smeFeedbackIdView",
      smeExperienceBreakdown: "smeFeedbackSmeView",
    },
  };
}

export function selectExternalTeamsModel(snapshot: AnalyticsSnapshot, filters: ExternalTeamsFilters = {}) {
  const projectMap = buildProjectMap(snapshot);
  const workEntityMap = buildWorkEntityMap(snapshot);
  const externalRows = snapshot.timeLogs.filter((row) =>
    row.role_group === "Legal" ||
    row.role_group === "Other/External" ||
    row.work_entity_type === "standalone_course" ||
    row.work_entity_type === "operational_work",
  ).filter((row) =>
    matchesSelected(filters.roleGroups, row.role_group) &&
    matchesSelected(filters.phases, row.category_phase) &&
    matchesSelected(filters.classifications, getExternalWorkClassification(row)) &&
    matchesSelected(filters.reportingYears, getTimeLogReportingYear(row, projectMap, workEntityMap) || "Unknown") &&
    matchesSelected(filters.users, row.canonical_user_name || "Unknown"),
  );

  const hoursByExternalRoleGroup = buildHoursSeries(
    externalRows.map((row) => ({
      key:
        row.work_entity_type === "standalone_course"
          ? WORK_SCOPE_LABELS.standalone_work
          : row.work_entity_type === "operational_work"
            ? WORK_SCOPE_LABELS.non_project_work
            : row.role_group,
      minutes: row.minutes,
    })),
  ).map(([roleGroup, hours]) => ({ roleGroup, hours: round(hours, 1) }));

  const hoursByCategoryPhase = buildHoursSeries(
    externalRows.map((row) => ({ key: row.category_phase, minutes: row.minutes })),
  ).map(([phase, hours]) => ({ phase, hours: round(hours, 1) }));

  const topWorkItems = buildHoursSeries(
    externalRows.map((row) => ({
      key: row.normalized_course_name || row.raw_course_name,
      minutes: row.minutes,
    })),
  )
    .map(([workItem, hours]) => ({ workItem, hours: round(hours, 1) }))
    .slice(0, 20);

  const usersByHours = buildHoursSeries(
    externalRows.map((row) => ({ key: row.canonical_user_name || "Unknown", minutes: row.minutes })),
  ).map(([user, hours]) => ({ user, hours: round(hours, 1) }));

  return {
    hoursByExternalRoleGroup,
    hoursByCategoryPhase,
    topWorkItems,
    usersByHours,
  };
}

export function selectProjectsPageRows(snapshot: AnalyticsSnapshot) {
  return snapshot.canonicalProjects.map((project) => ({
    projectKey: project.project_key,
    projectName: project.raw_course_name,
    rawCourseName: project.raw_course_name,
    projectHref: buildProjectDetailPath(project),
    reportingYear: project.reporting_year || "Unknown",
    sourceDataset: project.source_dataset,
    status: project.status,
    projectTotalHours: round(project.project_total_minutes / 60, 2),
    timeLogHours: round(project.time_log_minutes_sum / 60, 2),
    hoursDiscrepancyFlag: project.hours_discrepancy_flag,
    idAssignedRaw: project.id_assigned_raw,
    ownerNames: project.owner_names,
    smeAssignedRaw: project.sme_assigned_raw,
    legalReviewerRaw: project.legal_reviewer_raw,
    primaryVertical: project.primary_vertical || "Unknown",
    verticals: project.verticals,
    fullVerticalList: project.verticals.join(", "),
    courseType: project.course_type || "Unknown",
    authoringTool: project.authoring_tool || "Unknown",
    courseStyle: project.course_style || "Unknown",
    courseLengthRaw: project.course_length_raw || "Unknown",
    interactionCount: project.interaction_count,
    latestTimeLogDate: project.latest_time_log_date,
    unresolvedSmeFeedbackCount: project.unresolved_sme_feedback_count,
    hasTimeLogs: project.time_log_minutes_sum > 0,
    hasSmeFeedback:
      project.unresolved_sme_feedback_count > 0 ||
      snapshot.smeJoinAudit.some((row) => row.matched_project_key === project.project_key),
  }));
}

export function selectProjectDetailModel(snapshot: AnalyticsSnapshot, projectKey: string) {
  const project = snapshot.canonicalProjects.find((entry) => entry.project_key === projectKey);
  if (!project) return null;

  const matchedTimeLogs = snapshot.timeLogs.filter((row) => row.matched_project_key === projectKey);
  const phaseBreakdown = buildHoursSeries(
    matchedTimeLogs.map((row) => ({ key: row.category_phase, minutes: row.minutes })),
  ).map(([phase, hours]) => ({ phase, hours: round(hours, 1) }));

  const dailyTimeline = Object.entries(
    matchedTimeLogs.reduce<Record<string, number>>((acc, row) => {
      if (!row.log_date) return acc;
      acc[row.log_date] = (acc[row.log_date] || 0) + (row.minutes ?? 0) / 60;
      return acc;
    }, {}),
  )
    .map(([date, hours]) => ({ date, label: date, hours: round(hours, 2) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const timelinePoints = dailyTimeline.length > 45
    ? Object.entries(
        dailyTimeline.reduce<Record<string, number>>((acc, row) => {
          const weekStart = format(startOfWeek(parseISO(row.date), { weekStartsOn: 1 }), "yyyy-MM-dd");
          acc[weekStart] = (acc[weekStart] || 0) + row.hours;
          return acc;
        }, {}),
      )
        .map(([date, hours]) => ({ date, label: date, hours: round(hours, 2) }))
        .sort((a, b) => a.date.localeCompare(b.date))
    : dailyTimeline;

  const idFeedback = snapshot.smeFeedbackIdView.filter((row) => row.matched_project_key === projectKey);
  const smeFeedback = snapshot.smeFeedbackSmeView.filter((row) => row.matched_project_key === projectKey);
  const overallRatings = idFeedback
    .map((row) => row.overall_collaboration_rating)
    .filter((value): value is number => value !== null);
  const promoterScores = idFeedback
    .map((row) => row.promoter_score)
    .filter((value): value is number => value !== null);
  const smeScores = smeFeedback.flatMap((row) =>
    [
      row.overall_experience_with_lexipol,
      row.clarity_of_goals_and_objectives,
      row.staff_responsiveness,
      row.adequacy_of_tools_and_resources,
      row.training_and_support_provided,
      row.use_of_my_expertise,
      row.incorporation_of_my_feedback,
      row.autonomy_in_course_design,
      row.feeling_valued_as_an_sme,
      row.likelihood_to_recommend_lexipol,
    ].filter((value): value is number => value !== null),
  );

  const percentileRank = snapshot.canonicalProjects.length
    ? round(
        (snapshot.canonicalProjects.filter((entry) => entry.project_total_minutes <= project.project_total_minutes).length /
          snapshot.canonicalProjects.length) *
          100,
        1,
      )
    : 0;

  const similarProjects = snapshot.canonicalProjects
    .filter((entry) => entry.project_key !== projectKey)
    .sort(
      (a, b) =>
        Math.abs(a.project_total_minutes - project.project_total_minutes) -
          Math.abs(b.project_total_minutes - project.project_total_minutes) ||
        a.raw_course_name.localeCompare(b.raw_course_name),
    )
    .slice(0, 10)
    .map((entry) => ({
      ...toProjectDisplay(entry),
      projectTotalHours: round(entry.project_total_minutes / 60, 1),
    }));

  return {
    projectKey,
    projectName: project.raw_course_name,
    reportingYear: project.reporting_year || "Unknown",
    overview: {
      sourceDataset: project.source_dataset,
      status: project.status,
      owners: project.owner_names,
      smeAssigned: project.sme_assigned_raw,
      legalReviewer: project.legal_reviewer_raw,
      verticals: project.verticals,
      courseType: project.course_type || "Unknown",
      authoringTool: project.authoring_tool || "Unknown",
      courseStyle: project.course_style || "Unknown",
      courseLengthRaw: project.course_length_raw || "Unknown",
      interactionCount: project.interaction_count,
      latestTimeLogDate: project.latest_time_log_date,
    },
    hoursSummary: {
      projectHours: round(project.project_total_minutes / 60, 1),
      loggedHours: round(project.time_log_minutes_sum / 60, 1),
      discrepancyHours: round(project.hours_discrepancy_minutes / 60, 1),
      discrepancyFlag: project.hours_discrepancy_flag,
    },
    phaseBreakdown,
    timeline: {
      granularity: dailyTimeline.length > 45 ? "weekly" : "daily",
      points: timelinePoints,
    },
    smeFeedback: {
      idResponseCount: idFeedback.length,
      smeResponseCount: smeFeedback.length,
      averageOverallCollaborationRating: round(average(overallRatings), 2),
      averagePromoterScore: round(average(promoterScores), 2),
      averageSmeSatisfaction: round(average(smeScores), 2),
      designerComments: idFeedback
        .filter((row) => row.additional_comments)
        .map((row) => ({
          date: row.id_survey_date,
          author: row.instructional_designer || "Unknown ID",
          comment: row.additional_comments,
        })),
      smeResponses: smeFeedback
        .filter((row) => row.additional_feedback_or_suggestions)
        .map((row) => ({
          date: row.sme_survey_date,
          author: row.sme || "Unknown SME",
          comment: row.additional_feedback_or_suggestions,
        })),
    },
    comparison: {
      percentileRank,
      similarProjects,
    },
  };
}

export function selectPersonDetailModel(snapshot: AnalyticsSnapshot, canonicalName: string) {
  const personName = normalizePersonName(canonicalName);
  if (!personName) return null;

  const projectMap = buildProjectMap(snapshot);
  const personRoles = new Set<string>();
  const personRow = snapshot.dimPerson.find((row) => matchesCanonicalPerson(personName, row.canonical_name));

  personRow?.role_groups.forEach((role) => personRoles.add(role));

  const idAssignedProjects = snapshot.canonicalProjects.filter((project) =>
    matchesCanonicalPersonInList(personName, project.owner_names),
  );
  if (idAssignedProjects.length) personRoles.add("ID");

  const smeAssignedProjects = snapshot.canonicalProjects.filter((project) =>
    matchesCanonicalPersonInList(personName, splitMultiValueField(project.sme_assigned_raw)),
  );
  if (smeAssignedProjects.length) personRoles.add("SME");

  const idSurveyRows = snapshot.smeFeedbackIdView.filter((row) =>
    matchesCanonicalPerson(personName, row.instructional_designer),
  );
  if (idSurveyRows.length) personRoles.add("ID");

  const smeExperienceRowsForId = snapshot.smeFeedbackSmeView.filter((row) =>
    matchesCanonicalPerson(personName, row.instructional_designer),
  );
  if (smeExperienceRowsForId.length) personRoles.add("ID");

  const idRatingsForSme = snapshot.smeFeedbackIdView.filter((row) =>
    matchesCanonicalPerson(personName, row.sme),
  );
  if (idRatingsForSme.length) personRoles.add("SME");

  const smeSurveyRows = snapshot.smeFeedbackSmeView.filter((row) =>
    matchesCanonicalPerson(personName, row.sme),
  );
  if (smeSurveyRows.length) personRoles.add("SME");

  const timeLogs = snapshot.timeLogs.filter((row) =>
    matchesCanonicalPerson(personName, row.canonical_user_name) &&
    (row.role_group === "ID" || row.role_group === "SME"),
  );
  timeLogs.forEach((row) => personRoles.add(row.role_group));

  const ownedProjectKeys = new Set(idAssignedProjects.map((project) => project.project_key));
  const ownedProjectTimeLogs = snapshot.timeLogs.filter((row) => row.matched_project_key && ownedProjectKeys.has(row.matched_project_key));
  const ownedProjectLoggedHours = round(ownedProjectTimeLogs.reduce((sum, row) => sum + (row.minutes ?? 0) / 60, 0), 1);

  const ownedProjectsWithParsedLength = idAssignedProjects
    .map((project) => ({
      project,
      courseLengthMinutes: parseDurationToMinutes(project.course_length_raw),
    }))
    .filter((row) => row.courseLengthMinutes > 0);

  const developmentHoursPerContentHour = ownedProjectsWithParsedLength.length
    ? round(
        ownedProjectsWithParsedLength.reduce((sum, row) => {
          const loggedHours = snapshot.timeLogs
            .filter((timeLog) => timeLog.matched_project_key === row.project.project_key)
            .reduce((timeLogSum, timeLog) => timeLogSum + (timeLog.minutes ?? 0) / 60, 0);
          const contentHours = row.courseLengthMinutes / 60;
          return sum + (contentHours > 0 ? loggedHours / contentHours : 0);
        }, 0) / ownedProjectsWithParsedLength.length,
        2,
      )
    : null;

  const idStatusBreakdown = buildCountSeries(idAssignedProjects.map((project) => project.status))
    .map(([status, count]) => ({ status, count }));
  const idPhaseBreakdown = buildHoursSeries(
    ownedProjectTimeLogs.map((row) => ({ key: row.category_phase, minutes: row.minutes })),
  ).map(([phase, hours]) => ({ phase, hours: round(hours, 1) }));

  const internalValues = uniqueSorted(smeSurveyRows.map((row) => getSmeInternalLabel(row.internal)));
  const internalStatus = internalValues.length > 1
    ? "Mixed"
    : internalValues[0] || "Unknown";

  const smeMatchedProjectKeys = new Set<string>();
  smeAssignedProjects.forEach((project) => smeMatchedProjectKeys.add(project.project_key));
  idRatingsForSme.forEach((row) => {
    if (row.matched_project_key) smeMatchedProjectKeys.add(row.matched_project_key);
  });
  smeSurveyRows.forEach((row) => {
    if (row.matched_project_key) smeMatchedProjectKeys.add(row.matched_project_key);
  });
  timeLogs
    .filter((row) => row.role_group === "SME" && row.matched_project_key)
    .forEach((row) => smeMatchedProjectKeys.add(row.matched_project_key!));

  const contributedProjects = [...smeMatchedProjectKeys]
    .map((projectKey) => projectMap.get(projectKey))
    .filter((project): project is CanonicalProject => Boolean(project))
    .sort((a, b) => compareYearLabel(b.reporting_year, a.reporting_year) || a.raw_course_name.localeCompare(b.raw_course_name));

  const contributedProjectHours = round(
    timeLogs
      .filter((row) => row.role_group === "SME" && row.matched_project_key)
      .reduce((sum, row) => sum + (row.minutes ?? 0) / 60, 0),
    1,
  );

  const recentProjectsMap = new Map<string, { project: CanonicalProject; relationships: Set<string> }>();

  idAssignedProjects.forEach((project) => {
    recentProjectsMap.set(project.project_key, {
      project,
      relationships: new Set(["Assigned ID"]),
    });
  });

  const markRelationship = (projectKey: string | null, relationship: string) => {
    if (!projectKey) return;
    const project = projectMap.get(projectKey);
    if (!project) return;

    const current = recentProjectsMap.get(projectKey);
    if (current) {
      current.relationships.add(relationship);
      return;
    }

    recentProjectsMap.set(projectKey, {
      project,
      relationships: new Set([relationship]),
    });
  };

  smeAssignedProjects.forEach((project) => markRelationship(project.project_key, "Assigned SME"));
  idSurveyRows.forEach((row) => markRelationship(row.matched_project_key, "ID Survey"));
  smeExperienceRowsForId.forEach((row) => markRelationship(row.matched_project_key, "SME Feedback"));
  idRatingsForSme.forEach((row) => markRelationship(row.matched_project_key, "ID Evaluation"));
  smeSurveyRows.forEach((row) => markRelationship(row.matched_project_key, "SME Survey"));
  timeLogs.forEach((row) => markRelationship(row.matched_project_key, `${row.role_group} Time Logs`));

  const recentProjects = [...recentProjectsMap.values()]
    .map(({ project, relationships }) => ({
      ...toProjectDisplay(project),
      status: project.status,
      relationships: [...relationships].sort((a, b) => a.localeCompare(b)),
      projectHours: round(project.project_total_minutes / 60, 1),
      loggedHours: round(project.time_log_minutes_sum / 60, 1),
    }))
    .sort((a, b) => compareYearLabel(b.reportingYear, a.reportingYear) || a.projectName.localeCompare(b.projectName));

  const smeExperienceScores = smeExperienceRowsForId.flatMap((row) =>
    [
      row.overall_experience_with_lexipol,
      row.clarity_of_goals_and_objectives,
      row.staff_responsiveness,
      row.adequacy_of_tools_and_resources,
      row.training_and_support_provided,
      row.use_of_my_expertise,
      row.incorporation_of_my_feedback,
      row.autonomy_in_course_design,
      row.feeling_valued_as_an_sme,
      row.likelihood_to_recommend_lexipol,
    ].filter((value): value is number => value !== null),
  );

  const idRatingScores = idRatingsForSme
    .map((row) => row.overall_collaboration_rating)
    .filter((value): value is number => value !== null);
  const idPromoterScores = idRatingsForSme
    .map((row) => row.promoter_score)
    .filter((value): value is number => value !== null);

  return {
    canonicalName: personName,
    roles: [...personRoles].sort((a, b) => a.localeCompare(b)),
    overview: {
      assignedProjects: idAssignedProjects.length,
      contributedProjects: recentProjects.length,
      activeProjects: idAssignedProjects.filter(isProjectActive).length,
      completedProjects: idAssignedProjects.filter((project) => !isProjectActive(project)).length,
      idSurveyCount: idSurveyRows.length,
      smeSurveyCount: smeSurveyRows.length,
      internalStatus,
      recentProjects: recentProjects.slice(0, 12),
      observedNames: personRow?.observed_raw_names || [personName],
    },
    idView: {
      assignedProjectCount: idAssignedProjects.length,
      activeProjectCount: idAssignedProjects.filter(isProjectActive).length,
      completedProjectCount: idAssignedProjects.filter((project) => !isProjectActive(project)).length,
      matchedLoggedHoursOnOwnedProjects: ownedProjectLoggedHours,
      developmentHoursPerContentHour,
      idSurveyCount: idSurveyRows.length,
      smeExperienceSurveyCount: smeExperienceRowsForId.length,
      averageSmeExperienceScore: round(average(smeExperienceScores), 2),
      averageSmeRecommendScore: round(
        average(
          smeExperienceRowsForId
            .map((row) => row.likelihood_to_recommend_lexipol)
            .filter((value): value is number => value !== null),
        ),
        2,
      ),
      statusBreakdown: idStatusBreakdown,
      phaseBreakdown: idPhaseBreakdown,
      ownedProjects: idAssignedProjects
        .map((project) => ({
          ...toProjectDisplay(project),
          projectHours: round(project.project_total_minutes / 60, 1),
          loggedHours: round(project.time_log_minutes_sum / 60, 1),
        }))
        .sort((a, b) => compareYearLabel(b.reportingYear, a.reportingYear) || a.projectName.localeCompare(b.projectName)),
      feedbackRows: smeExperienceRowsForId.map((row) => ({
        rawSmeFeedbackRowId: row.raw_sme_feedback_row_id,
        projectKey: row.matched_project_key,
        projectName: row.matched_project_key ? projectMap.get(row.matched_project_key)?.raw_course_name || row.course_name_raw : row.course_name_raw,
        reportingYear: row.reporting_year || "Unknown",
        sme: row.sme,
        surveyDate: row.sme_survey_date,
        averageScore: round(
          average(
            [
              row.overall_experience_with_lexipol,
              row.clarity_of_goals_and_objectives,
              row.staff_responsiveness,
              row.adequacy_of_tools_and_resources,
              row.training_and_support_provided,
              row.use_of_my_expertise,
              row.incorporation_of_my_feedback,
              row.autonomy_in_course_design,
              row.feeling_valued_as_an_sme,
              row.likelihood_to_recommend_lexipol,
            ].filter((value): value is number => value !== null),
          ),
          2,
        ),
        comment: row.additional_feedback_or_suggestions,
      })),
    },
    smeView: {
      internalStatus,
      surveyCount: smeSurveyRows.length,
      evaluationCount: idRatingsForSme.length,
      contributedProjectCount: contributedProjects.length,
      matchedProjectHours: contributedProjectHours,
      hoursWorked: round(
        smeSurveyRows.reduce((sum, row) => sum + (row.hours_worked ?? 0), 0),
        1,
      ),
      amountBilled: round(
        smeSurveyRows.reduce((sum, row) => sum + (row.amount_billed ?? 0), 0),
        1,
      ),
      averageLexipolExperienceScore: round(
        average(
          smeSurveyRows.flatMap((row) =>
            [
              row.overall_experience_with_lexipol,
              row.clarity_of_goals_and_objectives,
              row.staff_responsiveness,
              row.adequacy_of_tools_and_resources,
              row.training_and_support_provided,
              row.use_of_my_expertise,
              row.incorporation_of_my_feedback,
              row.autonomy_in_course_design,
              row.feeling_valued_as_an_sme,
              row.likelihood_to_recommend_lexipol,
            ].filter((value): value is number => value !== null),
          ),
        ),
        2,
      ),
      averageIdEvaluationScore: round(average(idRatingScores), 2),
      averageIdPromoterScore: round(average(idPromoterScores), 2),
      contributedProjects: contributedProjects.map((project) => ({
        ...toProjectDisplay(project),
        projectHours: round(project.project_total_minutes / 60, 1),
        loggedHours: round(project.time_log_minutes_sum / 60, 1),
      })),
      surveyRows: smeSurveyRows.map((row) => ({
        rawSmeFeedbackRowId: row.raw_sme_feedback_row_id,
        projectKey: row.matched_project_key,
        projectName: row.matched_project_key ? projectMap.get(row.matched_project_key)?.raw_course_name || row.course_name_raw : row.course_name_raw,
        reportingYear: row.reporting_year || "Unknown",
        instructionalDesigner: row.instructional_designer,
        surveyDate: row.sme_survey_date,
        internal: getSmeInternalLabel(row.internal),
        hoursWorked: row.hours_worked,
        amountBilled: row.amount_billed,
        comment: row.additional_feedback_or_suggestions,
      })),
      evaluationRows: idRatingsForSme.map((row) => ({
        rawSmeFeedbackRowId: row.raw_sme_feedback_row_id,
        projectKey: row.matched_project_key,
        projectName: row.matched_project_key ? projectMap.get(row.matched_project_key)?.raw_course_name || row.course_name_raw : row.course_name_raw,
        reportingYear: row.reporting_year || "Unknown",
        instructionalDesigner: row.instructional_designer,
        surveyDate: row.id_survey_date,
        overallRating: row.overall_collaboration_rating,
        promoterScore: row.promoter_score,
        comment: row.additional_comments,
      })),
    },
  };
}

function buildGroupedTimeLogRows(snapshot: AnalyticsSnapshot, rows: TimeLogMatchAuditRow[]) {
  const projectMap = buildProjectMap(snapshot);
  const timeLogById = new Map(snapshot.timeLogs.map((row) => [row.raw_time_log_row_id, row]));
  const grouped = new Map<string, {
    groupKey: string;
    title: string;
    normalizedTitle: string;
    rowCount: number;
    totalMinutes: number;
    years: Set<string>;
    rows: Array<TimeLogMatchAuditRow & { hours: number; logDate: string | null; user: string; roleGroup: RoleGroup }>;
    suggestions: Map<string, { projectKey: string; count: number; score: number; confidence: "high" | "medium"; candidateTitle: string }>;
  }>();

  rows.forEach((row) => {
    const key = row.normalized_course_name || row.raw_course_name;
    const timeLog = timeLogById.get(row.raw_time_log_row_id);
    if (!grouped.has(key)) {
      grouped.set(key, {
        groupKey: key,
        title: row.raw_course_name,
        normalizedTitle: row.normalized_course_name,
        rowCount: 0,
        totalMinutes: 0,
        years: new Set<string>(),
        rows: [],
        suggestions: new Map(),
      });
    }

    const group = grouped.get(key)!;
    group.rowCount += 1;
    group.totalMinutes += timeLog?.minutes ?? 0;
    if (row.inferred_reporting_year) group.years.add(row.inferred_reporting_year);
    group.rows.push({
      ...row,
      hours: round((timeLog?.minutes ?? 0) / 60, 2),
      logDate: timeLog?.log_date ?? null,
      user: timeLog?.canonical_user_name || timeLog?.raw_user || "Unknown",
      roleGroup: timeLog?.role_group || "Other/External",
    });

    if (row.suggestion) {
      const current = group.suggestions.get(row.suggestion.target_project_key);
      group.suggestions.set(row.suggestion.target_project_key, {
        projectKey: row.suggestion.target_project_key,
        count: (current?.count || 0) + 1,
        score: Math.max(current?.score || 0, row.suggestion.score),
        confidence: row.suggestion.confidence,
        candidateTitle: row.suggestion.candidate_title,
      });
    }
  });

  return [...grouped.values()]
    .map((group) => {
      const topSuggestion = [...group.suggestions.values()]
        .sort((a, b) => b.count - a.count || b.score - a.score || a.candidateTitle.localeCompare(b.candidateTitle))[0];
      const suggestionProject = topSuggestion ? projectMap.get(topSuggestion.projectKey) : null;

      return {
        groupKey: group.groupKey,
        title: group.title,
        normalizedTitle: group.normalizedTitle,
        rowCount: group.rowCount,
        totalHours: round(group.totalMinutes / 60, 2),
        years: [...group.years].sort(compareYearLabel),
        rows: group.rows.sort((a, b) => (a.logDate || "").localeCompare(b.logDate || "") || a.raw_course_name.localeCompare(b.raw_course_name)),
        topSuggestion: topSuggestion
          ? {
              projectKey: topSuggestion.projectKey,
              projectName: suggestionProject?.raw_course_name || topSuggestion.candidateTitle,
              reportingYear: suggestionProject?.reporting_year || "Unknown",
              confidence: topSuggestion.confidence,
            }
          : null,
      };
    })
    .sort((a, b) => b.totalHours - a.totalHours || a.title.localeCompare(b.title));
}

function suggestSmeProject(snapshot: AnalyticsSnapshot, row: AnalyticsSnapshot["smeJoinAudit"][number]) {
  if (row.candidate_project_keys.length === 1) {
    const project = snapshot.canonicalProjects.find((entry) => entry.project_key === row.candidate_project_keys[0]);
    return project
      ? { projectKey: project.project_key, projectName: project.raw_course_name, reportingYear: project.reporting_year || "Unknown", confidence: (row.join_confidence || "high") as JoinConfidence }
      : null;
  }

  const rankedCandidates = row.candidate_project_keys
    .map((projectKey) => snapshot.canonicalProjects.find((entry) => entry.project_key === projectKey))
    .filter((project): project is CanonicalProject => Boolean(project))
    .map((project) => ({
      project,
      score: similarityScore(compactCourseName(row.course_name_raw), project.compact_course_name),
    }))
    .sort((a, b) => b.score - a.score || a.project.raw_course_name.localeCompare(b.project.raw_course_name));

  const best = rankedCandidates[0];
  const nextBest = rankedCandidates[1];
  if (!best) return null;

  const confidence: JoinConfidence | null =
    best.score >= 0.93 && (!nextBest || best.score - nextBest.score >= 0.05)
      ? "high"
      : best.score >= 0.7
        ? "medium"
        : null;

  if (!confidence) return null;

  return {
    projectKey: best.project.project_key,
    projectName: best.project.raw_course_name,
    reportingYear: best.project.reporting_year || "Unknown",
    confidence,
  };
}

export function selectGroupedReconciliationModel(snapshot: AnalyticsSnapshot) {
  const duplicateProjects = snapshot.projectDuplicateAudit.map((row) => {
    const project = snapshot.canonicalProjects.find((entry) => entry.project_key === row.project_key);
    return {
      ...row,
      projectName: project?.raw_course_name || row.project_key,
      reportingYear: project?.reporting_year || "Unknown",
    };
  });

  const discrepancyFlags = snapshot.canonicalProjects
    .filter((project) => project.hours_discrepancy_flag)
    .map((project) => ({
      projectKey: project.project_key,
      projectName: project.raw_course_name,
      reportingYear: project.reporting_year || "Unknown",
      projectHours: round(project.project_total_minutes / 60, 1),
      loggedHours: round(project.time_log_minutes_sum / 60, 1),
      discrepancyHours: round(project.hours_discrepancy_minutes / 60, 1),
    }));

  const smeJoinRows = [...snapshot.smeJoinAudit.filter((row) => row.join_status === "unresolved"), ...snapshot.smeJoinAudit.filter((row) => row.join_status === "ambiguous")]
    .map((row) => ({
      ...row,
      suggestedProject: suggestSmeProject(snapshot, row),
    }));

  return {
    timeLogGroups: buildGroupedTimeLogRows(
      snapshot,
      snapshot.timeLogMatchAudit.filter((row) => row.work_match_status === "reconcilable_unmatched"),
    ),
    standaloneGroups: buildGroupedTimeLogRows(
      snapshot,
      snapshot.timeLogMatchAudit.filter((row) => row.work_match_status === "standalone_video_course"),
    ),
    nonProjectGroups: buildGroupedTimeLogRows(
      snapshot,
      snapshot.timeLogMatchAudit.filter((row) => row.work_match_status === "non_project_work"),
    ),
    smeJoinRows,
    duplicateProjects,
    aliasUsage: snapshot.courseAliasConfig,
    personAliases: snapshot.personAliasConfig,
    personRoleOverrides: snapshot.personRoleConfig,
    discrepancyFlags,
    syntheticWorkEntities: snapshot.dimWorkEntity.filter((entity) => entity.created_from_time_logs),
  };
}

export function selectReconciliationModel(snapshot: AnalyticsSnapshot) {
  return {
    duplicateProjects: snapshot.projectDuplicateAudit,
    unresolvedSmeJoins: snapshot.smeJoinAudit.filter((row) => row.join_status === "unresolved"),
    ambiguousSmeJoins: snapshot.smeJoinAudit.filter((row) => row.join_status === "ambiguous"),
    unmatchedOrReconcilableTimeLogs: snapshot.timeLogMatchAudit.filter((row) => row.work_match_status === "reconcilable_unmatched"),
    standaloneCourseCandidates: snapshot.timeLogMatchAudit.filter((row) => row.work_match_status === "standalone_video_course"),
    nonProjectWorkCandidates: snapshot.timeLogMatchAudit.filter((row) => row.work_match_status === "non_project_work"),
    aliasUsage: snapshot.courseAliasConfig,
    personAliases: snapshot.personAliasConfig,
    personRoleOverrides: snapshot.personRoleConfig,
    discrepancyFlags: snapshot.canonicalProjects.filter((project) => project.hours_discrepancy_flag),
    syntheticWorkEntities: snapshot.dimWorkEntity.filter((entity) => entity.created_from_time_logs),
  };
}
