import {
  CATEGORY_PHASE_MAP,
  DEFAULT_ROLE_GROUP,
  PROJECT_STATUS_RANKS,
} from "@/lib/analytics/constants";
import { buildProjectSuggestion, isLikelyCourseLikeWork, isLikelyNonProjectWork } from "@/lib/analytics/matching";
import {
  compactCourseName,
  normalizeCourseName,
  normalizeLookupValue,
  normalizePersonName,
  normalizeTextPreserveMeaning,
  normalizeVerticalValue,
  parseReportingYear,
  splitMultiValueField,
} from "@/lib/analytics/normalization";
import type {
  AnalyticsPersistenceBundle,
  AnalyticsSnapshot,
  CanonicalProject,
  CourseAliasConfig,
  DimPersonRow,
  JoinConfidence,
  ProjectDuplicateAuditRow,
  ProjectOwnerBridgeRow,
  ProjectVerticalBridgeRow,
  RawProjectImportRow,
  RawProjectUnionRow,
  RoleGroup,
  SmeIdFeedbackRow,
  SmeJoinAuditRow,
  SmeJoinMethod,
  SmeJoinStatus,
  SmeSmeFeedbackRow,
  TimeLogMatchAuditRow,
  TimeLogRow,
  WorkEntityDecision,
  WorkEntityRow,
  WorkEntityType,
  WorkMatchStatus,
} from "@/lib/analytics/types";

type ProjectIndex = {
  byProjectKey: Map<string, CanonicalProject>;
  byCompactTitle: Map<string, CanonicalProject[]>;
};

function getProjectStatus(value: string) {
  const cleaned = normalizeTextPreserveMeaning(value).replace(/\*/g, "");
  return cleaned || "Not Started";
}

function getStatusRank(status: string) {
  return PROJECT_STATUS_RANKS[status] ?? 0;
}

function buildCourseAliasLookup(config: CourseAliasConfig[]) {
  const lookup = new Map<string, string>();
  config.forEach((row) => {
    if (!row.alias_title_normalized || !row.canonical_title_normalized) return;
    lookup.set(normalizeLookupValue(row.alias_title_normalized), row.canonical_title_normalized);
  });
  return lookup;
}

function buildProjectRows(rows: RawProjectImportRow[], aliasLookup: Map<string, string>): RawProjectUnionRow[] {
  return rows.map((row) => {
    const normalizedCourseName = normalizeCourseName(row.raw_course_name, aliasLookup);
    const compactName = compactCourseName(normalizedCourseName);
    const reportingYear = row.reporting_year || parseReportingYear(row.reporting_label);
    const status = getProjectStatus(row.raw_status);

    return {
      ...row,
      normalized_course_name: normalizedCourseName,
      compact_course_name: compactName,
      reporting_year: reportingYear,
      status,
      status_rank: getStatusRank(status),
      project_key: `${compactName}|${reportingYear ?? "unknown"}`,
    };
  });
}

function dedupeProjects(rows: RawProjectUnionRow[]) {
  const groups = new Map<string, RawProjectUnionRow[]>();
  rows.forEach((row) => {
    const existing = groups.get(row.project_key) || [];
    existing.push(row);
    groups.set(row.project_key, existing);
  });

  const canonicalProjects: CanonicalProject[] = [];
  const duplicateAudit: ProjectDuplicateAuditRow[] = [];
  const ownerBridge: ProjectOwnerBridgeRow[] = [];
  const verticalBridge: ProjectVerticalBridgeRow[] = [];

  [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([projectKey, groupedRows]) => {
      const sorted = [...groupedRows].sort((a, b) => {
        if (b.status_rank !== a.status_rank) return b.status_rank - a.status_rank;
        if (b.project_total_minutes !== a.project_total_minutes) return b.project_total_minutes - a.project_total_minutes;
        return a.source_dataset.localeCompare(b.source_dataset) || a.row_number - b.row_number;
      });

      const [winner, ...losers] = sorted;
      const ownerNames = splitMultiValueField(winner.id_assigned_raw);
      const verticals = splitMultiValueField(winner.vertical_raw).map((value) => normalizeVerticalValue(value)).filter(Boolean);

      ownerNames.forEach((ownerName) => {
        ownerBridge.push({
          project_key: projectKey,
          owner_name: ownerName,
          owner_name_raw: ownerName,
        });
      });

      verticals.forEach((vertical) => {
        verticalBridge.push({
          project_key: projectKey,
          vertical,
          vertical_raw: vertical,
        });
      });

      losers.forEach((loser) => {
        duplicateAudit.push({
          project_key: projectKey,
          kept_row_id: winner.id,
          discarded_row_id: loser.id,
          kept_status_rank: winner.status_rank,
          discarded_status_rank: loser.status_rank,
          kept_project_total_minutes: winner.project_total_minutes,
          discarded_project_total_minutes: loser.project_total_minutes,
          kept_source_dataset: winner.source_dataset,
          discarded_source_dataset: loser.source_dataset,
          reason: "highest status rank, then highest project_total_minutes",
        });
      });

      canonicalProjects.push({
        project_key: projectKey,
        source_dataset: winner.source_dataset,
        raw_course_name: winner.raw_course_name,
        normalized_course_name: winner.normalized_course_name,
        compact_course_name: winner.compact_course_name,
        reporting_label: winner.reporting_label,
        reporting_year: winner.reporting_year,
        raw_status: winner.raw_status,
        status: winner.status,
        status_rank: winner.status_rank,
        raw_time_spent: winner.raw_time_spent,
        project_total_minutes: winner.project_total_minutes,
        id_assigned_raw: winner.id_assigned_raw,
        sme_assigned_raw: winner.sme_assigned_raw,
        legal_reviewer_raw: winner.legal_reviewer_raw,
        vertical_raw: winner.vertical_raw,
        primary_vertical: verticals[0] || "",
        verticals,
        course_type: winner.course_type,
        authoring_tool: winner.authoring_tool,
        course_style: winner.course_style,
        course_length_raw: winner.course_length_raw,
        interaction_count: winner.interaction_count,
        primary_id_assigned: ownerNames[0] || null,
        owner_names: ownerNames,
        time_log_minutes_sum: 0,
        hours_discrepancy_minutes: 0,
        hours_discrepancy_flag: false,
        latest_time_log_date: null,
        unresolved_sme_feedback_count: 0,
      });
    });

  return { canonicalProjects, duplicateAudit, ownerBridge, verticalBridge };
}

function buildProjectIndex(canonicalProjects: CanonicalProject[]): ProjectIndex {
  const byProjectKey = new Map<string, CanonicalProject>();
  const byCompactTitle = new Map<string, CanonicalProject[]>();

  canonicalProjects.forEach((project) => {
    byProjectKey.set(project.project_key, project);
    const entries = byCompactTitle.get(project.compact_course_name) || [];
    entries.push(project);
    byCompactTitle.set(project.compact_course_name, entries);
  });

  return { byProjectKey, byCompactTitle };
}

function toLikert(value: unknown): number | null {
  const normalized = normalizeTextPreserveMeaning(value).toLowerCase();
  if (!normalized) return null;

  const explicitNumber = Number.parseInt(normalized, 10);
  if (Number.isFinite(explicitNumber) && explicitNumber >= 1 && explicitNumber <= 5) return explicitNumber;

  const lookup: Record<string, number> = {
    "strongly disagree": 1,
    disagree: 2,
    neutral: 3,
    agree: 4,
    "strongly agree": 5,
  };

  return lookup[normalized] ?? null;
}

function toPromoter(value: unknown): number | null {
  const normalized = normalizeTextPreserveMeaning(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10 ? parsed : null;
}

function getSurveyField(row: Record<string, unknown>, key: string) {
  if (key in row) return row[key];
  const lookupKey = normalizeLookupValue(key);
  const entry = Object.entries(row).find(([candidate]) => normalizeLookupValue(candidate) === lookupKey);
  return entry?.[1];
}

function determineRoleGroup(
  canonicalName: string,
  explicitRoleLookup: Map<string, RoleGroup>,
  idOwnerSet: Set<string>,
  smeSet: Set<string>,
  legalSet: Set<string>,
): RoleGroup {
  const lookupKey = normalizeLookupValue(canonicalName);
  if (explicitRoleLookup.has(lookupKey)) return explicitRoleLookup.get(lookupKey) ?? DEFAULT_ROLE_GROUP;
  if (idOwnerSet.has(lookupKey)) return "ID";
  if (smeSet.has(lookupKey)) return "SME";
  if (legalSet.has(lookupKey)) return "Legal";
  return DEFAULT_ROLE_GROUP;
}

function buildDecisionLookup(decisions: WorkEntityDecision[]) {
  const lookup = new Map<string, WorkEntityDecision>();
  decisions.forEach((decision) => {
    const key = `${decision.source_title_compact}|${decision.reporting_year ?? "unknown"}`;
    lookup.set(key, decision);
    if (!decision.reporting_year) {
      lookup.set(`${decision.source_title_compact}|*`, decision);
    }
  });
  return lookup;
}

function buildWorkEntities(canonicalProjects: CanonicalProject[]): WorkEntityRow[] {
  return canonicalProjects.map((project) => ({
    work_entity_key: `project|${project.project_key}`,
    entity_type: "project",
    source_origin: "project_union",
    raw_title: project.raw_course_name,
    normalized_title: project.normalized_course_name,
    compact_title: project.compact_course_name,
    reporting_year: project.reporting_year,
    canonical_project_key: project.project_key,
    alias_source: "none",
    is_user_confirmed: false,
    created_from_time_logs: false,
  }));
}

function buildDimPeople(
  canonicalProjects: CanonicalProject[],
  timeLogsPeople: Array<{ raw: string; canonical: string; roleGroup: RoleGroup }>,
  surveysPeople: Array<{ raw: string; canonical: string; roleGroup: RoleGroup }>,
): DimPersonRow[] {
  const people = new Map<string, DimPersonRow>();

  const recordPerson = (raw: string, canonical: string, roleGroup: RoleGroup) => {
    if (!canonical) return;
    const key = normalizeLookupValue(canonical);
    const existing = people.get(key) || {
      person_key: key,
      canonical_name: canonical,
      role_groups: [],
      observed_raw_names: [],
    };

    if (!existing.role_groups.includes(roleGroup)) existing.role_groups.push(roleGroup);
    if (raw && !existing.observed_raw_names.includes(raw)) existing.observed_raw_names.push(raw);
    people.set(key, existing);
  };

  canonicalProjects.forEach((project) => {
    splitMultiValueField(project.id_assigned_raw).forEach((name) => recordPerson(name, name, "ID"));
    splitMultiValueField(project.sme_assigned_raw).forEach((name) => recordPerson(name, name, "SME"));
    splitMultiValueField(project.legal_reviewer_raw).forEach((name) => recordPerson(name, name, "Legal"));
  });
  timeLogsPeople.forEach((row) => recordPerson(row.raw, row.canonical, row.roleGroup));
  surveysPeople.forEach((row) => recordPerson(row.raw, row.canonical, row.roleGroup));

  return [...people.values()].sort((a, b) => a.canonical_name.localeCompare(b.canonical_name));
}

function buildSmeOverrideLookup(overrides: AnalyticsPersistenceBundle["smeManualJoinOverrides"]) {
  const lookup = new Map<string, string>();
  overrides.forEach((override) => {
    lookup.set(`${override.course_key_compact}|${override.reporting_year ?? "unknown"}`, override.target_project_key);
    lookup.set(`${override.course_name_compact}|${override.reporting_year ?? "unknown"}`, override.target_project_key);
  });
  return lookup;
}

function resolveSurveyJoin(
  row: AnalyticsPersistenceBundle["rawSmeFeedbackRows"][number],
  projectIndex: ProjectIndex,
  manualLookup: Map<string, string>,
): {
  matchedProjectKey: string | null;
  joinStatus: SmeJoinStatus;
  joinMethod: SmeJoinMethod;
  joinConfidence: JoinConfidence;
  candidateProjectKeys: string[];
} {
  const yearKey = row.reporting_year ?? "unknown";
  const manualKey = manualLookup.get(`${row.course_key_compact}|${yearKey}`) || manualLookup.get(`${row.course_name_compact}|${yearKey}`);
  if (manualKey) {
    return {
      matchedProjectKey: manualKey,
      joinStatus: "matched",
      joinMethod: "manual_alias",
      joinConfidence: "manual",
      candidateProjectKeys: [manualKey],
    };
  }

  const exactCourseKeyProjectKey = row.course_key_compact ? `${row.course_key_compact}|${yearKey}` : "";
  const exactCourseNameProjectKey = row.course_name_compact ? `${row.course_name_compact}|${yearKey}` : "";

  if (exactCourseKeyProjectKey && projectIndex.byProjectKey.has(exactCourseKeyProjectKey)) {
    return {
      matchedProjectKey: exactCourseKeyProjectKey,
      joinStatus: "matched",
      joinMethod: "coursekey_exact",
      joinConfidence: "high",
      candidateProjectKeys: [exactCourseKeyProjectKey],
    };
  }

  if (exactCourseNameProjectKey && projectIndex.byProjectKey.has(exactCourseNameProjectKey)) {
    return {
      matchedProjectKey: exactCourseNameProjectKey,
      joinStatus: "matched",
      joinMethod: "coursename_fallback",
      joinConfidence: "medium",
      candidateProjectKeys: [exactCourseNameProjectKey],
    };
  }

  const fallbackCandidates = projectIndex.byCompactTitle.get(row.course_name_compact) || [];
  if (fallbackCandidates.length === 1) {
    return {
      matchedProjectKey: fallbackCandidates[0].project_key,
      joinStatus: "matched",
      joinMethod: "coursename_fallback",
      joinConfidence: "medium",
      candidateProjectKeys: [fallbackCandidates[0].project_key],
    };
  }

  if (fallbackCandidates.length > 1) {
    return {
      matchedProjectKey: null,
      joinStatus: "ambiguous",
      joinMethod: null,
      joinConfidence: null,
      candidateProjectKeys: fallbackCandidates.map((candidate) => candidate.project_key),
    };
  }

  return {
    matchedProjectKey: null,
    joinStatus: "unresolved",
    joinMethod: null,
    joinConfidence: null,
    candidateProjectKeys: [],
  };
}

function createTimeLogWorkEntity(
  entityType: WorkEntityType,
  compactTitle: string,
  normalizedTitle: string,
  rawTitle: string,
  reportingYear: string | null,
  aliasSource: WorkEntityRow["alias_source"],
  isUserConfirmed: boolean,
): WorkEntityRow {
  return {
    work_entity_key: `${entityType === "standalone_course" ? "standalone" : "operational"}|${compactTitle}|${reportingYear ?? "unknown"}`,
    entity_type: entityType,
    source_origin: "time_log_only",
    raw_title: rawTitle,
    normalized_title: normalizedTitle,
    compact_title: compactTitle,
    reporting_year: reportingYear,
    canonical_project_key: null,
    alias_source: aliasSource,
    is_user_confirmed: isUserConfirmed,
    created_from_time_logs: true,
  };
}

export function buildAnalyticsSnapshot(bundle: AnalyticsPersistenceBundle): AnalyticsSnapshot {
  const courseAliasLookup = buildCourseAliasLookup(bundle.courseAliasConfig);
  const personAliasLookup = new Map(
    bundle.personAliasConfig.map((row) => [normalizeLookupValue(row.alias_name_normalized), row.canonical_name]),
  );
  const explicitRoleLookup = new Map(
    bundle.personRoleConfig.map((row) => [normalizeLookupValue(row.canonical_name), row.role_group]),
  );

  const projectsRawUnion = buildProjectRows(bundle.rawProjectImportRows, courseAliasLookup);
  const { canonicalProjects, duplicateAudit, ownerBridge, verticalBridge } = dedupeProjects(projectsRawUnion);
  const projectIndex = buildProjectIndex(canonicalProjects);
  const workEntityRows = buildWorkEntities(canonicalProjects);

  const idOwnerSet = new Set(
    ownerBridge.map((row) => normalizeLookupValue(normalizePersonName(row.owner_name, personAliasLookup))),
  );
  const smeSet = new Set(
    canonicalProjects.flatMap((project) =>
      splitMultiValueField(project.sme_assigned_raw).map((name) => normalizeLookupValue(normalizePersonName(name, personAliasLookup))),
    ),
  );
  const legalSet = new Set(
    canonicalProjects.flatMap((project) =>
      splitMultiValueField(project.legal_reviewer_raw).map((name) => normalizeLookupValue(normalizePersonName(name, personAliasLookup))),
    ),
  );

  const decisionLookup = buildDecisionLookup(bundle.workEntityDecisions);
  const manualSmeLookup = buildSmeOverrideLookup(bundle.smeManualJoinOverrides);
  const canonicalProjectsByKey = new Map(canonicalProjects.map((project) => [project.project_key, { ...project }]));
  const timeLogRows: TimeLogRow[] = [];
  const timeLogAudit: TimeLogMatchAuditRow[] = [];
  const generatedTimeOnlyEntities = new Map<string, WorkEntityRow>();
  const timeLogResolutionCache = new Map<
    string,
    {
      matchedProjectKey: string | null;
      workMatchStatus: WorkMatchStatus;
      workEntityType: WorkEntityType | null;
      reason: string;
      suggestion: TimeLogMatchAuditRow["suggestion"];
      candidateProjectKeys: string[];
      matchedWorkEntityKey: string | null;
      aliasSource: WorkEntityRow["alias_source"];
      isUserConfirmed: boolean;
    }
  >();
  const timeLogPeople: Array<{ raw: string; canonical: string; roleGroup: RoleGroup }> = [];

  bundle.rawTimeLogRows.forEach((row) => {
    const normalizedTitle = normalizeCourseName(row.raw_course_name, courseAliasLookup);
    const compactTitle = compactCourseName(normalizedTitle);
    const inferredYear = row.log_date ? parseReportingYear(row.log_date) : null;
    const decisionKey = `${compactTitle}|${inferredYear ?? "unknown"}`;
    const decision = decisionLookup.get(decisionKey) || decisionLookup.get(`${compactTitle}|*`) || null;
    const resolutionCacheKey = `${compactTitle}|${inferredYear ?? "unknown"}`;

    if (!timeLogResolutionCache.has(resolutionCacheKey)) {
      const exactProjectKey = inferredYear ? `${compactTitle}|${inferredYear}` : null;
      const exactProject = exactProjectKey ? projectIndex.byProjectKey.get(exactProjectKey) || null : null;
      const sameTitleCandidates = projectIndex.byCompactTitle.get(compactTitle) || [];
      const exactUniqueCandidate = !exactProject && sameTitleCandidates.length === 1 ? sameTitleCandidates[0] : null;

      if (decision?.decision_type === "project_match" && decision.target_project_key) {
        timeLogResolutionCache.set(resolutionCacheKey, {
          matchedProjectKey: decision.target_project_key,
          workMatchStatus: "matched_project_work",
          workEntityType: "project",
          reason: "matched by user-confirmed work entity decision",
          suggestion: null,
          candidateProjectKeys: [decision.target_project_key],
          matchedWorkEntityKey: `project|${decision.target_project_key}`,
          aliasSource: "decision",
          isUserConfirmed: true,
        });
      } else if (decision?.decision_type === "standalone_course") {
        const entity = createTimeLogWorkEntity(
          "standalone_course",
          compactTitle,
          normalizedTitle,
          decision.standalone_title || row.raw_course_name,
          inferredYear,
          "decision",
          true,
        );
        generatedTimeOnlyEntities.set(entity.work_entity_key, entity);
        timeLogResolutionCache.set(resolutionCacheKey, {
          matchedProjectKey: null,
          workMatchStatus: "standalone_video_course",
          workEntityType: "standalone_course",
          reason: "classified by user-confirmed work entity decision",
          suggestion: null,
          candidateProjectKeys: [],
          matchedWorkEntityKey: entity.work_entity_key,
          aliasSource: "decision",
          isUserConfirmed: true,
        });
      } else if (decision?.decision_type === "non_project_work") {
        const entity = createTimeLogWorkEntity(
          "operational_work",
          compactTitle,
          normalizedTitle,
          row.raw_course_name,
          inferredYear,
          "decision",
          true,
        );
        generatedTimeOnlyEntities.set(entity.work_entity_key, entity);
        timeLogResolutionCache.set(resolutionCacheKey, {
          matchedProjectKey: null,
          workMatchStatus: "non_project_work",
          workEntityType: "operational_work",
          reason: "classified by user-confirmed work entity decision",
          suggestion: null,
          candidateProjectKeys: [],
          matchedWorkEntityKey: entity.work_entity_key,
          aliasSource: "decision",
          isUserConfirmed: true,
        });
      } else if (exactProject) {
        timeLogResolutionCache.set(resolutionCacheKey, {
          matchedProjectKey: exactProject.project_key,
          workMatchStatus: "matched_project_work",
          workEntityType: "project",
          reason: "exact compact title + reporting year match",
          suggestion: null,
          candidateProjectKeys: [exactProject.project_key],
          matchedWorkEntityKey: `project|${exactProject.project_key}`,
          aliasSource: "none",
          isUserConfirmed: false,
        });
      } else if (exactUniqueCandidate) {
        timeLogResolutionCache.set(resolutionCacheKey, {
          matchedProjectKey: exactUniqueCandidate.project_key,
          workMatchStatus: "matched_project_work",
          workEntityType: "project",
          reason: "unique compact title match",
          suggestion: null,
          candidateProjectKeys: [exactUniqueCandidate.project_key],
          matchedWorkEntityKey: `project|${exactUniqueCandidate.project_key}`,
          aliasSource: "none",
          isUserConfirmed: false,
        });
      } else {
        const suggestion = buildProjectSuggestion(normalizedTitle, compactTitle, inferredYear, canonicalProjects);

        if (suggestion) {
          timeLogResolutionCache.set(resolutionCacheKey, {
            matchedProjectKey: null,
            workMatchStatus: "reconcilable_unmatched",
            workEntityType: null,
            reason: "high-confidence near match requires admin confirmation",
            suggestion,
            candidateProjectKeys: suggestion ? [suggestion.target_project_key] : [],
            matchedWorkEntityKey: null,
            aliasSource: "none",
            isUserConfirmed: false,
          });
        } else if (isLikelyNonProjectWork(row.raw_course_name, row.raw_category)) {
          const entity = createTimeLogWorkEntity(
            "operational_work",
            compactTitle,
            normalizedTitle,
            row.raw_course_name,
            inferredYear,
            "none",
            false,
          );
          generatedTimeOnlyEntities.set(entity.work_entity_key, entity);
          timeLogResolutionCache.set(resolutionCacheKey, {
            matchedProjectKey: null,
            workMatchStatus: "non_project_work",
            workEntityType: "operational_work",
            reason: "classified as operational/admin/support work",
            suggestion: null,
            candidateProjectKeys: [],
            matchedWorkEntityKey: entity.work_entity_key,
            aliasSource: "none",
            isUserConfirmed: false,
          });
        } else if (isLikelyCourseLikeWork(row.raw_course_name, row.raw_category)) {
          const entity = createTimeLogWorkEntity(
            "standalone_course",
            compactTitle,
            normalizedTitle,
            row.raw_course_name,
            inferredYear,
            "none",
            false,
          );
          generatedTimeOnlyEntities.set(entity.work_entity_key, entity);
          timeLogResolutionCache.set(resolutionCacheKey, {
            matchedProjectKey: null,
            workMatchStatus: "standalone_video_course",
            workEntityType: "standalone_course",
            reason: "classified as course-like work absent from canonical project registry",
            suggestion: null,
            candidateProjectKeys: [],
            matchedWorkEntityKey: entity.work_entity_key,
            aliasSource: "none",
            isUserConfirmed: false,
          });
        } else {
          timeLogResolutionCache.set(resolutionCacheKey, {
            matchedProjectKey: null,
            workMatchStatus: "reconcilable_unmatched",
            workEntityType: null,
            reason: "no deterministic or classified match available",
            suggestion: null,
            candidateProjectKeys: sameTitleCandidates.map((candidate) => candidate.project_key),
            matchedWorkEntityKey: null,
            aliasSource: "none",
            isUserConfirmed: false,
          });
        }
      }
    }

    const resolution = timeLogResolutionCache.get(resolutionCacheKey)!;
    const canonicalUserName = normalizePersonName(row.raw_user, personAliasLookup);
    const roleGroup = determineRoleGroup(canonicalUserName, explicitRoleLookup, idOwnerSet, smeSet, legalSet);
    const categoryPhase = CATEGORY_PHASE_MAP[row.raw_category] || "Other";

    timeLogPeople.push({ raw: row.raw_user, canonical: canonicalUserName, roleGroup });

    timeLogRows.push({
      raw_time_log_row_id: row.id,
      raw_course_name: row.raw_course_name,
      normalized_course_name: normalizedTitle,
      compact_course_name: compactTitle,
      raw_category: row.raw_category,
      category_phase: categoryPhase,
      raw_date: row.raw_date,
      log_date: row.log_date,
      raw_time_spent: row.raw_time_spent,
      minutes: row.minutes,
      raw_user: row.raw_user,
      canonical_user_name: canonicalUserName,
      role_group: roleGroup,
      matched_work_entity_key: resolution.matchedWorkEntityKey,
      work_match_status: resolution.workMatchStatus,
      work_entity_type: resolution.workEntityType,
      work_item_type: resolution.workEntityType === "operational_work"
        ? "operational"
        : resolution.workMatchStatus === "reconcilable_unmatched"
          ? "unknown"
          : "course_like",
      matched_project_key: resolution.matchedProjectKey,
    });

    timeLogAudit.push({
      raw_time_log_row_id: row.id,
      raw_course_name: row.raw_course_name,
      normalized_course_name: normalizedTitle,
      compact_course_name: compactTitle,
      inferred_reporting_year: inferredYear,
      matched_project_key: resolution.matchedProjectKey,
      work_match_status: resolution.workMatchStatus,
      work_entity_type: resolution.workEntityType,
      reason: resolution.reason,
      suggestion: resolution.suggestion,
      candidate_project_keys: resolution.candidateProjectKeys,
    });
  });

  const projectTimeLogSummary = new Map<string, { minutes: number; latestDate: string | null }>();
  timeLogRows.forEach((row) => {
    if (!row.matched_project_key) return;
    const existing = projectTimeLogSummary.get(row.matched_project_key) || { minutes: 0, latestDate: null };
    existing.minutes += row.minutes ?? 0;
    if (row.log_date && (!existing.latestDate || row.log_date > existing.latestDate)) {
      existing.latestDate = row.log_date;
    }
    projectTimeLogSummary.set(row.matched_project_key, existing);
  });

  canonicalProjectsByKey.forEach((project, projectKey) => {
    const timeSummary = projectTimeLogSummary.get(projectKey) || { minutes: 0, latestDate: null };
    project.time_log_minutes_sum = timeSummary.minutes;
    project.latest_time_log_date = timeSummary.latestDate;
    project.hours_discrepancy_minutes = Math.abs(project.project_total_minutes - timeSummary.minutes);
    const percentDelta = project.project_total_minutes > 0
      ? project.hours_discrepancy_minutes / project.project_total_minutes
      : project.hours_discrepancy_minutes > 0
        ? 1
        : 0;
    project.hours_discrepancy_flag = project.hours_discrepancy_minutes > 60 || percentDelta > 0.05;
  });

  const smeFeedbackIdView: SmeIdFeedbackRow[] = [];
  const smeFeedbackSmeView: SmeSmeFeedbackRow[] = [];
  const smeJoinAudit: SmeJoinAuditRow[] = [];
  const surveyPeople: Array<{ raw: string; canonical: string; roleGroup: RoleGroup }> = [];

  bundle.rawSmeFeedbackRows.forEach((row) => {
    const join = resolveSurveyJoin(row, projectIndex, manualSmeLookup);
    const surveyObject = row.raw_row;
    const smeName = normalizePersonName(row.sme_raw, personAliasLookup);
    const instructionalDesigner = normalizePersonName(row.instructional_designer_raw, personAliasLookup);

    surveyPeople.push({ raw: row.sme_raw, canonical: smeName, roleGroup: "SME" });
    surveyPeople.push({ raw: row.instructional_designer_raw, canonical: instructionalDesigner, roleGroup: "ID" });

    smeFeedbackIdView.push({
      raw_sme_feedback_row_id: row.id,
      matched_project_key: join.matchedProjectKey,
      join_status: join.joinStatus,
      join_method: join.joinMethod,
      join_confidence: join.joinConfidence,
      reporting_year: row.reporting_year,
      id_survey_created_at: row.id_survey_created_at ?? null,
      id_survey_date: row.id_survey_date ?? null,
      course_name_raw: row.course_name_raw,
      course_key_raw: row.course_key_raw,
      instructional_designer: instructionalDesigner,
      sme: smeName,
      overall_collaboration_rating: toLikert(getSurveyField(surveyObject, "Overall Rating of SME Collaboration - ID")),
      sme_knowledge_and_expertise: toLikert(getSurveyField(surveyObject, "SME's knowledge and expertise - ID")),
      responsiveness: toLikert(getSurveyField(surveyObject, "Responsiveness - ID")),
      instructional_design_knowledge: toLikert(getSurveyField(surveyObject, "Instructional design knowledge - ID")),
      contribution_to_development: toLikert(getSurveyField(surveyObject, "Contribution to development - ID")),
      openness_to_suggestions: toLikert(getSurveyField(surveyObject, "Openness suggestions and feedback - ID")),
      deadlines_and_schedule: toLikert(getSurveyField(surveyObject, "Deadlines and schedule - ID")),
      overall_quality_end_product: toLikert(getSurveyField(surveyObject, "Overall quality end product - ID")),
      sme_assistance_in_interactions: toLikert(getSurveyField(surveyObject, "SME assistance in interactions - ID")),
      realworld_examples: normalizeTextPreserveMeaning(getSurveyField(surveyObject, "Realworld examples - ID")),
      promoter_score: toPromoter(getSurveyField(surveyObject, "SME Promoter Score - ID")),
      additional_comments: normalizeTextPreserveMeaning(getSurveyField(surveyObject, "Additional Comments - ID")),
    });

    smeFeedbackSmeView.push({
      raw_sme_feedback_row_id: row.id,
      matched_project_key: join.matchedProjectKey,
      join_status: join.joinStatus,
      join_method: join.joinMethod,
      join_confidence: join.joinConfidence,
      reporting_year: row.reporting_year,
      sme_survey_date: row.sme_survey_date ?? null,
      course_name_raw: row.course_name_raw,
      course_key_raw: row.course_key_raw,
      instructional_designer: instructionalDesigner,
      sme: smeName,
      sme_email: normalizeTextPreserveMeaning(row.sme_email_raw).toLowerCase(),
      internal: normalizeTextPreserveMeaning(row.internal_raw),
      hours_worked: row.hours_worked,
      amount_billed: row.amount_billed,
      overall_experience_with_lexipol: toLikert(getSurveyField(surveyObject, "Overall Experience with Lexipol")),
      clarity_of_goals_and_objectives: toLikert(getSurveyField(surveyObject, "Clarity of Goals and Objectives")),
      staff_responsiveness: toLikert(getSurveyField(surveyObject, "Staff Responsiveness")),
      adequacy_of_tools_and_resources: toLikert(getSurveyField(surveyObject, "Adequacy of Tools and Resources")),
      training_and_support_provided: toLikert(getSurveyField(surveyObject, "Training and Support Provided")),
      use_of_my_expertise: toLikert(getSurveyField(surveyObject, "Use of My Expertise")),
      incorporation_of_my_feedback: toLikert(getSurveyField(surveyObject, "Incorporation of My Feedback")),
      autonomy_in_course_design: toLikert(getSurveyField(surveyObject, "Autonomy in Course Design")),
      feeling_valued_as_an_sme: toLikert(getSurveyField(surveyObject, "Feeling Valued as an SME")),
      likelihood_to_recommend_lexipol: toLikert(getSurveyField(surveyObject, "Likelihood to Recommend Lexipol")),
      additional_feedback_or_suggestions: normalizeTextPreserveMeaning(
        getSurveyField(surveyObject, "Additional Feedback or Suggestions"),
      ),
    });

    smeJoinAudit.push({
      raw_sme_feedback_row_id: row.id,
      course_name_raw: row.course_name_raw,
      course_key_raw: row.course_key_raw,
      reporting_year: row.reporting_year,
      matched_project_key: join.matchedProjectKey,
      join_status: join.joinStatus,
      join_method: join.joinMethod,
      join_confidence: join.joinConfidence,
      candidate_project_keys: join.candidateProjectKeys,
    });
  });

  const unresolvedSurveyCounts = new Map<string, number>();
  smeJoinAudit.forEach((auditRow) => {
    if (auditRow.join_status === "matched") return;
    auditRow.candidate_project_keys.forEach((projectKey) => {
      unresolvedSurveyCounts.set(projectKey, (unresolvedSurveyCounts.get(projectKey) || 0) + 1);
    });
  });

  canonicalProjectsByKey.forEach((project, projectKey) => {
    project.unresolved_sme_feedback_count = unresolvedSurveyCounts.get(projectKey) || 0;
  });

  const dimPerson = buildDimPeople(
    [...canonicalProjectsByKey.values()],
    timeLogPeople,
    surveyPeople,
  );

  return {
    uploadHistory: [...bundle.uploadHistory].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    projectsRawUnion,
    canonicalProjects: [...canonicalProjectsByKey.values()].sort((a, b) => a.project_key.localeCompare(b.project_key)),
    projectDuplicateAudit: duplicateAudit,
    projectOwnerBridge: ownerBridge,
    projectVerticalBridge: verticalBridge,
    dimPerson,
    dimWorkEntity: [...workEntityRows, ...generatedTimeOnlyEntities.values()].sort((a, b) =>
      a.work_entity_key.localeCompare(b.work_entity_key),
    ),
    timeLogs: timeLogRows,
    timeLogMatchAudit: timeLogAudit,
    smeFeedbackIdView,
    smeFeedbackSmeView,
    smeJoinAudit,
    courseAliasConfig: bundle.courseAliasConfig,
    personAliasConfig: bundle.personAliasConfig,
    personRoleConfig: bundle.personRoleConfig,
    smeManualJoinOverrides: bundle.smeManualJoinOverrides,
    workEntityDecisions: bundle.workEntityDecisions,
  };
}
