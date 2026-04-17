
## Fix plan for the CSV ingestion failure

### What I found
- The most likely failing field is the **Time Log `Date` column** being inserted into `raw_time_log_rows.log_date`, because that is the only current upload field being persisted to a real DB `date` column from user source data.
- `reporting_year` is text, `raw_date` is text, and `survey_date` in the canonical SME raw table is text, so they would not produce this database error directly.
- The error string `+045217-01` strongly suggests an **Excel serial like `45217`** is still being treated as a date-like year/timestamp somewhere in the import path.
- The current pipeline already has some safe parsing in `src/lib/analytics/source-readers.ts`, but the **tabular reader still allows spreadsheet inference** instead of forcing a text-first import, and warnings do **not** currently tell you the exact file/row/column/value that failed.
- Column mapping is header-based, not positional, so a true “column shift” is less likely than **bad header normalization / duplicate headers / inferred cell coercion**, but the upload flow currently does not explicitly audit or surface those conditions.

## Root issue
The ingestion flow is still too permissive before transformation:
- CSV/XLS/XLSX values are not being staged in a fully text-safe way first
- date parsing is happening without enough source diagnostics
- invalid date-like values can still reach a typed column instead of being nulled safely

## Implementation plan

### 1. Make the reader text-first
Update the shared upload reader in `src/lib/analytics/source-readers.ts` so all incoming sheet values are staged as raw text first:
- avoid aggressive spreadsheet/date inference during CSV/XLS/XLSX load
- preserve the original raw cell text for every imported field
- keep raw row payloads unchanged for debugging

This makes the import pipeline:
```text
file -> raw text row -> controlled field mapping -> controlled date parsing -> DB insert
```

### 2. Centralize controlled date parsing
Create one strict parser for upload dates and use it everywhere in the canonical ingestion flow.
Accepted formats only:
- Excel serial numbers as numbers or numeric strings, including decimals like `45217.0`
- `YYYY-MM-DD`
- `M/D/YYYY`
- optionally ISO datetime only when the target field is actually datetime

Rejected values:
- arbitrary text
- malformed numeric/date hybrids
- anything outside a safe year window

Behavior:
- return normalized ISO string when valid
- return `null` when invalid
- never rely on freeform `new Date(string)` for upload fields

### 3. Apply parsing only to true date fields
Restrict date parsing to specific mapped fields only:
- Time log `Date` -> `raw_date` stays raw text, `log_date` becomes validated ISO or `null`
- SME `Survey Date` -> raw source preserved, parsed value stored only if valid
- reporting year continues through dedicated year parsing only

Do not date-parse:
- course names
- freeform text
- status fields
- raw JSON payloads
- unrelated numeric columns

### 4. Add header/mapping validation
Strengthen file-to-column mapping before row transformation:
- validate required headers per file type
- detect missing or duplicate logical headers
- surface when the expected `Date`/`Survey Date` header is not confidently resolved
- include a file-level warning if mapping is ambiguous so the import does not silently misread columns

### 5. Surface exact parse diagnostics
Extend warnings so they include:
- file name
- row number
- column name
- raw source value
- reason it was rejected

Example outcome:
```text
Time Logs, row 184, column Date: "45217.0" could not be confidently parsed; stored raw_date and set log_date=null
```

### 6. Keep import resilient instead of failing hard
Update the upload flow so malformed date values do not abort the whole import:
- preserve raw source text
- store parsed date fields as `null` when invalid
- continue importing remaining rows
- show aggregated warnings in the Upload page

### 7. Align older duplicate parsers
Bring the older helpers into the same safe behavior so the bug does not return in other flows:
- `src/lib/parse-time-spent.ts`
- `src/lib/parse-sme-survey.ts`
- `src/lib/parse-catalog-date.ts`

Best approach: reuse the same strict helper rather than keeping multiple date parsers.

### 8. Add regression tests
Add tests covering:
- Excel serial as number: `45217`
- Excel serial as string: `"45217"`
- Excel serial as decimal string: `"45217.0"` / `"45217.5"`
- valid slash date: `"3/1/2026"`
- valid ISO date: `"2026-03-01"`
- malformed values that must become `null`
- header mismatch / ambiguous column detection
- import rows retaining raw text while parsed date becomes `null`

## Files to update
- `src/lib/analytics/source-readers.ts`
- new shared date parsing helper under `src/lib/analytics/` or `src/lib/`
- `src/pages/UploadData.tsx`
- `src/lib/parse-time-spent.ts`
- `src/lib/parse-sme-survey.ts`
- `src/lib/parse-catalog-date.ts`
- related tests under `src/test/`

## Expected result
After this reconciliation:
- CSV uploads will no longer crash on malformed date-like values
- the invalid `45217`-style source value will be isolated to its exact file/row/column
- raw source values will be preserved for debugging
- only validated values will reach typed date fields
- bad dates will become `null`, not broken timezone/timestamp casts
