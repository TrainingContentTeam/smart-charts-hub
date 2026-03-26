

## Problem

The `sme_collaboration_surveys` database table is missing the `internal` column. The upload code tries to insert `internal: e.internal` (a "Yes"/"No"/null string parsed from the "Internal" column in the SME spreadsheet), but the column doesn't exist in the actual database, causing the upload to fail.

## Plan

### Step 1: Add the missing column via database migration

Run a migration to add the `internal` column to the `sme_collaboration_surveys` table:

```sql
ALTER TABLE public.sme_collaboration_surveys
  ADD COLUMN IF NOT EXISTS internal text;
```

This is a nullable text column (matching the existing pattern where "Yes"/"No"/null values are stored as strings), so no existing rows will be affected.

### No code changes needed

The upload code in `UploadData.tsx` and the parser in `parse-sme-survey.ts` already handle the `internal` field correctly. The types.ts already declares the column. Only the database table itself is missing it.

