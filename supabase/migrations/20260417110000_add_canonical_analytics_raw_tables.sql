-- Canonical analytics remodel: raw import tables plus durable reconciliation/config state.

CREATE TABLE IF NOT EXISTS public.raw_project_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES public.upload_history(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  source_dataset text NOT NULL CHECK (source_dataset IN ('legacy', 'modern')),
  source_file_name text,
  row_number integer NOT NULL,
  raw_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_course_name text NOT NULL,
  normalized_course_name text NOT NULL,
  compact_course_name text NOT NULL,
  reporting_label text,
  reporting_year text,
  raw_status text,
  raw_time_spent text,
  project_total_minutes integer NOT NULL DEFAULT 0,
  id_assigned_raw text,
  sme_assigned_raw text,
  legal_reviewer_raw text,
  vertical_raw text,
  course_type text,
  authoring_tool text,
  course_style text,
  course_length_raw text,
  interaction_count integer,
  parse_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raw_project_import_rows_compact_year_idx
  ON public.raw_project_import_rows (compact_course_name, reporting_year);

CREATE TABLE IF NOT EXISTS public.raw_time_log_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES public.upload_history(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  source_file_name text,
  row_number integer NOT NULL,
  raw_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_course_name text NOT NULL,
  normalized_course_name text NOT NULL,
  compact_course_name text NOT NULL,
  raw_category text,
  raw_date text,
  log_date date,
  raw_time_spent text,
  minutes integer NOT NULL DEFAULT 0,
  raw_user text,
  parse_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raw_time_log_rows_compact_year_idx
  ON public.raw_time_log_rows (compact_course_name, log_date);

CREATE TABLE IF NOT EXISTS public.raw_sme_feedback_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES public.upload_history(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  source_file_name text,
  row_number integer NOT NULL,
  raw_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  course_key_raw text,
  course_key_normalized text,
  course_key_compact text,
  course_name_raw text NOT NULL,
  course_name_normalized text NOT NULL,
  course_name_compact text NOT NULL,
  reporting_year text,
  survey_date date,
  sme_raw text,
  instructional_designer_raw text,
  sme_email_raw text,
  internal_raw text,
  hours_worked numeric(10,2),
  amount_billed numeric(12,2),
  parse_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS raw_sme_feedback_rows_compact_year_idx
  ON public.raw_sme_feedback_rows (course_name_compact, reporting_year);

CREATE TABLE IF NOT EXISTS public.course_alias_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_title_raw text NOT NULL,
  alias_title_normalized text NOT NULL,
  alias_title_compact text NOT NULL,
  canonical_title_raw text NOT NULL,
  canonical_title_normalized text NOT NULL,
  canonical_title_compact text NOT NULL,
  reporting_year text,
  target_project_key text,
  alias_scope text NOT NULL DEFAULT 'all' CHECK (alias_scope IN ('all', 'project', 'time_log', 'sme')),
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(alias_title_compact, reporting_year, alias_scope)
);

CREATE TABLE IF NOT EXISTS public.person_alias_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_name_raw text NOT NULL,
  alias_name_normalized text NOT NULL,
  canonical_name text NOT NULL,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(alias_name_normalized)
);

CREATE TABLE IF NOT EXISTS public.person_role_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  role_group text NOT NULL CHECK (role_group IN ('ID', 'SME', 'Legal', 'Other/External')),
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(canonical_name)
);

CREATE TABLE IF NOT EXISTS public.sme_manual_join_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_key_compact text NOT NULL,
  course_name_compact text NOT NULL,
  reporting_year text,
  target_project_key text NOT NULL,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_key_compact, course_name_compact, reporting_year)
);

CREATE TABLE IF NOT EXISTS public.work_entity_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_title_raw text NOT NULL,
  source_title_normalized text NOT NULL,
  source_title_compact text NOT NULL,
  reporting_year text,
  decision_type text NOT NULL CHECK (decision_type IN ('project_match', 'standalone_course', 'non_project_work')),
  target_project_key text,
  standalone_title text,
  notes text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_title_compact, reporting_year)
);

ALTER TABLE public.raw_project_import_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_time_log_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_sme_feedback_rows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_alias_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_alias_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_role_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sme_manual_join_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_entity_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read raw_project_import_rows"
ON public.raw_project_import_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert shared raw_project_import_rows"
ON public.raw_project_import_rows FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared raw_project_import_rows"
ON public.raw_project_import_rows FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared raw_project_import_rows"
ON public.raw_project_import_rows FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read raw_time_log_rows"
ON public.raw_time_log_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert shared raw_time_log_rows"
ON public.raw_time_log_rows FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared raw_time_log_rows"
ON public.raw_time_log_rows FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared raw_time_log_rows"
ON public.raw_time_log_rows FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read raw_sme_feedback_rows"
ON public.raw_sme_feedback_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert shared raw_sme_feedback_rows"
ON public.raw_sme_feedback_rows FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared raw_sme_feedback_rows"
ON public.raw_sme_feedback_rows FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared raw_sme_feedback_rows"
ON public.raw_sme_feedback_rows FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read course_alias_config"
ON public.course_alias_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert shared course_alias_config"
ON public.course_alias_config FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared course_alias_config"
ON public.course_alias_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared course_alias_config"
ON public.course_alias_config FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read person_alias_config"
ON public.person_alias_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert shared person_alias_config"
ON public.person_alias_config FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared person_alias_config"
ON public.person_alias_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared person_alias_config"
ON public.person_alias_config FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read person_role_config"
ON public.person_role_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert shared person_role_config"
ON public.person_role_config FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared person_role_config"
ON public.person_role_config FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared person_role_config"
ON public.person_role_config FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read sme_manual_join_overrides"
ON public.sme_manual_join_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert shared sme_manual_join_overrides"
ON public.sme_manual_join_overrides FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared sme_manual_join_overrides"
ON public.sme_manual_join_overrides FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared sme_manual_join_overrides"
ON public.sme_manual_join_overrides FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can read work_entity_decisions"
ON public.work_entity_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert shared work_entity_decisions"
ON public.work_entity_decisions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared work_entity_decisions"
ON public.work_entity_decisions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared work_entity_decisions"
ON public.work_entity_decisions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_course_alias_config_updated_at ON public.course_alias_config;
CREATE TRIGGER update_course_alias_config_updated_at
BEFORE UPDATE ON public.course_alias_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_person_alias_config_updated_at ON public.person_alias_config;
CREATE TRIGGER update_person_alias_config_updated_at
BEFORE UPDATE ON public.person_alias_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_person_role_config_updated_at ON public.person_role_config;
CREATE TRIGGER update_person_role_config_updated_at
BEFORE UPDATE ON public.person_role_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_sme_manual_join_overrides_updated_at ON public.sme_manual_join_overrides;
CREATE TRIGGER update_sme_manual_join_overrides_updated_at
BEFORE UPDATE ON public.sme_manual_join_overrides
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_entity_decisions_updated_at ON public.work_entity_decisions;
CREATE TRIGGER update_work_entity_decisions_updated_at
BEFORE UPDATE ON public.work_entity_decisions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
