

# Full Data Pipeline Refactor: Three-File Canonical Schema

## Context

The application must be rebuilt around three new canonical CSV files that replace all prior data ingestion logic:

1. **Legacy Course Data** (~370 rows) -- completed courses 2022-2025, with authoritative total time in `HH:MM` format and `(L)` suffixed metadata columns
2. **Modern Course Data** (~1+ rows) -- completed courses 2026+, with `(M)` suffixed metadata columns; total time must be derived from Time Spent file
3. **Time Spent Category Data** (~10,300 rows) -- granular entries with columns: `Cousre name` (typo in source), `Category`, `Date`, `Time spent`, `User`

Courses are joined across all three files by **Course Name** (trimmed, case-insensitive, whitespace-normalized). Courses appearing only in the Time Spent file are classified as **In Progress**.

---

## Database Schema Changes

### Migration 1: Add new columns to `projects` table

```sql
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Completed',
  ADD COLUMN IF NOT EXISTS total_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sme text,
  ADD COLUMN IF NOT EXISTS legal_reviewer text,
  ADD COLUMN IF NOT EXISTS data_source text;  -- 'legacy', 'modern', 'time_only'
```

### Migration 2: Add new columns to `time_entries` table

```sql
ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS entry_date date,
  ADD COLUMN IF NOT EXISTS user_name text;
```

These additions are backward-compatible (all nullable or have defaults). No existing columns are removed.

---

## New Parsers (replace existing)

### `src/lib/parse-legacy-course.ts`
- Reads Legacy CSV with `(L)` suffixed headers
- Skips "Total:" summary rows
- Parses `Time spent` from `HH:MM` to decimal hours
- Extracts year from `[LCT] Reporting (L)` by stripping " Courses" suffix (e.g. "2024 Courses" -> "2024")
- Returns: `{ courseName, totalHours, reportingYear, idAssigned, sme, legalReviewer, vertical, courseType, authoringTool, courseStyle, courseLength, interactionCount }`

### `src/lib/parse-modern-course.ts`
- Same structure but reads `(M)` suffixed headers
- Skips "Total:" rows
- Time spent column exists but is NOT used as authoritative total
- Returns same shape as legacy parser

### `src/lib/parse-time-spent.ts`
- Reads the granular Time Spent CSV (note: header has typo "Cousre name")
- Columns: `Cousre name`, `Category`, `Date`, `Time spent`, `User`
- Parses `Time spent` from `HH:MM` to decimal hours
- Returns: `{ courseName, category, date, hours, userName }`

### Delete old parsers
- Remove `src/lib/parse-wrike.ts`
- Remove `src/lib/parse-course-data.ts`
- Remove `src/lib/parse-hours-by-course.ts` (if it exists)

---

## Upload Page Refactor (`src/pages/UploadData.tsx`)

### Three Drop Zones
Layout: `grid-cols-1 md:grid-cols-3`
1. **Legacy Course Data** -- "Completed courses 2022-2025"
2. **Modern Course Data** -- "Completed courses 2026+"
3. **Time Spent Category Data** -- "Granular time entries by category & user"

All three are optional -- partial uploads are supported.

### Import Logic (Classification Engine)

On clicking "Import All":

1. **Build a normalized course name index** across all three files
2. **For each unique course name**, classify:
   - **Case A (Legacy)**: Exists in Legacy file. Use `total_hours` directly from Legacy. Store `data_source = 'legacy'`, `status = 'Completed'`
   - **Case B (Modern)**: Exists in Modern file (not Legacy). Aggregate `total_hours` from Time Spent file. Store `data_source = 'modern'`, `status = 'Completed'`
   - **Case C (In Progress)**: Exists only in Time Spent file. Aggregate `total_hours` from Time Spent. Store `data_source = 'time_only'`, `status = 'In Progress'`
3. **Upsert projects** with all metadata and computed `total_hours`
4. **Insert time_entries** from Time Spent file with `category`, `entry_date`, `user_name` fields populated, linked to project via `project_id`
5. **For Legacy courses**: also insert a single time_entry with `phase = 'Total'`, `hours` = Legacy total (so dashboard queries work uniformly)

### Match Preview
Show: Legacy count, Modern count, Time Spent unique courses, Matched across files, In Progress count, Validation warnings (unmatched names, zero-hour entries).

### Validation & Error Reporting
- Log schema mismatches, missing required fields, encoding issues
- Display warnings in a collapsible panel (not blocking)
- Fail gracefully per-row, not per-file

---

## Dashboard Refactor (`src/pages/Dashboard.tsx`)

### Filter Bar (new)
A horizontal bar at the top with multi-select filters:
- **Year** (from `reporting_year`)
- **Status** (Completed / In Progress)
- **Course Type** (New / Revamp)
- **Authoring Tool** (Rise / LMS / etc.)
- **Vertical**
- **Category** (from Time Spent: "Legal Review LC", "CQO Review LC", etc.)
- **Text search** for course name (fuzzy/substring)

All filters stack combinatorially and update all visualizations in real time.

### KPI Cards (adaptive)
- Total Courses (with completed/in-progress breakdown)
- Total Hours
- Avg Hours/Course
- Categories Tracked
- Users Tracked (from Time Spent `User` column)
- Years Covered

### Charts
1. **Courses per Year** (Bar) -- from `reporting_year`
2. **Avg Hours per Course by Year** (Line) -- using `total_hours` per project
3. **Total Hours by Category** (Horizontal Bar) -- aggregated from time_entries `category`
4. **Completion Status** (Pie/Donut) -- Completed vs In Progress
5. **Avg Hours by Course Type** (Bar) -- New vs Revamp
6. **Avg Hours by Authoring Tool** (Bar) -- Rise vs LMS vs others
7. **Legacy vs Modern Trend** (stacked/grouped bar) -- hours and counts across the 2022-2026+ transition

### Category Summary Table
Replace the Phase Summary table with a Category Summary showing: Category name, Total Hours, Course Count, Avg Hours, User Count.

---

## Projects Page Updates (`src/pages/Projects.tsx`)

- Show `status` badge (Completed / In Progress) on each project card
- Display `total_hours` directly from the project record (not just from time_entries sum)
- Detail view: show category breakdown instead of phase breakdown, plus individual time entries with date and user
- Add filter/search bar matching the dashboard filters

---

## Data Explorer Updates (`src/pages/DataExplorer.tsx`)

- Add `Category`, `Date`, `User` columns to the table
- Update search to include these new fields
- Update CSV export to include new columns

---

## Files Created / Modified / Deleted

| Action | File |
|--------|------|
| Create | `src/lib/parse-legacy-course.ts` |
| Create | `src/lib/parse-modern-course.ts` |
| Create | `src/lib/parse-time-spent.ts` |
| Delete | `src/lib/parse-wrike.ts` |
| Delete | `src/lib/parse-course-data.ts` |
| Rewrite | `src/pages/UploadData.tsx` |
| Rewrite | `src/pages/Dashboard.tsx` |
| Modify | `src/pages/Projects.tsx` |
| Modify | `src/pages/DataExplorer.tsx` |
| Modify | `src/hooks/use-time-data.ts` (query includes new columns) |
| Migration | Add `status`, `total_hours`, `sme`, `legal_reviewer`, `data_source` to `projects` |
| Migration | Add `category`, `entry_date`, `user_name` to `time_entries` |

