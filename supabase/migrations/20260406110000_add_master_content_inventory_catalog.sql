ALTER TABLE public.upload_history
  ADD COLUMN IF NOT EXISTS dataset_type text;

CREATE TABLE public.lms_course_info (
  course_id text PRIMARY KEY,
  original_publish_date date,
  course_type text,
  backend_url text,
  frontend_url text,
  upload_id uuid REFERENCES public.upload_history(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lms_course_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id text NOT NULL,
  course_version text NOT NULL,
  course_name text,
  authoring_tool text,
  course_description text,
  duration_minutes integer,
  published_date date,
  change_type text,
  revamp_date date,
  version_derived boolean NOT NULL DEFAULT false,
  upload_id uuid REFERENCES public.upload_history(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, course_version)
);

ALTER TABLE public.lms_course_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lms_course_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read lms_course_info"
  ON public.lms_course_info FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert lms_course_info"
  ON public.lms_course_info FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update lms_course_info"
  ON public.lms_course_info FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete lms_course_info"
  ON public.lms_course_info FOR DELETE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can read lms_course_versions"
  ON public.lms_course_versions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert lms_course_versions"
  ON public.lms_course_versions FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update lms_course_versions"
  ON public.lms_course_versions FOR UPDATE TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete lms_course_versions"
  ON public.lms_course_versions FOR DELETE TO authenticated
  USING (true);
