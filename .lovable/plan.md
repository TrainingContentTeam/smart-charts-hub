

# Schema reconciliation for the new canonical data model

## Findings

**Code now uses these tables** (checked every `supabase.from(...)` call in `src/`):
- `upload_history` (exists ✓)
- `user_roles` (exists ✓)
- `raw_project_import_rows` (missing ✗)
- `raw_time_log_rows` (missing ✗)
- `raw_sme_feedback_rows` (missing ✗)
- `course_alias_config` (missing ✗)
- `person_alias_config` (missing ✗)
- `person_role_config` (missing ✗)
- `sme_manual_join_overrides` (missing ✗)
- `work_entity_decisions` (missing ✗)

**Edge function** `supabase/functions/chat/index.ts` still queries the legacy `projects` and `time_entries` tables — this is the build error noted under "Check supabase/functions/chat/index.ts" and the reason those legacy tables can't simply be dropped without updating the function first.

**Legacy tables no longer referenced anywhere in `src/`:**
`projects`, `time_entries`, `sme_collaboration_surveys`, `canceled_courses`, `lms_course_info`, `lms_course_versions`, `survey_no_match_records`, `time_match_overrides`.

**Build error in `src/lib/analytics/snapshot.ts` line 655:** typo `resolution.work_match_status` → should be `resolution.workMatchStatus` (the type uses camelCase).

## Plan

### 1. Migration — create the 8 missing canonical tables

All tables get RLS with the same pattern already used in this project: authenticated users can `SELECT` everything; users can `INSERT/UPDATE/DELETE` only rows where `auth.uid() = user_id`. JSON columns (`raw_row`, `parse_warnings`, `suggestion`, `candidate_project_keys`) use `jsonb`. Add the unique constraints the upserts need (`onConflict` keys in `persistence.ts`):
- `course_alias_config` UNIQUE `(alias_title_compact, reporting_year, alias_scope)`
- `work_entity_decisions` UNIQUE `(source_title_compact, reporting_year)`
- `sme_manual_join_overrides` UNIQUE `(course_key_compact, course_name_compact, reporting_year)`

Columns mirror the TypeScript interfaces in `src/lib/analytics/types.ts` exactly.

### 2. Migration — drop legacy tables

Drop (after fixing the chat function in step 3): `projects`, `time_entries`, `sme_collaboration_surveys`, `canceled_courses`, `lms_course_info`, `lms_course_versions`, `survey_no_match_records`, `time_match_overrides`.

### 3. Update `supabase/functions/chat/index.ts`

Replace `projects`/`time_entries` queries with calls to the new raw tables (`raw_project_import_rows`, `raw_time_log_rows`) so the chatbot keeps working after the legacy tables are dropped. Map field names to the new schema in the prompt context.

### 4. Fix the snapshot typo

In `src/lib/analytics/snapshot.ts` line 655, change `resolution.work_match_status` to `resolution.workMatchStatus`. This clears the TS build error.

### 5. Regenerated `src/integrations/supabase/types.ts`

Will regenerate automatically once the migration runs — no manual edit.

## Result

- Schema cache will contain every table the new code queries → the `raw_project_import_rows` runtime error disappears.
- TypeScript build succeeds (snapshot typo + chat function fixed).
- Database no longer carries dead legacy tables.
- All RLS policies follow the existing project pattern.

