CREATE TABLE public.survey_no_match_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_name_key text NOT NULL,
  original_course_name text NOT NULL,
  reporting_year text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_name_key, reporting_year)
);

ALTER TABLE public.survey_no_match_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read survey_no_match_records"
  ON public.survey_no_match_records FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert survey_no_match_records"
  ON public.survey_no_match_records FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete survey_no_match_records"
  ON public.survey_no_match_records FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
