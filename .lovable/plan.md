

# Fix Projects Page: Parser Rewrite and Data Re-import

## Problem

The Projects tab shows cards with **0 hours** because the `time_entries` table is completely empty. The previous upload created 2,071 project rows but saved zero time entries. This happened because the **time entry CSV parser doesn't understand the hierarchical format** of your CSV file.

### How Your Time CSV Actually Works

Your CSV has a 3-level hierarchy with only 2 columns:

```text
ProjectName (count), totalTime        <-- Level 1: Project header
  PhaseName (count), phaseTime        <-- Level 2: Phase header
  ProjectName, entryTime              <-- Level 3: Individual time entry
  ProjectName, entryTime
  AnotherPhase (count), phaseTime     <-- Next phase
  ProjectName, entryTime
NextProject (count), totalTime        <-- Next project
```

The current parser assumes zero-time rows are project headers, but your project headers have total times. The pattern is:
- **Project row**: name with `(N)` suffix, marks the start of a new project
- **Phase row**: different name with `(N)` suffix under a project
- **Entry row**: repeats the project name with individual time

### Additional Issue: Reporting Year Cleanup

The `reporting_year` values currently have counts appended (e.g., "2025 Courses (193)" instead of "2025 Courses"). The course data parser should strip those counts.

## Plan

### Step 1: Rewrite `src/lib/parse-wrike.ts`

Replace the parsing logic with a state machine that understands the hierarchy:
- Detect **project headers**: rows where the task name has a `(N)` suffix AND the next non-header rows repeat that same name (without the suffix)
- Detect **phase headers**: rows with `(N)` suffix that appear under a project, where the name differs from the current project
- Detect **entry rows**: rows that match the current project name, belonging to the current phase
- Each entry gets: `project` (current project name without count suffix), `phase` (current phase name without count suffix), `hours`, `quarter` (empty for CSV)

### Step 2: Fix `src/lib/parse-course-data.ts`

Strip the count suffix from `reporting_year` values. For example, "2024 Courses (98)" becomes "2024 Courses".

### Step 3: Clear existing bad data and re-import

Write a database migration to:
- Delete all existing `time_entries` (there are 0 anyway)
- Delete all existing `projects` (2,071 rows, many are junk like dates and phase names that got incorrectly created as projects)
- Delete `upload_history` records

This gives a clean slate for the user to re-upload with the fixed parsers.

### Step 4: Support CSV files in parsers

Both parsers use XLSX library which already handles CSV, but the `parseCourseDataFile` column detection needs to handle the `[LCT]` prefixed headers (e.g., `[LCT] ID Assigned`). Verify and fix column matching patterns.

## Technical Details

### `parse-wrike.ts` - New Algorithm

```text
for each row:
  taskName = row["Task name"]
  timeSpent = row["Time spent"]
  
  if taskName matches /^(.+?)\s*\(\d+\)$/:
    baseName = match[1].trim()
    if baseName != currentProject:
      // This is a new project header
      currentProject = baseName
      currentPhase = ""
    else:
      // Same name as project with count = still project summary, skip
    // Either way, if it's a different name than current project:
    if baseName != currentProject (already set above):
      currentPhase = baseName  // It's a phase header
    continue  // Skip header rows (they contain totals, not individual entries)
  
  if taskName and timeSpent:
    // This is an individual time entry
    phase = currentPhase or "Uncategorized"
    project = currentProject or "Unknown Project"
    entries.push({ project, phase, hours, ... })
```

Actually, the simpler pattern visible in the data:
- A row with `(N)` where the name is NEW = project header
- A row with `(N)` where name differs from project = phase header  
- A row WITHOUT `(N)` = individual entry belonging to currentProject + currentPhase

### `parse-course-data.ts` - Reporting Year Fix

Add a line to strip count suffixes:
```typescript
reportingYear: String(row[yearCol] || "")
  .trim()
  .replace(/\s*\(\d+\)$/, "")  // "2024 Courses (98)" -> "2024 Courses"
```

### Database Migration

```sql
DELETE FROM time_entries;
DELETE FROM upload_history;
DELETE FROM projects;
```

### Files Modified
1. `src/lib/parse-wrike.ts` -- Complete rewrite of parsing logic
2. `src/lib/parse-course-data.ts` -- Strip count from reporting year
3. Database migration to clear bad data

After these changes, you'll re-upload both CSV files and the data will be correctly parsed and correlated.

