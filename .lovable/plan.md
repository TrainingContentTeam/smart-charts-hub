

## Fix: Project Count Discrepancies (563 vs 547)

### Root Cause

The database has **428 legacy** and **135 modern** projects, but your CSV files contain **425** and **122** respectively. The extras (3 legacy + 13 modern = 16 extra projects) are **leftovers from a previous upload** that were never cleaned up.

The upload logic in `UploadData.tsx` (line 993-997) builds `allCourseKeys` by merging:
1. Existing projects already in the database (`existingMap.keys()`)
2. New legacy file entries
3. New modern file entries

When a project exists in the database from a prior upload but is **not** in the current CSV files, the code skips it (`else { continue }` on line 1041) — it doesn't update it, but it also **doesn't delete it**. So stale projects accumulate.

### Fix

#### 1. Clean up stale projects now
Run a database cleanup to remove the 16 projects that no longer exist in your source files. This requires identifying which projects are stale — we can do this by re-uploading, or by running a targeted deletion.

**Recommended approach**: Add cleanup logic to the upload process so that after upserting all projects from the current files, any project whose `data_source` is `legacy` or `modern` but whose `courseKey` is NOT in the current file set gets **deleted** from the database (along with its associated time entries and SME survey rows).

#### 2. Prevent future staleness (`src/pages/UploadData.tsx`)
After the upsert loop (around line 1090), add a cleanup step:

```text
For each existing project in DB where data_source = 'legacy' or 'modern':
  If its courseKey is NOT in the union of legacyMap.keys() + modernMap.keys():
    Delete the project and its related time_entries and sme_collaboration_surveys
```

This ensures every upload produces an exact mirror of the source files — no more, no less.

### Files Modified
- **`src/pages/UploadData.tsx`** — Add post-upsert cleanup of stale projects
- **Database** — One-time cleanup of the 16 stale project rows (can be triggered by re-uploading after the fix)

### Impact
- Project count will match your CSV totals exactly (547)
- Total hours will adjust accordingly (stale projects' hours removed)
- All downstream charts and counts will reflect accurate data

