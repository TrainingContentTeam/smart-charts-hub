import { format, parseISO, startOfWeek } from "date-fns";
import { FINALIZED_PROJECT_STATUSES, PROJECT_STATUS_RANKS } from "@/lib/analytics/constants";
import { EXTERNAL_WORK_CLASSIFICATION_LABELS, SME_QUESTION_LABELS, WORK_SCOPE_LABELS } from "@/lib/analytics/labels";
import { compactCourseName, normalizePersonName, parseDurationToMinutes, splitMultiValueField } from "@/lib/analytics/normalization";
import { buildProjectDetailPath } from "@/lib/analytics/project-routing";
import type {
  AnalyticsSnapshot,
  CanonicalProject,
  JoinConfidence,
  RoleGroup,
  SmeIdFeedbackRow,
  SmeSmeFeedbackRow,
  TimeLogMatchAuditRow,
  TimeLogRow,
} from "@/lib/analytics/types";

type DashboardWorkScope = keyof typeof WORK_SCOPE_LABELS;
type ExternalWorkClassification = keyof typeof EXTERNAL_WORK_CLASSIFICATION_LABELS;
type ProjectChartFilters = {
  reportingYears?: string[];
  owners?: string[];
  authoringTools?: string[];
  courseTypes?: string[];
  statuses?: string[];
};
type TimeLogChartFilters = {
  reportingYears?: string[];
  phases?: string[];
  roleGroups?: string[];
  users?: string[];
  startDate?: string | null;
  endDate?: string | null;
};

export type DashboardChartFilters = {
  projectsByReportingYear?: {
    reportingYears?: string[];
    owners?: string[];
    statuses?: string[];
    courseTypes?: string[];
    authoringTools?: string[];
  };
  activeProjectsByStatus?: {
    reportingYears?: string[];
    owners?: string[];
    authoringTools?: string[];
  };
  activeProjectStatusMix?: {
    reportingYears?: string[];
    owners?: string[];
    authoringTools?: string[];
  };
  projectMixByCourseType?: {
    reportingYears?: string[];
    owners?: string[];
    authoringTools?: string[];
    statuses?: string[];
  };
  projectMixByAuthoringTool?: {
    reportingYears?: string[];
    owners?: string[];
    authoringTools?: string[];
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
  matrix?: SmeSurveyChartFilters;
  responsesByReportingYear?: SmeSurveyChartFilters;
  smeCourseSurveyCoverage?: SmeSurveyChartFilters;
  idCourseSurveyCoverage?: SmeSurveyChartFilters;
  byInstructionalDesigner?: {
    smes?: string[];
    reportingYears?: string[];
    startDate?: string | null;
    endDate?: string | null;
  };
  bySme?: {
    internalValues?: string[];
    instructionalDesigners?: string[];
    reportingYears?: string[];
    startDate?: string | null;
    endDate?: string | null;
  };
  matchedResponses?: SmeMatchedResponseFilters;
};

export type ExternalTeamsChartFilters = {
  roleGroups?: string[];
  phases?: string[];
  classifications?: ExternalWorkClassification[];
  reportingYears?: string[];
  users?: string[];
};

export type ExternalTeamsFilters = ExternalTeamsChartFilters;

export type DevelopmentChartFilters = {
  activeProjectsByStatus?: ProjectChartFilters;
  activeProjectsByIdOwner?: ProjectChartFilters;
  developmentHoursByPhase?: ProjectChartFilters & { roleGroups?: string[] };
  activeProjectsByAuthoringTool?: ProjectChartFilters;
  activeProjectsByCourseType?: ProjectChartFilters;
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

export type AdminDevelopmentAnalyticsFilters = {
  reportingYears?: string[];
  assignedIds?: string[];
  rawCategories?: string[];
  statuses?: string[];
};

export type SmeMatchedResponseFilters = {
  instructionalDesigners?: string[];
  smes?: string[];
  reportingYears?: string[];
  internalValues?: string[];
  startDate?: string | null;
  endDate?: string | null;
};

export type SmeSurveyChartFilters = {
  internalValues?: string[];
  instructionalDesigners?: string[];
  smes?: string[];
  reportingYears?: string[];
  startDate?: string | null;
  endDate?: string | null;
};

export type ProjectDetailOptions = {
  phaseBreakdown?: TimeLogChartFilters;
  timeline?: TimeLogChartFilters;
};

export type PersonDetailOptions = {
  idStatusBreakdown?: ProjectChartFilters;
  idPhaseBreakdown?: ProjectChartFilters & { roleGroups?: string[] };
};

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function averageableSmeExperienceScores(row: SmeSmeFeedbackRow) {
  return [
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
}

function averageableIdEvaluationScores(row: SmeIdFeedbackRow) {
  return [
    row.overall_collaboration_rating,
    row.sme_knowledge_and_expertise,
    row.responsiveness,
    row.instructional_design_knowledge,
    row.contribution_to_development,
    row.openness_to_suggestions,
    row.deadlines_and_schedule,
    row.overall_quality_end_product,
    row.sme_assistance_in_interactions,
  ].filter((value): value is number => value !== null);
}

function labelOrUnknown(value: string | null | undefined) {
  return value || "Unknown";
}

function matchesSelected(selected: string[] | undefined, value: string) {
  return !selected?.length || selected.includes(value);
}

function matchesProjectChartFilters(
  project: CanonicalProject,
  filters: ProjectChartFilters | undefined,
) {
  return (
    matchesSelected(filters?.reportingYears, project.reporting_year || "Unknown") &&
    matchesSelected(filters?.owners, project.primary_id_assigned || "Unassigned") &&
    matchesSelected(filters?.authoringTools, labelOrUnknown(project.authoring_tool)) &&
    matchesSelected(filters?.courseTypes, labelOrUnknown(project.course_type)) &&
    matchesSelected(filters?.statuses, project.status)
  );
}

function matchesTimeLogChartFilters(
  row: TimeLogRow,
  filters: TimeLogChartFilters | undefined,
  projectMap: Map<string, CanonicalProject>,
  workEntityMap: Map<string, AnalyticsSnapshot["dimWorkEntity"][number]>,
) {
  return (
    matchesSelected(filters?.reportingYears, getTimeLogReportingYear(row, projectMap, workEntityMap) || "Unknown") &&
    matchesSelected(filters?.phases, row.category_phase) &&
    matchesSelected(filters?.roleGroups, row.role_group) &&
    matchesSelected(filters?.users, row.canonical_user_name || "Unknown") &&
    (!filters?.startDate && !filters?.endDate ? true : inDateRange(row.log_date, filters.startDate, filters.endDate))
  );
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
    matchesProjectChartFilters(project, filters.projectsByReportingYear) &&
    matchesSelected(filters.projectsByReportingYear?.statuses, project.status) &&
    matchesSelected(filters.projectsByReportingYear?.courseTypes, labelOrUnknown(project.course_type)) &&
    matchesSelected(filters.projectsByReportingYear?.authoringTools, labelOrUnknown(project.authoring_tool)),
  );

  const activeProjectsByStatusSource = activeProjects.filter((project) =>
    matchesProjectChartFilters(project, filters.activeProjectsByStatus),
  );

  const activeProjectStatusMixSource = activeProjects.filter((project) =>
    matchesProjectChartFilters(project, filters.activeProjectStatusMix),
  );

  const projectMixByCourseTypeSource = snapshot.canonicalProjects.filter((project) =>
    matchesProjectChartFilters(project, filters.projectMixByCourseType) &&
    matchesSelected(filters.projectMixByCourseType?.statuses, project.status),
  );

  const projectMixByAuthoringToolSource = snapshot.canonicalProjects.filter((project) =>
    matchesProjectChartFilters(project, filters.projectMixByAuthoringTool) &&
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

  const averageDevelopmentTimeByYear = Array.from(
    snapshot.canonicalProjects
      .filter((project) => project.project_total_minutes > 0)
      .reduce<Map<string, { totalMinutes: number; courseCount: number }>>((groups, project) => {
        const year = project.reporting_year || "Unknown";
        const current = groups.get(year) || { totalMinutes: 0, courseCount: 0 };
        current.totalMinutes += project.project_total_minutes;
        current.courseCount += 1;
        groups.set(year, current);
        return groups;
      }, new Map())
      .entries(),
  )
    .map(([year, value]) => ({
      year,
      averageHours: round(value.totalMinutes / 60 / value.courseCount, 1),
      courseCount: value.courseCount,
      totalHours: round(value.totalMinutes / 60, 1),
    }))
    .sort((a, b) => compareYearLabel(a.year, b.year));

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
    averageDevelopmentTimeByYear,
    activeProjectsByStatus: buildCountSeries(activeProjectsByStatusSource.map((project) => project.status))
      .map(([status, count]) => ({ status, count })),
    activeProjectStatusMix: buildCountSeries(activeProjectStatusMixSource.map((project) => project.status))
      .map(([label, value]) => ({ label, value })),
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
  const activeProjectByKey = new Map(activeProjects.map((project) => [project.project_key, project]));
  const currentYear = options.currentYear || String(new Date().getFullYear());
  const previousYear = String(Number(currentYear) - 1);
  const activeProjectLogs = snapshot.timeLogs.filter((row) => row.matched_project_key && activeKeys.has(row.matched_project_key));

  const chartFilterOptions = {
    reportingYears: uniqueSorted(activeProjects.map((project) => project.reporting_year || "Unknown")),
    owners: uniqueSorted(activeProjects.map((project) => project.primary_id_assigned || "Unassigned")),
    authoringTools: uniqueSorted(activeProjects.map((project) => labelOrUnknown(project.authoring_tool))),
    courseTypes: uniqueSorted(activeProjects.map((project) => labelOrUnknown(project.course_type))),
    statuses: uniqueSorted(activeProjects.map((project) => project.status)),
    roleGroups: uniqueSorted(activeProjectLogs.map((row) => row.role_group)),
  };

  const activeProjectsByStatusSource = activeProjects.filter((project) =>
    matchesProjectChartFilters(project, options.chartFilters?.activeProjectsByStatus),
  );

  const activeProjectsByIdOwnerSource = activeProjects.filter((project) =>
    matchesProjectChartFilters(project, options.chartFilters?.activeProjectsByIdOwner),
  );

  const activeProjectsByAuthoringToolSource = activeProjects.filter((project) =>
    matchesProjectChartFilters(project, options.chartFilters?.activeProjectsByAuthoringTool),
  );

  const activeProjectsByCourseTypeSource = activeProjects.filter((project) =>
    matchesProjectChartFilters(project, options.chartFilters?.activeProjectsByCourseType),
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
    activeProjectLogs
      .filter((row) => {
        const project = row.matched_project_key ? activeProjectByKey.get(row.matched_project_key) : null;
        if (!project) return false;

        return (
          matchesProjectChartFilters(project, options.chartFilters?.developmentHoursByPhase) &&
          matchesSelected(options.chartFilters?.developmentHoursByPhase?.roleGroups, row.role_group)
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

function getProjectProgressWeight(project: CanonicalProject) {
  if (FINALIZED_PROJECT_STATUSES.has(project.status)) return 1;
  if (project.status === "Cancelled") return 0;
  return Math.max(0, Math.min(1, project.status_rank / PROJECT_STATUS_RANKS.Completed));
}

export function selectAdminDevelopmentAnalyticsModel(snapshot: AnalyticsSnapshot, filters: AdminDevelopmentAnalyticsFilters = {}) {
  const projectMap = buildProjectMap(snapshot);
  const assignedProjectRows = snapshot.canonicalProjects.flatMap((project) =>
    project.owner_names.map((assignedId) => ({
      project,
      assignedId,
      reportingYear: project.reporting_year || "Unknown",
      status: project.status,
      courseLengthHours: round(parseDurationToMinutes(project.course_length_raw) / 60, 2),
    })),
  );

  const baseAssignedRows = assignedProjectRows.filter((row) =>
    matchesSelected(filters.reportingYears, row.reportingYear) &&
    matchesSelected(filters.assignedIds, row.assignedId) &&
    matchesSelected(filters.statuses, row.status),
  );
  const assignedProjectByKey = new Map(baseAssignedRows.map((row) => [`${row.project.project_key}|${normalizePersonLookup(row.assignedId)}`, row]));

  const matchingIdLogs = snapshot.timeLogs
    .filter((row) => row.role_group === "ID" && row.matched_project_key)
    .map((row) => {
      const project = row.matched_project_key ? projectMap.get(row.matched_project_key) : null;
      if (!project) return null;
      const assignedId = project.owner_names.find((owner) => matchesCanonicalPerson(owner, row.canonical_user_name));
      if (!assignedId) return null;
      const assignedRow = assignedProjectByKey.get(`${project.project_key}|${normalizePersonLookup(assignedId)}`);
      if (!assignedRow) return null;
      if (!matchesSelected(filters.rawCategories, row.raw_category || "Unknown")) return null;
      return { log: row, assignedId, project: assignedRow.project, courseLengthHours: assignedRow.courseLengthHours };
    })
    .filter((row): row is { log: TimeLogRow; assignedId: string; project: CanonicalProject; courseLengthHours: number } => Boolean(row));

  const totalDevelopmentHours = round(matchingIdLogs.reduce((sum, row) => sum + (row.log.minutes ?? 0) / 60, 0), 2);

  const developmentTimeByCategory = buildHoursSeries(
    matchingIdLogs.map((row) => ({ key: row.log.raw_category || "Unknown", minutes: row.log.minutes })),
  ).map(([category, hours]) => ({
    category,
    hours: round(hours, 2),
    percentOfTotal: totalDevelopmentHours > 0 ? round((hours / totalDevelopmentHours) * 100, 1) : 0,
  }));

  const assignedIds = uniqueSorted(baseAssignedRows.map((row) => row.assignedId));
  const projectHoursMap = new Map<string, Record<string, string | number>>();
  matchingIdLogs.forEach(({ log, assignedId, project }) => {
    const key = project.project_key;
    if (!projectHoursMap.has(key)) {
      projectHoursMap.set(key, {
        projectKey: project.project_key,
        projectName: project.raw_course_name,
        reportingYear: project.reporting_year || "Unknown",
        status: project.status,
        courseLengthHours: round(parseDurationToMinutes(project.course_length_raw) / 60, 2),
        totalHours: 0,
      });
    }
    const row = projectHoursMap.get(key)!;
    const hours = (log.minutes ?? 0) / 60;
    row[assignedId] = round(Number(row[assignedId] || 0) + hours, 2);
    row.totalHours = round(Number(row.totalHours || 0) + hours, 2);
  });

  const idProjectHours = matchingIdLogs.reduce<Record<string, { project: CanonicalProject; assignedId: string; hours: number; courseLengthHours: number }>>(
    (acc, { log, assignedId, project }) => {
      const key = `${project.project_key}|${assignedId}`;
      if (!acc[key]) {
        acc[key] = {
          project,
          assignedId,
          hours: 0,
          courseLengthHours: round(parseDurationToMinutes(project.course_length_raw) / 60, 2),
        };
      }
      acc[key].hours += (log.minutes ?? 0) / 60;
      return acc;
    },
    {},
  );

  const completionById = baseAssignedRows.reduce<Record<string, {
    assignedId: string;
    totalDevelopmentHours: number;
    progressWeightedCompleted: number;
    completedCourseCount: number;
    completedCourseLengthHours: number;
  }>>((acc, row) => {
    if (!acc[row.assignedId]) {
      acc[row.assignedId] = {
        assignedId: row.assignedId,
        totalDevelopmentHours: 0,
        progressWeightedCompleted: 0,
        completedCourseCount: 0,
        completedCourseLengthHours: 0,
      };
    }
    acc[row.assignedId].progressWeightedCompleted += getProjectProgressWeight(row.project);
    if (FINALIZED_PROJECT_STATUSES.has(row.status)) {
      acc[row.assignedId].completedCourseCount += 1;
      acc[row.assignedId].completedCourseLengthHours += row.courseLengthHours;
    }
    return acc;
  }, {});

  matchingIdLogs.forEach(({ log, assignedId }) => {
    if (!completionById[assignedId]) {
      completionById[assignedId] = {
        assignedId,
        totalDevelopmentHours: 0,
        progressWeightedCompleted: 0,
        completedCourseCount: 0,
        completedCourseLengthHours: 0,
      };
    }
    completionById[assignedId].totalDevelopmentHours += (log.minutes ?? 0) / 60;
  });

  const efficiencyBaseRows = Object.values(completionById)
    .map((row) => ({
      ...row,
      totalDevelopmentHours: round(row.totalDevelopmentHours, 2),
      progressWeightedCompleted: round(row.progressWeightedCompleted, 2),
      completedCourseLengthHours: round(row.completedCourseLengthHours, 2),
      efficiency: row.totalDevelopmentHours > 0 ? round(row.completedCourseLengthHours / row.totalDevelopmentHours, 2) : null,
    }))
    .sort((a, b) => {
      if (a.efficiency === null && b.efficiency === null) return a.assignedId.localeCompare(b.assignedId);
      if (a.efficiency === null) return 1;
      if (b.efficiency === null) return -1;
      return b.efficiency - a.efficiency || b.completedCourseLengthHours - a.completedCourseLengthHours || a.assignedId.localeCompare(b.assignedId);
    });

  const rankedCount = efficiencyBaseRows.filter((row) => row.efficiency !== null).length;
  const efficiencyById = efficiencyBaseRows.map((row, index) => {
    const rank = index + 1;
    let tier = "Low";
    if (row.efficiency === null) {
      tier = "Unranked";
    } else if (rank <= Math.ceil(rankedCount / 3)) {
      tier = "High";
    } else if (rank <= Math.ceil((rankedCount * 2) / 3)) {
      tier = "Medium";
    }
    return { ...row, rank, tier };
  });

  const hoursByProject = [...projectHoursMap.values()]
    .map((row) => ({
      ...row,
      assignedIds: assignedIds.filter((assignedId) => Number(row[assignedId] || 0) > 0),
    }))
    .sort((a, b) => Number(b.totalHours) - Number(a.totalHours) || String(a.projectName).localeCompare(String(b.projectName)));

  return {
    cards: {
      totalDevelopmentHours,
      categoryCount: developmentTimeByCategory.length,
      topCategory: developmentTimeByCategory[0]?.category || "-",
      assignedIdCount: assignedIds.length,
    },
    developmentTimeByCategory,
    hoursByProject,
    idProjectHours: Object.values(idProjectHours)
      .map((row) => ({
        projectKey: row.project.project_key,
        projectName: row.project.raw_course_name,
        assignedId: row.assignedId,
        hours: round(row.hours, 2),
        reportingYear: row.project.reporting_year || "Unknown",
        status: row.project.status,
        courseLengthHours: row.courseLengthHours,
      }))
      .sort((a, b) => b.hours - a.hours || a.projectName.localeCompare(b.projectName) || a.assignedId.localeCompare(b.assignedId)),
    efficiencyById,
    stackedAssignedIds: assignedIds,
    filterOptions: {
      reportingYears: uniqueSorted(assignedProjectRows.map((row) => row.reportingYear)),
      assignedIds: uniqueSorted(assignedProjectRows.map((row) => row.assignedId)),
      rawCategories: uniqueSorted(
        snapshot.timeLogs
          .filter((row) => row.role_group === "ID" && row.matched_project_key)
          .map((row) => row.raw_category || "Unknown"),
      ),
      statuses: uniqueSorted(assignedProjectRows.map((row) => row.status)),
    },
  };
}

export function selectSmeCollaborationModel(snapshot: AnalyticsSnapshot, filters: SmeCollaborationFilters = {}) {
  const projectMap = buildProjectMap(snapshot);
  const allSmeRows = snapshot.smeFeedbackSmeView;
  const smeByRawIdAll = new Map(allSmeRows.map((row) => [row.raw_sme_feedback_row_id, row]));
  const baseFilters: SmeSurveyChartFilters = {
    internalValues: filters.internalValues,
    startDate: filters.startDate,
    endDate: filters.endDate,
  };

  const matchesSmeRow = (row: SmeSmeFeedbackRow, chartFilters: SmeSurveyChartFilters | undefined) =>
    matchesSelected(chartFilters?.internalValues, getSmeInternalLabel(row.internal)) &&
    matchesSelected(chartFilters?.instructionalDesigners, row.instructional_designer || "Unknown ID") &&
    matchesSelected(chartFilters?.smes, row.sme || "Unknown SME") &&
    matchesSelected(chartFilters?.reportingYears, row.reporting_year || "Unknown") &&
    (!chartFilters?.startDate && !chartFilters?.endDate ? true : inDateRange(row.survey_date, chartFilters.startDate, chartFilters.endDate));

  const matchesIdRow = (row: SmeIdFeedbackRow, chartFilters: SmeSurveyChartFilters | undefined) => {
    const pairedSmeRow = smeByRawIdAll.get(row.raw_sme_feedback_row_id);
    return (
      matchesSelected(chartFilters?.instructionalDesigners, row.instructional_designer || "Unknown ID") &&
      matchesSelected(chartFilters?.smes, row.sme || "Unknown SME") &&
      matchesSelected(chartFilters?.reportingYears, row.reporting_year || "Unknown") &&
      (!chartFilters?.internalValues?.length || (pairedSmeRow && matchesSelected(chartFilters.internalValues, getSmeInternalLabel(pairedSmeRow.internal)))) &&
      (!chartFilters?.startDate && !chartFilters?.endDate ? true : inDateRange(row.survey_date, chartFilters.startDate, chartFilters.endDate))
    );
  };

  const filterIdRows = (chartFilters: SmeSurveyChartFilters | undefined) =>
    snapshot.smeFeedbackIdView.filter((row) => matchesIdRow(row, chartFilters));
  const filterSmeRows = (chartFilters: SmeSurveyChartFilters | undefined) =>
    allSmeRows.filter((row) => matchesSmeRow(row, chartFilters));
  const projectMatchesCoverageFilters = (
    project: CanonicalProject,
    chartFilters: SmeSurveyChartFilters | undefined,
    personType: "sme" | "id",
    personName: string,
  ) =>
    matchesSelected(chartFilters?.reportingYears, project.reporting_year || "Unknown") &&
    (personType === "sme"
      ? matchesSelected(chartFilters?.smes, personName)
      : matchesSelected(chartFilters?.instructionalDesigners, personName));
  const relevantJoinRowsFor = (idRows: SmeIdFeedbackRow[], smeRows: SmeSmeFeedbackRow[]) => {
    const relevantIds = new Set([...idRows, ...smeRows].map((row) => row.raw_sme_feedback_row_id));
    return snapshot.smeJoinAudit.filter((row) => relevantIds.has(row.raw_sme_feedback_row_id));
  };

  const idRows = filterIdRows(baseFilters);
  const smeRows = filterSmeRows(baseFilters);
  const relevantJoinRows = relevantJoinRowsFor(idRows, smeRows);
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

  const matrixSmeRows = filterSmeRows(filters.matrix ?? baseFilters);
  const smeQuestionMatrix = smeQuestionKeys.map((key) => {
    const scores = matrixSmeRows
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

  const bySmeRows = filterSmeRows(filters.bySme ?? baseFilters);
  const bySme = bySmeRows.reduce<Record<string, { responses: number; scores: number[] }>>((acc, row) => {
    const key = row.instructional_designer || "Unknown ID";
    const scores = averageableSmeExperienceScores(row);
    if (!acc[key]) acc[key] = { responses: 0, scores: [] };
    acc[key].responses += 1;
    acc[key].scores.push(...scores);
    return acc;
  }, {});

  const byIdRows = filterIdRows(filters.byInstructionalDesigner ?? baseFilters);
  const byInstructionalDesigner = byIdRows.reduce<Record<string, { responses: number; ratings: number[] }>>((acc, row) => {
    const key = row.sme || "Unknown SME";
    if (!acc[key]) acc[key] = { responses: 0, ratings: [] };
    acc[key].responses += 1;
    acc[key].ratings.push(...averageableIdEvaluationScores(row));
    return acc;
  }, {});

  const smeCoverageFilters = filters.smeCourseSurveyCoverage ?? baseFilters;
  const idCoverageFilters = filters.idCourseSurveyCoverage ?? baseFilters;
  const smeCourseSurveyCoverageMap = snapshot.canonicalProjects.reduce<Record<string, { assignedCourses: number; completedSurveys: number; ratings: number[] }>>((acc, project) => {
    splitMultiValueField(project.sme_assigned_raw).forEach((sme) => {
      if (!projectMatchesCoverageFilters(project, smeCoverageFilters, "sme", sme)) return;
      if (!acc[sme]) acc[sme] = { assignedCourses: 0, completedSurveys: 0, ratings: [] };
      acc[sme].assignedCourses += 1;
    });
    return acc;
  }, {});
  filterIdRows(smeCoverageFilters).forEach((row) => {
    const sme = row.sme || "Unknown SME";
    if (!smeCourseSurveyCoverageMap[sme]) smeCourseSurveyCoverageMap[sme] = { assignedCourses: 0, completedSurveys: 0, ratings: [] };
    smeCourseSurveyCoverageMap[sme].completedSurveys += 1;
    smeCourseSurveyCoverageMap[sme].ratings.push(...averageableIdEvaluationScores(row));
  });

  const idCourseSurveyCoverageMap = snapshot.canonicalProjects.reduce<Record<string, { assignedCourses: number; completedSurveys: number; ratings: number[] }>>((acc, project) => {
    project.owner_names.forEach((instructionalDesigner) => {
      if (!projectMatchesCoverageFilters(project, idCoverageFilters, "id", instructionalDesigner)) return;
      if (!acc[instructionalDesigner]) acc[instructionalDesigner] = { assignedCourses: 0, completedSurveys: 0, ratings: [] };
      acc[instructionalDesigner].assignedCourses += 1;
    });
    return acc;
  }, {});
  filterSmeRows(idCoverageFilters).forEach((row) => {
    const instructionalDesigner = row.instructional_designer || "Unknown ID";
    if (!idCourseSurveyCoverageMap[instructionalDesigner]) idCourseSurveyCoverageMap[instructionalDesigner] = { assignedCourses: 0, completedSurveys: 0, ratings: [] };
    idCourseSurveyCoverageMap[instructionalDesigner].completedSurveys += 1;
    idCourseSurveyCoverageMap[instructionalDesigner].ratings.push(...averageableSmeExperienceScores(row));
  });

  const yearFilters = filters.responsesByReportingYear ?? baseFilters;
  const byReportingYear = relevantJoinRowsFor(filterIdRows(yearFilters), filterSmeRows(yearFilters)).reduce<Record<string, number>>((acc, row) => {
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

  const buildMatchedResponses = (idRowsForResponses: SmeIdFeedbackRow[], smeRowsForResponses: SmeSmeFeedbackRow[]) => {
    const idByRawId = new Map(idRowsForResponses.map((row) => [row.raw_sme_feedback_row_id, row]));
    const smeByRawId = new Map(smeRowsForResponses.map((row) => [row.raw_sme_feedback_row_id, row]));
    return relevantJoinRowsFor(idRowsForResponses, smeRowsForResponses)
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
  };

  const allMatchedResponses = buildMatchedResponses(snapshot.smeFeedbackIdView, allSmeRows);
  const matchedResponseFilters = filters.matchedResponses ? { ...baseFilters, ...filters.matchedResponses } : baseFilters;
  const filteredMatchedResponses = buildMatchedResponses(filterIdRows(matchedResponseFilters), filterSmeRows(matchedResponseFilters));

  const matchedResponseFilterOptions = {
    instructionalDesigners: uniqueSorted(allMatchedResponses.map((row) => row.instructionalDesigner)),
    smes: uniqueSorted(allMatchedResponses.map((row) => row.sme)),
    reportingYears: uniqueSorted(allMatchedResponses.map((row) => row.reportingYear)),
    internalValues: uniqueSorted(allSmeRows.map((row) => getSmeInternalLabel(row.internal))),
  };

  const chartFilterOptions = {
    internalValues: matchedResponseFilterOptions.internalValues,
    instructionalDesigners: uniqueSorted([
      ...snapshot.smeFeedbackIdView.map((row) => row.instructional_designer || "Unknown ID"),
      ...allSmeRows.map((row) => row.instructional_designer || "Unknown ID"),
    ]),
    smes: uniqueSorted([
      ...snapshot.smeFeedbackIdView.map((row) => row.sme || "Unknown SME"),
      ...allSmeRows.map((row) => row.sme || "Unknown SME"),
    ]),
    reportingYears: uniqueSorted([
      ...snapshot.smeFeedbackIdView.map((row) => row.reporting_year || "Unknown"),
      ...allSmeRows.map((row) => row.reporting_year || "Unknown"),
    ]),
  };
  const relevantIds = new Set([...idRows, ...smeRows].map((row) => row.raw_sme_feedback_row_id));

  return {
    cards: {
      responseCount: relevantIds.size,
      averageOverallCollaborationRating: round(average(idOverallRatings), 2),
      averagePromoterScore: round(average(promoterScores), 2),
      unresolvedRowsCount: unresolvedCount,
    },
    smeQuestionMatrix,
    averageSmeQuestionScores,
    smeCourseSurveyCoverage: Object.entries(smeCourseSurveyCoverageMap)
      .map(([sme, data]) => ({
        sme,
        assignedCourses: data.assignedCourses,
        completedSurveys: data.completedSurveys,
        averageRating: round(average(data.ratings), 2),
      }))
      .sort((a, b) => b.assignedCourses - a.assignedCourses || b.completedSurveys - a.completedSurveys || a.sme.localeCompare(b.sme)),
    idCourseSurveyCoverage: Object.entries(idCourseSurveyCoverageMap)
      .map(([instructionalDesigner, data]) => ({
        instructionalDesigner,
        assignedCourses: data.assignedCourses,
        completedSurveys: data.completedSurveys,
        averageRating: round(average(data.ratings), 2),
      }))
      .sort((a, b) => b.assignedCourses - a.assignedCourses || b.completedSurveys - a.completedSurveys || a.instructionalDesigner.localeCompare(b.instructionalDesigner)),
    bySme: Object.entries(bySme)
      .map(([instructionalDesigner, data]) => ({ instructionalDesigner, responses: data.responses, averageScore: round(average(data.scores), 2) }))
      .filter((row) => Number.isFinite(row.averageScore) && row.averageScore > 0)
      .sort((a, b) => b.responses - a.responses || a.instructionalDesigner.localeCompare(b.instructionalDesigner)),
    byInstructionalDesigner: Object.entries(byInstructionalDesigner)
      .map(([sme, data]) => ({
        sme,
        responses: data.responses,
        averageRating: round(average(data.ratings), 2),
      }))
      .sort((a, b) => b.responses - a.responses || a.sme.localeCompare(b.sme)),
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
    chartFilterOptions,
    sourceVerification: {
      instructionalDesignerBreakdown: "smeFeedbackIdView",
      smeExperienceBreakdown: "smeFeedbackSmeView",
    },
  };
}

export function selectExternalTeamsModel(snapshot: AnalyticsSnapshot, filters: ExternalTeamsFilters = {}) {
  const projectMap = buildProjectMap(snapshot);
  const workEntityMap = buildWorkEntityMap(snapshot);
  const activeExternalTeamProjects = {
    legal: snapshot.canonicalProjects
      .filter((project) => isProjectActive(project) && ["Process Legal Review", "Staging - Legal Review"].includes(project.status))
      .map(toProjectDisplay)
      .sort((a, b) => compareYearLabel(a.reportingYear, b.reportingYear) || a.projectName.localeCompare(b.projectName)),
    cqo: snapshot.canonicalProjects
      .filter((project) => isProjectActive(project) && project.status === "CQO Review")
      .map(toProjectDisplay)
      .sort((a, b) => compareYearLabel(a.reportingYear, b.reportingYear) || a.projectName.localeCompare(b.projectName)),
    compliance: snapshot.canonicalProjects
      .filter((project) => isProjectActive(project) && project.status === "Compliance Review")
      .map(toProjectDisplay)
      .sort((a, b) => compareYearLabel(a.reportingYear, b.reportingYear) || a.projectName.localeCompare(b.projectName)),
  };
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
    activeExternalTeamProjects,
    hoursByExternalRoleGroup,
    hoursByCategoryPhase,
    topWorkItems,
    usersByHours,
  };
}

export function selectProjectsPageRows(snapshot: AnalyticsSnapshot) {
  const matchedTimeLogsByProject = new Map<string, TimeLogRow[]>();
  snapshot.timeLogs.forEach((row) => {
    if (!row.matched_project_key) return;
    const rows = matchedTimeLogsByProject.get(row.matched_project_key) || [];
    rows.push(row);
    matchedTimeLogsByProject.set(row.matched_project_key, rows);
  });

  const smeFeedbackByProject = new Map<string, Array<SmeIdFeedbackRow | SmeSmeFeedbackRow>>();
  [...snapshot.smeFeedbackIdView, ...snapshot.smeFeedbackSmeView].forEach((row) => {
    if (!row.matched_project_key) return;
    const rows = smeFeedbackByProject.get(row.matched_project_key) || [];
    rows.push(row);
    smeFeedbackByProject.set(row.matched_project_key, rows);
  });

  return snapshot.canonicalProjects.map((project) => ({
    exactProjectValues: uniqueSorted([project.project_key, project.raw_course_name]),
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
    isActive: isProjectActive(project),
    timeLogPhases: uniqueSorted(matchedTimeLogsByProject.get(project.project_key)?.map((row) => row.category_phase) || []),
    timeLogRoleGroups: uniqueSorted(matchedTimeLogsByProject.get(project.project_key)?.map((row) => row.role_group) || []),
    timeLogUsers: uniqueSorted(matchedTimeLogsByProject.get(project.project_key)?.map((row) => row.canonical_user_name || "Unknown") || []),
    timeLogWorkScopes: uniqueSorted(matchedTimeLogsByProject.get(project.project_key)?.map((row) => getDashboardWorkScope(row)) || []),
    timeLogExternalClassifications: uniqueSorted(matchedTimeLogsByProject.get(project.project_key)?.map((row) => getExternalWorkClassification(row)) || []),
    timeLogDates: uniqueSorted(matchedTimeLogsByProject.get(project.project_key)?.map((row) => row.log_date) || []),
    smeFeedbackInstructionalDesigners: uniqueSorted(smeFeedbackByProject.get(project.project_key)?.map((row) => row.instructional_designer) || []),
    smeFeedbackInternalLabels: uniqueSorted(
      (smeFeedbackByProject.get(project.project_key) || [])
        .map((row) => "internal" in row ? getSmeInternalLabel(row.internal) : null),
    ),
    smeFeedbackDates: uniqueSorted(smeFeedbackByProject.get(project.project_key)?.map((row) => row.survey_date) || []),
    hasTimeLogs: project.time_log_minutes_sum > 0,
    hasSmeFeedback:
      project.unresolved_sme_feedback_count > 0 ||
      snapshot.smeJoinAudit.some((row) => row.matched_project_key === project.project_key),
  }));
}

export function selectProjectDetailModel(snapshot: AnalyticsSnapshot, projectKey: string, options: ProjectDetailOptions = {}) {
  const projectMap = buildProjectMap(snapshot);
  const workEntityMap = buildWorkEntityMap(snapshot);
  const project = snapshot.canonicalProjects.find((entry) => entry.project_key === projectKey);
  if (!project) return null;

  const matchedTimeLogs = snapshot.timeLogs.filter((row) => row.matched_project_key === projectKey);
  const phaseBreakdownTimeLogs = matchedTimeLogs.filter((row) =>
    matchesTimeLogChartFilters(row, options.phaseBreakdown, projectMap, workEntityMap),
  );
  const timelineTimeLogs = matchedTimeLogs.filter((row) =>
    matchesTimeLogChartFilters(row, options.timeline, projectMap, workEntityMap),
  );
  const phaseBreakdown = buildHoursSeries(
    phaseBreakdownTimeLogs.map((row) => ({ key: row.category_phase, minutes: row.minutes })),
  ).map(([phase, hours]) => ({ phase, hours: round(hours, 1) }));

  const dailyTimeline = Object.entries(
    timelineTimeLogs.reduce<Record<string, number>>((acc, row) => {
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
    chartFilterOptions: {
      phases: uniqueSorted(matchedTimeLogs.map((row) => row.category_phase)),
      roleGroups: uniqueSorted(matchedTimeLogs.map((row) => row.role_group)),
      users: uniqueSorted(matchedTimeLogs.map((row) => row.canonical_user_name || "Unknown")),
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
          date: row.survey_date,
          author: row.instructional_designer || "Unknown ID",
          comment: row.additional_comments,
        })),
      smeResponses: smeFeedback
        .filter((row) => row.additional_feedback_or_suggestions)
        .map((row) => ({
          date: row.survey_date,
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

export function selectPersonDetailModel(snapshot: AnalyticsSnapshot, canonicalName: string, options: PersonDetailOptions = {}) {
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

  const idStatusProjects = idAssignedProjects.filter((project) =>
    matchesProjectChartFilters(project, options.idStatusBreakdown),
  );
  const idPhaseTimeLogs = ownedProjectTimeLogs.filter((row) => {
    const project = row.matched_project_key ? projectMap.get(row.matched_project_key) : null;
    return (
      Boolean(project) &&
      matchesProjectChartFilters(project!, options.idPhaseBreakdown) &&
      matchesSelected(options.idPhaseBreakdown?.roleGroups, row.role_group)
    );
  });

  const idStatusBreakdown = buildCountSeries(idStatusProjects.map((project) => project.status))
    .map(([status, count]) => ({ status, count }));
  const idPhaseBreakdown = buildHoursSeries(
    idPhaseTimeLogs.map((row) => ({ key: row.category_phase, minutes: row.minutes })),
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
      chartFilterOptions: {
        reportingYears: uniqueSorted(idAssignedProjects.map((project) => project.reporting_year || "Unknown")),
        authoringTools: uniqueSorted(idAssignedProjects.map((project) => labelOrUnknown(project.authoring_tool))),
        courseTypes: uniqueSorted(idAssignedProjects.map((project) => labelOrUnknown(project.course_type))),
        roleGroups: uniqueSorted(ownedProjectTimeLogs.map((row) => row.role_group)),
      },
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
        surveyDate: row.survey_date,
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
        surveyDate: row.survey_date,
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
        surveyDate: row.survey_date,
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
