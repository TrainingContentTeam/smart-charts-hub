

# Master Content Inventory — Database + UI Updates

## Problem

Three things need to happen:
1. **Database tables missing**: The `lms_course_info` and `lms_course_versions` tables don't exist in the database, and `upload_history` is missing a `dataset_type` column. The upload page code already references these, so uploads fail.
2. **Construction icon**: The sidebar shows a construction icon next to "Master Content Inventory" — it should be removed since the page is ready.
3. **Filter scoping**: The filters card currently affects the summary stats cards and charts (Vertical Coverage, Catalog Age). They should only affect the Catalog Browser table at the bottom.

---

## Plan

### Step 1 — Create database tables and add missing column (migration)

Run a single migration with:

**Add `dataset_type` column to `upload_history`:**
```sql
ALTER TABLE public.upload_history ADD COLUMN IF NOT EXISTS dataset_type text;
```

**Create `lms_course_info` table:**
- Columns: `course_id` (text, PK), `original_publish_date` (text), `course_type` (text), `backend_url` (text), `frontend_url` (text), `upload_id` (uuid, FK → upload_history), `user_id` (uuid), `created_at` (timestamptz), `updated_at` (timestamptz)
- RLS: authenticated can SELECT all, INSERT/DELETE own rows (by user_id)

**Create `lms_course_versions` table:**
- Columns: `id` (uuid, PK), `course_id` (text), `course_version` (text), `course_name` (text), `authoring_tool` (text), `course_description` (text), `duration_minutes` (integer), `published_date` (text), `change_type` (text), `lesson_plan` (text), `special` (text), `ems1a`/`p1a`/`fr1a`/`c1a`/`lgu`/`d1a` (text), `revamp_date` (text), `version_derived` (boolean), `upload_id` (uuid, FK → upload_history), `user_id` (uuid), `created_at` (timestamptz), `updated_at` (timestamptz)
- RLS: authenticated can SELECT all, INSERT/DELETE own rows (by user_id)

### Step 2 — Remove construction icon from sidebar

In `src/components/AppSidebar.tsx`, move "Master Content Inventory" from `underConstructionNavItems` into `primaryNavItems` (or a new non-construction group). If "Accreditation" is the only remaining construction item, keep that section for it alone.

### Step 3 — Scope filters to Catalog Browser only

In `src/pages/MasterContentInventory.tsx`:
- The summary cards (total courses, multi-version, undated, linked metadata), the Vertical Coverage chart, and the Catalog Age chart should always use the full unfiltered `combinedCourses` dataset
- The filters card (search, vertical, content type, authoring tool, age group, multiple versions) should be moved visually into (or just above) the Catalog Browser section
- Only the `browserFilteredCourses` list uses filters — this is already the case in code, **except** the summary cards currently show "Filtered" counts. Update the summary cards to use `combinedCourses.length` instead of being affected by filters. The charts already use `combinedCourses` so they're fine.
- Move the Filters card from its current position (between the header and the stats) to just before the Catalog Browser card

