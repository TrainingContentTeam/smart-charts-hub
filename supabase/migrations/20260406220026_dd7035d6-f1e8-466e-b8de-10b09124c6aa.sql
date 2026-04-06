-- Add dataset_type to upload_history
ALTER TABLE public.upload_history ADD COLUMN IF NOT EXISTS dataset_type text;

-- Create lms_course_info table
CREATE TABLE IF NOT EXISTS public.lms_course_info (
  course_id text NOT NULL PRIMARY KEY,
  original_publish_date text,
  course_type text,
  backend_url text,
  frontend_url text,
  upload_id uuid REFERENCES public.upload_history(id),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lms_course_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all lms_course_info"
  ON public.lms_course_info FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own lms_course_info"
  ON public.lms_course_info FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lms_course_info"
  ON public.lms_course_info FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create lms_course_versions table
CREATE TABLE IF NOT EXISTS public.lms_course_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id text NOT NULL,
  course_version text,
  course_name text,
  authoring_tool text,
  course_description text,
  duration_minutes integer,
  published_date text,
  change_type text,
  lesson_plan text,
  special text,
  ems1a text,
  p1a text,
  fr1a text,
  c1a text,
  lgu text,
  d1a text,
  revamp_date text,
  version_derived boolean DEFAULT false,
  upload_id uuid REFERENCES public.upload_history(id),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lms_course_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all lms_course_versions"
  ON public.lms_course_versions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert own lms_course_versions"
  ON public.lms_course_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own lms_course_versions"
  ON public.lms_course_versions FOR DELETE TO authenticated USING (auth.uid() = user_id);