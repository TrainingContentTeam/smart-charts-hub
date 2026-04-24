export type ProjectSourceDataset = "legacy" | "modern";
export type SourceDataset = ProjectSourceDataset | "time_log" | "sme";

export type WorkEntityType = "project" | "standalone_course" | "operational_work";
export type WorkMatchStatus =
  | "matched_project_work"
  | "reconcilable_unmatched"
  | "standalone_video_course"
  | "non_project_work";

export type SmeJoinStatus = "matched" | "unresolved" | "ambiguous";
export type SmeJoinMethod = "coursekey_exact" | "coursename_fallback" | "manual_alias" | null;
export type JoinConfidence = "high" | "medium" | "manual" | null;
export type SuggestionConfidence = "high" | "medium";
export type RoleGroup = "ID" | "SME" | "Legal" | "Other/External";
export type WorkEntityDecisionType = "project_match" | "standalone_course" | "non_project_work";
export type AliasScope = "all" | "project" | "time_log" | "sme";


export interface UploadHistoryRecord {
  id: string;
  file_name: string;
  row_count: number;
  status: string;
  dataset_type?: string | null;
  user_id?: string | null;
  created_at: string;
}

export interface RawProjectImportRow {
  id: string;
  upload_id: string | null;
  user_id: string | null;
  source_dataset: ProjectSourceDataset;
  source_file_name: string | null;
  row_number: number;
  raw_row: Record<string, unknown>;
  raw_course_name: string;
  normalized_course_name: string;
  compact_course_name: string;
  reporting_label: string;
  reporting_year: string | null;
  raw_status: string;
  raw_time_spent: string;
  project_total_minutes: number;
  id_assigned_raw: string;
  sme_assigned_raw: string;
  legal_reviewer_raw: string;
  vertical_raw: string;
  course_type: string;
  authoring_tool: string;
  course_style: string;
  course_length_raw: string;
  interaction_count: number | null;
  parse_warnings: string[];
  created_at: string;
}

export type RawProjectImportRowDraft = Omit<RawProjectImportRow, "id" | "upload_id" | "user_id" | "created_at">;

export interface RawTimeLogRow {
  id: string;
  upload_id: string | null;
  user_id: string | null;
  source_file_name: string | null;
  row_number: number;
  raw_row: Record<string, unknown>;
  raw_course_name: string;
  normalized_course_name: string;
  compact_course_name: string;
  raw_category: string;
  raw_date: string;
  log_date: string | null;
  raw_time_spent: string;
  minutes: number | null;
  raw_user: string;
  parse_warnings: string[];
  created_at: string;
}

export type RawTimeLogRowDraft = Omit<RawTimeLogRow, "id" | "upload_id" | "user_id" | "created_at">;

export interface RawSmeFeedbackRow {
  id: string;
  upload_id: string | null;
  user_id: string | null;
  source_file_name: string | null;
  row_number: number;
  raw_row: Record<string, unknown>;
  course_key_raw: string;
  course_key_normalized: string;
  course_key_compact: string;
  course_name_raw: string;
  course_name_normalized: string;
  course_name_compact: string;
  reporting_year: string | null;
  survey_date: string | null;
  sme_raw: string;
  instructional_designer_raw: string;
  sme_email_raw: string;
  internal_raw: string;
  hours_worked: number | null;
  amount_billed: number | null;
  parse_warnings: string[];
  created_at: string;
}

export type RawSmeFeedbackRowDraft = Omit<RawSmeFeedbackRow, "id" | "upload_id" | "user_id" | "created_at">;

export interface CourseAliasConfig {
  id: string;
  alias_title_raw: string;
  alias_title_normalized: string;
  alias_title_compact: string;
  canonical_title_raw: string;
  canonical_title_normalized: string;
  canonical_title_compact: string;
  reporting_year: string | null;
  target_project_key: string | null;
  alias_scope: AliasScope;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonAliasConfig {
  id: string;
  alias_name_raw: string;
  alias_name_normalized: string;
  canonical_name: string;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PersonRoleConfig {
  id: string;
  canonical_name: string;
  role_group: RoleGroup;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmeManualJoinOverride {
  id: string;
  course_key_compact: string;
  course_name_compact: string;
  reporting_year: string | null;
  target_project_key: string;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkEntityDecision {
  id: string;
  source_title_raw: string;
  source_title_normalized: string;
  source_title_compact: string;
  reporting_year: string | null;
  decision_type: WorkEntityDecisionType;
  target_project_key: string | null;
  standalone_title: string | null;
  notes: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsPersistenceBundle {
  uploadHistory: UploadHistoryRecord[];
  rawProjectImportRows: RawProjectImportRow[];
  rawTimeLogRows: RawTimeLogRow[];
  rawSmeFeedbackRows: RawSmeFeedbackRow[];
  courseAliasConfig: CourseAliasConfig[];
  personAliasConfig: PersonAliasConfig[];
  personRoleConfig: PersonRoleConfig[];
  smeManualJoinOverrides: SmeManualJoinOverride[];
  workEntityDecisions: WorkEntityDecision[];
}

export interface RawProjectUnionRow extends RawProjectImportRow {
  project_key: string;
  status: string;
  status_rank: number;
}

export interface ProjectDuplicateAuditRow {
  project_key: string;
  kept_row_id: string;
  discarded_row_id: string;
  kept_status_rank: number;
  discarded_status_rank: number;
  kept_project_total_minutes: number;
  discarded_project_total_minutes: number;
  kept_source_dataset: ProjectSourceDataset;
  discarded_source_dataset: ProjectSourceDataset;
  reason: string;
}

export interface ProjectOwnerBridgeRow {
  project_key: string;
  owner_name: string;
  owner_name_raw: string;
}

export interface ProjectVerticalBridgeRow {
  project_key: string;
  vertical: string;
  vertical_raw: string;
}

export interface DimPersonRow {
  person_key: string;
  canonical_name: string;
  role_groups: RoleGroup[];
  observed_raw_names: string[];
}

export interface CanonicalProject {
  project_key: string;
  source_dataset: ProjectSourceDataset;
  raw_course_name: string;
  normalized_course_name: string;
  compact_course_name: string;
  reporting_label: string;
  reporting_year: string | null;
  raw_status: string;
  status: string;
  status_rank: number;
  raw_time_spent: string;
  project_total_minutes: number;
  id_assigned_raw: string;
  sme_assigned_raw: string;
  legal_reviewer_raw: string;
  vertical_raw: string;
  primary_vertical: string;
  verticals: string[];
  course_type: string;
  authoring_tool: string;
  course_style: string;
  course_length_raw: string;
  interaction_count: number | null;
  primary_id_assigned: string | null;
  owner_names: string[];
  time_log_minutes_sum: number;
  hours_discrepancy_minutes: number;
  hours_discrepancy_flag: boolean;
  latest_time_log_date: string | null;
  unresolved_sme_feedback_count: number;
}

export interface MatchSuggestion {
  target_project_key: string;
  candidate_title: string;
  score: number;
  confidence: SuggestionConfidence;
}

export interface TimeLogMatchAuditRow {
  raw_time_log_row_id: string;
  raw_course_name: string;
  normalized_course_name: string;
  compact_course_name: string;
  inferred_reporting_year: string | null;
  matched_project_key: string | null;
  work_match_status: WorkMatchStatus;
  work_entity_type: WorkEntityType | null;
  reason: string;
  suggestion: MatchSuggestion | null;
  candidate_project_keys: string[];
}

export interface WorkEntityRow {
  work_entity_key: string;
  entity_type: WorkEntityType;
  source_origin: "project_union" | "time_log_only";
  raw_title: string;
  normalized_title: string;
  compact_title: string;
  reporting_year: string | null;
  canonical_project_key: string | null;
  alias_source: "none" | "safe_alias" | "manual_alias" | "decision";
  is_user_confirmed: boolean;
  created_from_time_logs: boolean;
}

export interface TimeLogRow {
  raw_time_log_row_id: string;
  raw_course_name: string;
  normalized_course_name: string;
  compact_course_name: string;
  raw_category: string;
  category_phase: string;
  raw_date: string;
  log_date: string | null;
  raw_time_spent: string;
  minutes: number | null;
  raw_user: string;
  canonical_user_name: string;
  role_group: RoleGroup;
  matched_work_entity_key: string | null;
  work_match_status: WorkMatchStatus;
  work_entity_type: WorkEntityType | null;
  work_item_type: "course_like" | "operational" | "unknown";
  matched_project_key: string | null;
}

export interface SmeIdFeedbackRow {
  raw_sme_feedback_row_id: string;
  matched_project_key: string | null;
  join_status: SmeJoinStatus;
  join_method: SmeJoinMethod;
  join_confidence: JoinConfidence;
  reporting_year: string | null;
  survey_date: string | null;
  course_name_raw: string;
  course_key_raw: string;
  instructional_designer: string;
  sme: string;
  overall_collaboration_rating: number | null;
  sme_knowledge_and_expertise: number | null;
  responsiveness: number | null;
  instructional_design_knowledge: number | null;
  contribution_to_development: number | null;
  openness_to_suggestions: number | null;
  deadlines_and_schedule: number | null;
  overall_quality_end_product: number | null;
  sme_assistance_in_interactions: number | null;
  realworld_examples: string;
  promoter_score: number | null;
  additional_comments: string;
}

export interface SmeSmeFeedbackRow {
  raw_sme_feedback_row_id: string;
  matched_project_key: string | null;
  join_status: SmeJoinStatus;
  join_method: SmeJoinMethod;
  join_confidence: JoinConfidence;
  reporting_year: string | null;
  survey_date: string | null;
  course_name_raw: string;
  course_key_raw: string;
  instructional_designer: string;
  sme: string;
  sme_email: string;
  internal: string;
  hours_worked: number | null;
  amount_billed: number | null;
  overall_experience_with_lexipol: number | null;
  clarity_of_goals_and_objectives: number | null;
  staff_responsiveness: number | null;
  adequacy_of_tools_and_resources: number | null;
  training_and_support_provided: number | null;
  use_of_my_expertise: number | null;
  incorporation_of_my_feedback: number | null;
  autonomy_in_course_design: number | null;
  feeling_valued_as_an_sme: number | null;
  likelihood_to_recommend_lexipol: number | null;
  additional_feedback_or_suggestions: string;
}

export interface SmeJoinAuditRow {
  raw_sme_feedback_row_id: string;
  course_name_raw: string;
  course_key_raw: string;
  reporting_year: string | null;
  matched_project_key: string | null;
  join_status: SmeJoinStatus;
  join_method: SmeJoinMethod;
  join_confidence: JoinConfidence;
  candidate_project_keys: string[];
}

export interface AnalyticsSnapshot {
  uploadHistory: UploadHistoryRecord[];
  projectsRawUnion: RawProjectUnionRow[];
  canonicalProjects: CanonicalProject[];
  projectDuplicateAudit: ProjectDuplicateAuditRow[];
  projectOwnerBridge: ProjectOwnerBridgeRow[];
  projectVerticalBridge: ProjectVerticalBridgeRow[];
  dimPerson: DimPersonRow[];
  dimWorkEntity: WorkEntityRow[];
  timeLogs: TimeLogRow[];
  timeLogMatchAudit: TimeLogMatchAuditRow[];
  smeFeedbackIdView: SmeIdFeedbackRow[];
  smeFeedbackSmeView: SmeSmeFeedbackRow[];
  smeJoinAudit: SmeJoinAuditRow[];
  courseAliasConfig: CourseAliasConfig[];
  personAliasConfig: PersonAliasConfig[];
  personRoleConfig: PersonRoleConfig[];
  smeManualJoinOverrides: SmeManualJoinOverride[];
  workEntityDecisions: WorkEntityDecision[];
}
