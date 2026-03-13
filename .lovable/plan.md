

## Canceled Course Tracking for Legacy Upload Review

### Context
When legacy time entries have no matching project, it's often because the course was canceled. Since the legacy CSV lacks a "Canceled" status value (unlike the Modern CSV which already has it), users need a way to mark these unmatched legacy time groups as canceled during review, and have that remembered across future uploads.

### Database

**New table: `canceled_courses`**
- `id` (uuid, PK)
- `course_name_key` (text, normalized lowercase) 
- `reporting_year` (text, nullable)
- `original_course_name` (text, for display)
- `created_at` (timestamptz)
- `user_id` (uuid)
- UNIQUE constraint on `(course_name_key, reporting_year)`
- RLS: authenticated can SELECT; admins can INSERT/UPDATE/DELETE

### Upload Review UI Changes (UploadData.tsx)

In the "Rows That Need Fixes" section, for each **unmatched time group** card:

1. Add a **"Canceled Project"** checkbox at the top of the group card (only when the group's time entries come from a legacy-era context, i.e. no modern project match exists for this name)
2. When checked:
   - The group card gets muted/strikethrough styling
   - The match selectors and course name edit are disabled
   - The group is tracked in new state: `canceledGroups: Set<string>` (keyed by `groupKey`)
3. New state: `canceledGroups` (`Set<string>`)

### Auto-Detection from Prior Uploads

- On component mount (or when files change), fetch all rows from `canceled_courses`
- When `unmatchedTimeGroups` is computed, check each group's `normKey(courseName)` + inferred year against the canceled records
- If matched, auto-add to `canceledGroups` and show a subtle label: "Previously marked as canceled"
- User can uncheck to override

### Import Logic Changes

- During `importData()`, for each group in `canceledGroups`:
  - Insert into `canceled_courses` (upsert by unique key) if not already there
  - Skip all time entries in that group (do not insert into `time_entries`)
- Update summary toast to reflect skipped canceled entries

### Scoping: Legacy Only

The canceled checkbox only appears for unmatched time groups where:
- No modern project variant exists for that course name (i.e., the course only appears in legacy data or has no project match at all)
- Modern courses with a "Canceled" status are handled natively by the status column in the Modern CSV parser

### Files Changed

- **Migration**: Create `canceled_courses` table + RLS policies
- **`src/pages/UploadData.tsx`**:
  - Add `canceledGroups` state
  - Fetch `canceled_courses` on mount, auto-populate `canceledGroups`
  - Render checkbox + visual treatment per unmatched group card
  - In `importData()`: persist new canceled entries, skip canceled time rows
  - Update summary counts

