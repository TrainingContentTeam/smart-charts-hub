CREATE TABLE public.time_match_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_name_key text NOT NULL,
  original_course_name text NOT NULL,
  reporting_year text,
  target_project_key text NOT NULL,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_name_key, reporting_year)
);

ALTER TABLE public.time_match_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read time_match_overrides"
  ON public.time_match_overrides FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert time_match_overrides"
  ON public.time_match_overrides FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete time_match_overrides"
  ON public.time_match_overrides FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
