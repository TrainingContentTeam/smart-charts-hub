## Plan: align SME ingestion to the actual DB schema and the new survey spec

### Confirmed root cause of the upload failure
The DB table `raw_sme_feedback_rows` only has `survey_date` (text) for date — there are no `id_survey_*`, `sme_survey_*`, or `*_source` columns. But the app code (`source-readers.ts`, `types.ts`, `local-data-store.ts`, `snapshot.ts`, fixtures, tests) still emits and reads those legacy fields. That's why the insert fails with `Could not find the 'id_survey_created_at' column of 'raw_sme_feedback_rows' in the schema cache`. There is no longer a "Created" column in the source file either.

### Survey spec being applied
- **SME-completed columns**: `CourseKey`, `Course Name`, `Year`, `Internal`, `Hours Worked`, `Amount Billed`, `Survey Date`, `SME`, `SME Email`, then the 11 Likert questions ending with `Additional Feedback or Suggestions`.
- **ID-completed columns** — every header ends with ` - ID`: `Instructional Designer - ID`, `Overall Rating of SME Collaboration - ID`, `SME's knowledge and expertise - ID`, `Responsiveness - ID`, `Instructional design knowledge - ID`, `Contribution to development - ID`, `Openness suggestions and feedback - ID`, `Deadlines and schedule - ID`, `Overall quality end product - ID`, `SME assistance in interactions - ID`, `Realworld examples - ID`, `SME Promoter Score - ID`, `Additional Comments - ID`.
- `Survey Date` (M/D/YY or M/D/YYYY) is the single canonical date for the row.

### Changes

#### 1. `src/lib/analytics/source-readers.ts` — `buildSmeDraft`
- Remove all reads of `Created` and emission of `id_survey_raw_created`, `id_survey_created_at`, `id_survey_date`, `id_survey_date_source`, `sme_survey_raw_date`, `sme_survey_date`, `sme_survey_date_source`.
- Parse `Survey Date` with `parseApprovedUsShortDate` and write the result to `survey_date` only (text column).
- Drop the `parseApprovedUsLocalDateTime`, `extractDateFromLocalDateTime` imports.
- Keep the row-level warning for an unparseable `Survey Date` (file/row/column/value), but drop the "ID survey block / Created" warning entirely.
- Continue mapping `Instructional Designer - ID` to `instructional_designer_raw`.

#### 2. `src/lib/analytics/types.ts`
- In `RawSmeFeedbackRow`: remove `id_survey_raw_created`, `id_survey_created_at`, `id_survey_date`, `id_survey_date_source`, `sme_survey_raw_date`, `sme_survey_date`, `sme_survey_date_source`. Add `survey_date: string | null`.
- In `SmeIdFeedbackRow`: remove `id_survey_created_at` and `id_survey_date`; add `survey_date: string | null`.
- In `SmeSmeFeedbackRow`: replace `sme_survey_date` with `survey_date: string | null`.
- Remove the `SurveyDateSource` type.

#### 3. `src/lib/analytics/snapshot.ts`
- In `smeFeedbackIdView.push(...)`: replace `id_survey_created_at` / `id_survey_date` with `survey_date: row.survey_date ?? null`.
- In `smeFeedbackSmeView.push(...)`: replace `sme_survey_date` with `survey_date: row.survey_date ?? null`.
- Keep the existing `- ID` suffixed `getSurveyField(...)` lookups for the ID-block questions exactly as they are — they already match the spec.
- Keep existing SME-block lookups for the 10 Likert questions and `Additional Feedback or Suggestions`.

#### 4. `src/lib/analytics/field-parsers.ts`
- Remove `parseApprovedUsLocalDateTime` and `extractDateFromLocalDateTime` (no longer used after change #1). Keep `parseApprovedUsShortDate` and `parseApprovedDurationHoursMinutes`.

#### 5. `src/lib/local-data-store.ts`
- Replace `migrateLegacySmeRow` with a small migrator that maps any legacy `id_survey_date` / `sme_survey_date` / `survey_date` field into a single `survey_date: string | null`, and strips the legacy keys. Cast through `unknown` to satisfy TS:
  - `parsed.rawSmeFeedbackRows.map((row) => migrateLegacySmeRow(row as unknown as Record<string, unknown>)) as unknown as RawSmeFeedbackRow[]`.

#### 6. Selectors / consumers that read the removed fields
- Search `src/lib/analytics/selectors.ts`, `src/pages/SmeCollaboration.tsx`, `src/pages/PersonDetail.tsx`, `src/pages/Reconciliation.tsx`, `src/pages/DataExplorer.tsx`, and any other page/component for `id_survey_date`, `id_survey_created_at`, `sme_survey_date`, and update each to read `survey_date` instead. (Single canonical date now powers timelines and date filters.)

#### 7. Tests + fixtures
- `src/test/fixtures/analytics-ui-fixture.ts`: replace all `id_survey_created_at` / `id_survey_date` / `sme_survey_date` fixture fields with `survey_date`.
- `src/test/analytics-snapshot.test.ts`: drop legacy date fields from input rows, keep `survey_date`, update assertions to check `survey_date` on both ID and SME views.
- `src/test/analytics-selectors.test.ts`: replace `sme_survey_date` with `survey_date`.
- `src/test/analytics-source-readers.test.ts`: remove "Created" column from inputs, assert `survey_date` is parsed and `id_survey_*` fields are gone.
- Delete or rewrite `src/test/parse-sme-survey.test.ts` to no longer depend on `idSurveyCreatedAt` / `idSurveyDate` (it currently asserts those).
- `src/lib/parse-sme-survey.ts`: simplify the standalone parser to drop the `id_survey_*` outputs, keep `surveyDate` from `Survey Date` only.

#### 8. `supabase/functions/chat/index.ts`
- This file has stale field references flagged by the build error. Inspect and update to no longer select removed columns (it currently doesn't query `raw_sme_feedback_rows`, but verify and adjust if any references slipped in).

#### 9. TypeScript build errors flagged in the message
- `src/pages/Development.tsx`: the `useTableSort` hook is currently typed only for `"latestTimeLogDate"`. Widen its generic to `<"projectName" | "status" | "owner" | "latestTimeLogDate">` (matches `DevelopmentLatestActivitySortKey`) so the four `toggleSort` calls type-check.
- `src/test/analytics-ui-pages.test.tsx` line 111: cast through `unknown` — `as unknown as ReturnType<typeof useAuth>` — because the partial mock omits `Session.access_token` etc.
- `src/lib/local-data-store.ts` lines 60–61: addressed by the migrator rewrite above with the `unknown` cast.

### Files to update
- `src/lib/analytics/source-readers.ts`
- `src/lib/analytics/types.ts`
- `src/lib/analytics/snapshot.ts`
- `src/lib/analytics/selectors.ts`
- `src/lib/analytics/field-parsers.ts`
- `src/lib/local-data-store.ts`
- `src/lib/parse-sme-survey.ts`
- `src/pages/Development.tsx`
- `src/pages/SmeCollaboration.tsx`, `src/pages/PersonDetail.tsx`, `src/pages/Reconciliation.tsx`, `src/pages/DataExplorer.tsx` (only if they reference removed fields)
- `src/test/fixtures/analytics-ui-fixture.ts`
- `src/test/analytics-snapshot.test.ts`
- `src/test/analytics-selectors.test.ts`
- `src/test/analytics-source-readers.test.ts`
- `src/test/parse-sme-survey.test.ts`
- `supabase/functions/chat/index.ts` (verify only)

### Expected result
- Uploads of the new SME survey CSV insert successfully — no more `id_survey_created_at` schema-cache errors.
- `survey_date` (parsed from `Survey Date`) is the single canonical date for every SME feedback row, used everywhere the UI previously used `id_survey_date` / `sme_survey_date`.
- All 13 ID-block questions (headers ending in ` - ID`) and all 11 SME-block questions parse correctly.
- TypeScript build passes (Development sort generics, useAuth mock cast, local-data-store migrator).
- Existing tests are updated to match the simplified schema and pass.
