
CREATE TABLE public.canceled_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_name_key text NOT NULL,
  reporting_year text,
  original_course_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid,
  UNIQUE (course_name_key, reporting_year)
);

ALTER TABLE public.canceled_courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read canceled_courses"
  ON public.canceled_courses FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert canceled_courses"
  ON public.canceled_courses FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can delete canceled_courses"
  ON public.canceled_courses FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
