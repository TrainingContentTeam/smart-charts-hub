import { FINALIZED_PROJECT_STATUSES } from "@/lib/analytics/constants";
import type {
  AnalyticsSnapshot,
  CanonicalProject,
  RoleGroup,
  SmeSmeFeedbackRow,
} from "@/lib/analytics/types";

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

export function selectDashboardModel(snapshot: AnalyticsSnapshot) {
  const totalProjects = snapshot.canonicalProjects.length;
  const activeProjects = snapshot.canonicalProjects.filter(isProjectActive);
  const completedProjects = snapshot.canonicalProjects.filter((project) =>
    project.status === "Completed" || project.status === "Published",
  );
  const totalProjectHours = round(
    snapshot.canonicalProjects.reduce((sum, project) => sum + project.project_total_minutes / 60, 0),
    1,
  );
  const totalLoggedHours = round(snapshot.timeLogs.reduce((sum, row) => sum + row.minutes / 60, 0), 1);

  const projectsByReportingYear = [...snapshot.canonicalProjects]
    .reduce<Record<string, number>>((acc, project) => {
      const year = project.reporting_year || "Unknown";
      acc[year] = (acc[year] || 0) + 1;
      return acc;
    }, {});

  const activeProjectsByStatus = activeProjects
    .reduce<Record<string, number>>((acc, project) => {
      acc[project.status] = (acc[project.status] || 0) + 1;
      return acc;
    }, {});

  const projectMixByCourseType = snapshot.canonicalProjects.reduce<Record<string, number>>((acc, project) => {
    const value = project.course_type || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  const projectMixByAuthoringTool = snapshot.canonicalProjects.reduce<Record<string, number>>((acc, project) => {
    const value = project.authoring_tool || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});

  const hoursByTimeLogPhase = snapshot.timeLogs.reduce<Record<string, number>>((acc, row) => {
    acc[row.category_phase] = (acc[row.category_phase] || 0) + row.minutes / 60;
    return acc;
  }, {});

  const hoursByRoleGroup = snapshot.timeLogs.reduce<Record<RoleGroup, number>>((acc, row) => {
    acc[row.role_group] = (acc[row.role_group] || 0) + row.minutes / 60;
    return acc;
  }, { ID: 0, SME: 0, Legal: 0, "Other/External": 0 });

  const discrepancyCount = snapshot.canonicalProjects.filter((project) => project.hours_discrepancy_flag).length;
  const standaloneHours = round(
    snapshot.timeLogs
      .filter((row) => row.work_entity_type === "standalone_course")
      .reduce((sum, row) => sum + row.minutes / 60, 0),
    1,
  );
  const operationalHours = round(
    snapshot.timeLogs
      .filter((row) => row.work_entity_type === "operational_work")
      .reduce((sum, row) => sum + row.minutes / 60, 0),
    1,
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
    projectsByReportingYear: Object.entries(projectsByReportingYear)
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => compareYearLabel(a.year, b.year)),
    activeProjectsByStatus: Object.entries(activeProjectsByStatus)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status)),
    projectMixByCourseType: Object.entries(projectMixByCourseType)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
    projectMixByAuthoringTool: Object.entries(projectMixByAuthoringTool)
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label)),
    hoursByTimeLogPhase: Object.entries(hoursByTimeLogPhase)
      .map(([phase, hours]) => ({ phase, hours: round(hours, 1) }))
      .sort((a, b) => b.hours - a.hours || a.phase.localeCompare(b.phase)),
    hoursByRoleGroup: Object.entries(hoursByRoleGroup)
      .map(([roleGroup, hours]) => ({ roleGroup, hours: round(hours, 1) }))
      .sort((a, b) => b.hours - a.hours || a.roleGroup.localeCompare(b.roleGroup)),
  };
}

export function selectDevelopmentModel(snapshot: AnalyticsSnapshot) {
  const activeProjects = snapshot.canonicalProjects.filter(isProjectActive);
  const activeKeys = new Set(activeProjects.map((project) => project.project_key));

  const activeProjectsByStatus = activeProjects.reduce<Record<string, number>>((acc, project) => {
    acc[project.status] = (acc[project.status] || 0) + 1;
    return acc;
  }, {});

  const activeProjectsByIdOwner = activeProjects.reduce<Record<string, number>>((acc, project) => {
    const owner = project.primary_id_assigned || "Unassigned";
    acc[owner] = (acc[owner] || 0) + 1;
    return acc;
  }, {});

  const activeProjectsByAuthoringTool = activeProjects.reduce<Record<string, number>>((acc, project) => {
    const tool = project.authoring_tool || "Unknown";
    acc[tool] = (acc[tool] || 0) + 1;
    return acc;
  }, {});

  const activeProjectsByCourseType = activeProjects.reduce<Record<string, number>>((acc, project) => {
    const type = project.course_type || "Unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

  const developmentHoursByPhase = snapshot.timeLogs
    .filter((row) => row.matched_project_key && activeKeys.has(row.matched_project_key))
    .reduce<Record<string, number>>((acc, row) => {
      acc[row.category_phase] = (acc[row.category_phase] || 0) + row.minutes / 60;
      return acc;
    }, {});

  const latestActivityRows = activeProjects
    .map((project) => ({
      projectKey: project.project_key,
      courseName: project.raw_course_name,
      status: project.status,
      owner: project.primary_id_assigned || "Unassigned",
      latestTimeLogDate: project.latest_time_log_date,
    }))
    .sort((a, b) => (b.latestTimeLogDate || "").localeCompare(a.latestTimeLogDate || "") || a.courseName.localeCompare(b.courseName));

  return {
    activeProjectCount: activeProjects.length,
    activeProjectsByStatus: Object.entries(activeProjectsByStatus)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count || a.status.localeCompare(b.status)),
    activeProjectsByIdOwner: Object.entries(activeProjectsByIdOwner)
      .map(([owner, count]) => ({ owner, count }))
      .sort((a, b) => b.count - a.count || a.owner.localeCompare(b.owner)),
    activeProjectsByAuthoringTool: Object.entries(activeProjectsByAuthoringTool)
      .map(([tool, count]) => ({ tool, count }))
      .sort((a, b) => b.count - a.count || a.tool.localeCompare(b.tool)),
    activeProjectsByCourseType: Object.entries(activeProjectsByCourseType)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)),
    developmentHoursByPhase: Object.entries(developmentHoursByPhase)
      .map(([phase, hours]) => ({ phase, hours: round(hours, 1) }))
      .sort((a, b) => b.hours - a.hours || a.phase.localeCompare(b.phase)),
    latestActivityRows,
  };
}

export function selectSmeCollaborationModel(snapshot: AnalyticsSnapshot) {
  const unresolvedCount = snapshot.smeJoinAudit.filter((row) => row.join_status !== "matched").length;
  const idOverallRatings = snapshot.smeFeedbackIdView
    .map((row) => row.overall_collaboration_rating)
    .filter((value): value is number => value !== null);
  const promoterScores = snapshot.smeFeedbackIdView
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
    average: round(
      average(
        snapshot.smeFeedbackSmeView
          .map((row) => row[key] as number | null)
          .filter((value): value is number => value !== null),
      ),
      2,
    ),
  }));

  const bySme = snapshot.smeFeedbackSmeView.reduce<Record<string, { responses: number; scores: number[] }>>((acc, row) => {
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

  const byInstructionalDesigner = snapshot.smeFeedbackIdView.reduce<Record<string, { responses: number; ratings: number[]; promoters: number[] }>>((acc, row) => {
    const key = row.instructional_designer || "Unknown ID";
    if (!acc[key]) acc[key] = { responses: 0, ratings: [], promoters: [] };
    acc[key].responses += 1;
    if (row.overall_collaboration_rating !== null) acc[key].ratings.push(row.overall_collaboration_rating);
    if (row.promoter_score !== null) acc[key].promoters.push(row.promoter_score);
    return acc;
  }, {});

  const byReportingYear = snapshot.smeJoinAudit.reduce<Record<string, number>>((acc, row) => {
    const year = row.reporting_year || "Unknown";
    acc[year] = (acc[year] || 0) + 1;
    return acc;
  }, {});

  const byProject = snapshot.smeJoinAudit
    .filter((row) => row.matched_project_key)
    .reduce<Record<string, number>>((acc, row) => {
      const key = row.matched_project_key!;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  return {
    cards: {
      responseCount: snapshot.smeJoinAudit.length,
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
      .map(([projectKey, responses]) => ({ projectKey, responses }))
      .sort((a, b) => b.responses - a.responses || a.projectKey.localeCompare(b.projectKey)),
  };
}

export function selectExternalTeamsModel(snapshot: AnalyticsSnapshot) {
  const externalRows = snapshot.timeLogs.filter((row) =>
    row.role_group === "Legal" ||
    row.role_group === "Other/External" ||
    row.work_entity_type === "standalone_course" ||
    row.work_entity_type === "operational_work",
  );

  const hoursByExternalRoleGroup = externalRows.reduce<Record<string, number>>((acc, row) => {
    const key =
      row.work_entity_type === "standalone_course"
        ? "standalone_course"
        : row.work_entity_type === "operational_work"
          ? "non_project_work"
          : row.role_group;
    acc[key] = (acc[key] || 0) + row.minutes / 60;
    return acc;
  }, {});

  const hoursByCategoryPhase = externalRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.category_phase] = (acc[row.category_phase] || 0) + row.minutes / 60;
    return acc;
  }, {});

  const topWorkItems = externalRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.normalized_course_name || row.raw_course_name;
    acc[key] = (acc[key] || 0) + row.minutes / 60;
    return acc;
  }, {});

  const usersByHours = externalRows.reduce<Record<string, number>>((acc, row) => {
    const key = row.canonical_user_name || "Unknown";
    acc[key] = (acc[key] || 0) + row.minutes / 60;
    return acc;
  }, {});

  return {
    hoursByExternalRoleGroup: Object.entries(hoursByExternalRoleGroup)
      .map(([roleGroup, hours]) => ({ roleGroup, hours: round(hours, 1) }))
      .sort((a, b) => b.hours - a.hours || a.roleGroup.localeCompare(b.roleGroup)),
    hoursByCategoryPhase: Object.entries(hoursByCategoryPhase)
      .map(([phase, hours]) => ({ phase, hours: round(hours, 1) }))
      .sort((a, b) => b.hours - a.hours || a.phase.localeCompare(b.phase)),
    topWorkItems: Object.entries(topWorkItems)
      .map(([workItem, hours]) => ({ workItem, hours: round(hours, 1) }))
      .sort((a, b) => b.hours - a.hours || a.workItem.localeCompare(b.workItem))
      .slice(0, 20),
    usersByHours: Object.entries(usersByHours)
      .map(([user, hours]) => ({ user, hours: round(hours, 1) }))
      .sort((a, b) => b.hours - a.hours || a.user.localeCompare(b.user)),
  };
}

export function selectProjectsPageRows(snapshot: AnalyticsSnapshot) {
  return snapshot.canonicalProjects.map((project) => ({
    projectKey: project.project_key,
    rawCourseName: project.raw_course_name,
    reportingYear: project.reporting_year || "Unknown",
    sourceDataset: project.source_dataset,
    status: project.status,
    projectTotalHours: round(project.project_total_minutes / 60, 2),
    timeLogHours: round(project.time_log_minutes_sum / 60, 2),
    hoursDiscrepancyFlag: project.hours_discrepancy_flag,
    idAssignedRaw: project.id_assigned_raw,
    smeAssignedRaw: project.sme_assigned_raw,
    legalReviewerRaw: project.legal_reviewer_raw,
    primaryVertical: project.primary_vertical || "Unknown",
    fullVerticalList: project.verticals.join(", "),
    courseType: project.course_type || "Unknown",
    authoringTool: project.authoring_tool || "Unknown",
    courseStyle: project.course_style || "Unknown",
    courseLengthRaw: project.course_length_raw || "Unknown",
    interactionCount: project.interaction_count,
    latestTimeLogDate: project.latest_time_log_date,
    unresolvedSmeFeedbackCount: project.unresolved_sme_feedback_count,
    hasTimeLogs: project.time_log_minutes_sum > 0,
    hasSmeFeedback: project.unresolved_sme_feedback_count > 0 || snapshot.smeJoinAudit.some((row) => row.matched_project_key === project.project_key),
  }));
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
