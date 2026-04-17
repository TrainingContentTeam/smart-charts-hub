import { supabase } from "@/integrations/supabase/client";
import { makeId, readLocalStore, writeLocalStore } from "@/lib/local-data-store";
import type {
  AnalyticsPersistenceBundle,
  CourseAliasConfig,
  PersonAliasConfig,
  PersonRoleConfig,
  RawProjectImportRow,
  RawProjectImportRowDraft,
  RawSmeFeedbackRow,
  RawSmeFeedbackRowDraft,
  RawTimeLogRow,
  RawTimeLogRowDraft,
  SmeManualJoinOverride,
  UploadHistoryRecord,
  WorkEntityDecision,
} from "@/lib/analytics/types";

const BATCH_SIZE = 1000;

export function emptyAnalyticsPersistenceBundle(): AnalyticsPersistenceBundle {
  return {
    uploadHistory: [],
    rawProjectImportRows: [],
    rawTimeLogRows: [],
    rawSmeFeedbackRows: [],
    courseAliasConfig: [],
    personAliasConfig: [],
    personRoleConfig: [],
    smeManualJoinOverrides: [],
    workEntityDecisions: [],
  };
}

async function fetchAllRows(tableName: string, orderColumn = "created_at") {
  const rows: any[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(tableName as any)
      .select("*")
      .order(orderColumn, { ascending: false })
      .range(from, from + BATCH_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    rows.push(...data);
    if (data.length < BATCH_SIZE) break;
    from += BATCH_SIZE;
  }

  return rows;
}

export async function fetchAnalyticsPersistenceBundle(): Promise<AnalyticsPersistenceBundle> {
  const [
    uploadHistory,
    rawProjectImportRows,
    rawTimeLogRows,
    rawSmeFeedbackRows,
    courseAliasConfig,
    personAliasConfig,
    personRoleConfig,
    smeManualJoinOverrides,
    workEntityDecisions,
  ] = await Promise.all([
    fetchAllRows("upload_history"),
    fetchAllRows("raw_project_import_rows"),
    fetchAllRows("raw_time_log_rows"),
    fetchAllRows("raw_sme_feedback_rows"),
    fetchAllRows("course_alias_config"),
    fetchAllRows("person_alias_config"),
    fetchAllRows("person_role_config"),
    fetchAllRows("sme_manual_join_overrides"),
    fetchAllRows("work_entity_decisions"),
  ]);

  return {
    uploadHistory: uploadHistory as UploadHistoryRecord[],
    rawProjectImportRows: rawProjectImportRows as RawProjectImportRow[],
    rawTimeLogRows: rawTimeLogRows as RawTimeLogRow[],
    rawSmeFeedbackRows: rawSmeFeedbackRows as RawSmeFeedbackRow[],
    courseAliasConfig: courseAliasConfig as CourseAliasConfig[],
    personAliasConfig: personAliasConfig as PersonAliasConfig[],
    personRoleConfig: personRoleConfig as PersonRoleConfig[],
    smeManualJoinOverrides: smeManualJoinOverrides as SmeManualJoinOverride[],
    workEntityDecisions: workEntityDecisions as WorkEntityDecision[],
  };
}

function stampRows<T extends object>(rows: T[], uploadId: string, userId: string | null, now: string) {
  return rows.map((row) => ({
    id: makeId(),
    upload_id: uploadId,
    user_id: userId,
    created_at: now,
    ...row,
  }));
}

async function insertRowsInBatches(tableName: string, rows: object[]) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from(tableName as any).insert(batch as any);
    if (error) throw error;
  }
}

export async function replaceSharedImportBundle(params: {
  uploadRecord: UploadHistoryRecord;
  userId: string | null;
  rawProjectImportRows: RawProjectImportRowDraft[];
  rawTimeLogRows: RawTimeLogRowDraft[];
  rawSmeFeedbackRows: RawSmeFeedbackRowDraft[];
}) {
  const { uploadRecord, userId, rawProjectImportRows, rawTimeLogRows, rawSmeFeedbackRows } = params;
  const now = new Date().toISOString();

  const { error: uploadError } = await supabase.from("upload_history").insert(uploadRecord as any);
  if (uploadError) throw uploadError;

  if (rawProjectImportRows.length > 0) {
    const { error: clearError } = await supabase.from("raw_project_import_rows" as any).delete().not("id", "is", null);
    if (clearError) throw clearError;
    await insertRowsInBatches("raw_project_import_rows", stampRows(rawProjectImportRows, uploadRecord.id, userId, now));
  }

  if (rawTimeLogRows.length > 0) {
    const { error: clearError } = await supabase.from("raw_time_log_rows" as any).delete().not("id", "is", null);
    if (clearError) throw clearError;
    await insertRowsInBatches("raw_time_log_rows", stampRows(rawTimeLogRows, uploadRecord.id, userId, now));
  }

  if (rawSmeFeedbackRows.length > 0) {
    const { error: clearError } = await supabase.from("raw_sme_feedback_rows" as any).delete().not("id", "is", null);
    if (clearError) throw clearError;
    await insertRowsInBatches("raw_sme_feedback_rows", stampRows(rawSmeFeedbackRows, uploadRecord.id, userId, now));
  }
}

export async function replaceLocalImportBundle(params: {
  uploadRecord: UploadHistoryRecord;
  userId: string | null;
  rawProjectImportRows: RawProjectImportRowDraft[];
  rawTimeLogRows: RawTimeLogRowDraft[];
  rawSmeFeedbackRows: RawSmeFeedbackRowDraft[];
}) {
  const { uploadRecord, userId, rawProjectImportRows, rawTimeLogRows, rawSmeFeedbackRows } = params;
  const now = new Date().toISOString();
  const local = await readLocalStore();

  const nextBundle: AnalyticsPersistenceBundle = {
    ...local,
    uploadHistory: [uploadRecord, ...local.uploadHistory].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    rawProjectImportRows: rawProjectImportRows.length > 0
      ? (stampRows(rawProjectImportRows, uploadRecord.id, userId, now) as RawProjectImportRow[])
      : local.rawProjectImportRows,
    rawTimeLogRows: rawTimeLogRows.length > 0
      ? (stampRows(rawTimeLogRows, uploadRecord.id, userId, now) as RawTimeLogRow[])
      : local.rawTimeLogRows,
    rawSmeFeedbackRows: rawSmeFeedbackRows.length > 0
      ? (stampRows(rawSmeFeedbackRows, uploadRecord.id, userId, now) as RawSmeFeedbackRow[])
      : local.rawSmeFeedbackRows,
  };

  await writeLocalStore(nextBundle);
}

export async function upsertLocalCourseAlias(row: Omit<CourseAliasConfig, "created_at" | "updated_at">) {
  const local = await readLocalStore();
  const updatedAt = new Date().toISOString();
  const next = local.courseAliasConfig.filter(
    (entry) =>
      !(entry.alias_title_compact === row.alias_title_compact &&
        (entry.reporting_year ?? null) === (row.reporting_year ?? null) &&
        entry.alias_scope === row.alias_scope),
  );
  next.push({
    ...row,
    created_at: updatedAt,
    updated_at: updatedAt,
  });
  await writeLocalStore({ ...local, courseAliasConfig: next });
}

export async function upsertLocalWorkEntityDecision(row: Omit<WorkEntityDecision, "created_at" | "updated_at">) {
  const local = await readLocalStore();
  const updatedAt = new Date().toISOString();
  const next = local.workEntityDecisions.filter(
    (entry) =>
      !(entry.source_title_compact === row.source_title_compact &&
        (entry.reporting_year ?? null) === (row.reporting_year ?? null)),
  );
  next.push({
    ...row,
    created_at: updatedAt,
    updated_at: updatedAt,
  });
  await writeLocalStore({ ...local, workEntityDecisions: next });
}

export async function upsertLocalSmeManualJoin(row: Omit<SmeManualJoinOverride, "created_at" | "updated_at">) {
  const local = await readLocalStore();
  const updatedAt = new Date().toISOString();
  const next = local.smeManualJoinOverrides.filter(
    (entry) =>
      !(entry.course_key_compact === row.course_key_compact &&
        entry.course_name_compact === row.course_name_compact &&
        (entry.reporting_year ?? null) === (row.reporting_year ?? null)),
  );
  next.push({
    ...row,
    created_at: updatedAt,
    updated_at: updatedAt,
  });
  await writeLocalStore({ ...local, smeManualJoinOverrides: next });
}

export async function upsertSharedCourseAlias(row: Omit<CourseAliasConfig, "created_at" | "updated_at">) {
  await supabase.from("course_alias_config" as any).upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "alias_title_compact,reporting_year,alias_scope" },
  );
}

export async function upsertSharedWorkEntityDecision(row: Omit<WorkEntityDecision, "created_at" | "updated_at">) {
  await supabase.from("work_entity_decisions" as any).upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "source_title_compact,reporting_year" },
  );
}

export async function upsertSharedSmeManualJoin(row: Omit<SmeManualJoinOverride, "created_at" | "updated_at">) {
  await supabase.from("sme_manual_join_overrides" as any).upsert(
    {
      ...row,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "course_key_compact,course_name_compact,reporting_year" },
  );
}
