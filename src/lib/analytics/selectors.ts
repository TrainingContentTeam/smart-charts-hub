import { format, parseISO, startOfWeek } from "date-fns";
import { FINALIZED_PROJECT_STATUSES } from "@/lib/analytics/constants";
import { EXTERNAL_WORK_CLASSIFICATION_LABELS, SME_QUESTION_LABELS, WORK_SCOPE_LABELS } from "@/lib/analytics/labels";
import { compactCourseName } from "@/lib/analytics/normalization";
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
};

export type ExternalTeamsFilters = {
  roleGroups?: string[];
  phases?: string[];
  classifications?: ExternalWorkClassification[];
  reportingYears?: string[];
  users?: string[];
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

function inDateRange(value: string | null, startDate?: string | null, endDate?: string | null) {
  if (!value) return false;
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
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

export function selectDevelopmentModel(snapshot: AnalyticsSnapshot) {
  const activeProjects = snapshot.canonicalProjects.filter(isProjectActive);
  const activeKeys = new Set(activeProjects.map((project) => project.project_key));

  const activeProjectsByStatus = buildCountSeries(activeProjects.map((project) => project.status))
    .map(([status, count]) => ({ status, count }));

  const activeProjectsByIdOwner = buildCountSeries(
    activeProjects.map((project) => project.primary_id_assigned || "Unassigned"),
  ).map(([owner, count]) => ({ owner, count }));

  const activeProjectsByAuthoringTool = buildCountSeries(
    activeProjects.map((project) => labelOrUnknown(project.authoring_tool)),
  ).map(([tool, count]) => ({ tool, count }));

  const activeProjectsByCourseType = buildCountSeries(
    activeProjects.map((project) => labelOrUnknown(project.course_type)),
  ).map(([type, count]) => ({ type, count }));

  const developmentHoursByPhase = buildHoursSeries(
    snapshot.timeLogs
      .filter((row) => row.matched_project_key && activeKeys.has(row.matched_project_key))
      .map((row) => ({ key: row.category_phase, minutes: row.minutes })),
  ).map(([phase, hours]) => ({ phase, hours: round(hours, 1) }));

  const latestActivityRows = activeProjects
    .map((project) => ({
      projectKey: project.project_key,
      projectName: project.raw_course_name,
      courseName: project.raw_course_name,
      reportingYear: project.reporting_year || "Unknown",
      status: project.status,
      owner: project.primary_id_assigned || "Unassigned",
      latestTimeLogDate: project.latest_time_log_date,
    }))
    .sort((a, b) => (b.latestTimeLogDate || "").localeCompare(a.latestTimeLogDate || "") || a.projectName.localeCompare(b.projectName));

  return {
    activeProjectCount: activeProjects.length,
    activeProjectsByStatus,
    activeProjectsByIdOwner,
    activeProjectsByAuthoringTool,
    activeProjectsByCourseType,
    developmentHoursByPhase,
    latestActivityRows,
  };
}

export function selectSmeCollaborationModel(snapshot: AnalyticsSnapshot, filters: SmeCollaborationFilters = {}) {
  const projectMap = buildProjectMap(snapshot);
  const smeRows = snapshot.smeFeedbackSmeView.filter((row) =>
    matchesSelected(filters.internalValues, getSmeInternalLabel(row.internal)) &&
    (!filters.startDate && !filters.endDate ? true : inDateRange(row.sme_survey_date, filters.startDate, filters.endDate)),
  );

  const allowedIds = filters.internalValues?.length
    ? new Set(smeRows.map((row) => row.raw_sme_feedback_row_id))
    : new Set(snapshot.smeFeedbackSmeView.map((row) => row.raw_sme_feedback_row_id));

  const idRows = snapshot.smeFeedbackIdView.filter((row) =>
    allowedIds.has(row.raw_sme_feedback_row_id) &&
    (!filters.startDate && !filters.endDate ? true : inDateRange(row.id_survey_date, filters.startDate, filters.endDate)),
  );

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

  const averageSmeQuestionScores = smeQuestionKeys.map((key) => ({
    question: key,
    label: SME_QUESTION_LABELS[key as keyof typeof SME_QUESTION_LABELS],
    average: round(
      average(
        smeRows
          .map((row) => row[key] as number | null)
          .filter((value): value is number => value !== null),
      ),
      2,
    ),
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
        smeResponse: smeRow?.additional_feedback_or_suggestions || "",
        designerComments: idRow?.additional_comments || "",
      };
    })
    .filter((row) => row.smeResponse || row.designerComments)
    .sort((a, b) => a.projectName.localeCompare(b.projectName) || a.rawSmeFeedbackRowId.localeCompare(b.rawSmeFeedbackRowId));

  return {
    cards: {
      responseCount: relevantIds.size,
      averageOverallCollaborationRating: round(average(idOverallRatings), 2),
      averagePromoterScore: round(average(promoterScores), 2),
      unresolvedRowsCount: unresolvedCount,
    },
    averageSmeQuestionScores,
    bySme: Object.entries(bySme)
      .map(([sme, data]) => ({ sme, responses: data.responses, averageScore: round(average(data.scores), 2) }))
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
    matchedResponses,
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
    rows: Array<TimeLogMatchAuditRow & { hours: number; logDate: string | null; user: string }>;
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
