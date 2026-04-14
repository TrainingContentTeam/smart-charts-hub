
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
