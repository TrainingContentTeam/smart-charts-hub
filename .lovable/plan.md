

# Fix: Stale Chart Data and Missing Database Tables

## What this fixes

1. **Constant 404 errors** — Two tables (`survey_no_match_records` and `time_match_overrides`) are referenced in code but don't exist in the database, causing nonstop failed requests that can interfere with data loading.
2. **Stale cached data after upload** — React Query has no retry limits or staleness window, so old data can persist. Also, some query keys (`canceled_courses`, `lms_course_info`, `lms_course_versions`) are not invalidated after project batch uploads.

## Steps

### Step 1 — Database migration: create the two missing tables

```sql
CREATE TABLE public.survey_no_match_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_name_key text NOT NULL,
  original_course_name text NOT NULL,
  reporting_year text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.survey_no_match_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read survey_no_match" ON public.survey_no_match_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own survey_no_match" ON public.survey_no_match_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own survey_no_match" ON public.survey_no_match_records FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.time_match_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_name_key text NOT NULL,
  original_course_name text NOT NULL,
  reporting_year text,
  target_project_key text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.time_match_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read time_match_overrides" ON public.time_match_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own time_match_overrides" ON public.time_match_overrides FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own time_match_overrides" ON public.time_match_overrides FOR DELETE TO authenticated USING (auth.uid() = user_id);
```

### Step 2 — Configure QueryClient with retry limits

In `src/App.tsx`, change:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});
```

### Step 3 — Add missing cache invalidation keys after project batch upload

In `src/pages/UploadData.tsx` around line 1145, add invalidation for `canceled_courses`, `lms_course_info`, and `lms_course_versions` to the project batch upload success block.

