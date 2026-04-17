-- Step 1: Create the 8 new canonical tables

CREATE TABLE public.raw_project_import_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES public.upload_history(id) ON DELETE SET NULL,
  user_id uuid,
  source_dataset text NOT NULL,
  source_file_name text,
  row_number integer NOT NULL,
  raw_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_course_name text NOT NULL DEFAULT '',
  normalized_course_name text NOT NULL DEFAULT '',
  compact_course_name text NOT NULL DEFAULT '',
  reporting_label text NOT NULL DEFAULT '',
  reporting_year text,
  raw_status text NOT NULL DEFAULT '',
  raw_time_spent text NOT NULL DEFAULT '',
  project_total_minutes numeric NOT NULL DEFAULT 0,
  id_assigned_raw text NOT NULL DEFAULT '',
  sme_assigned_raw text NOT NULL DEFAULT '',
  legal_reviewer_raw text NOT NULL DEFAULT '',
  vertical_raw text NOT NULL DEFAULT '',
  course_type text NOT NULL DEFAULT '',
  authoring_tool text NOT NULL DEFAULT '',
  course_style text NOT NULL DEFAULT '',
  course_length_raw text NOT NULL DEFAULT '',
  interaction_count integer,
  parse_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raw_project_import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read raw_project_import_rows" ON public.raw_project_import_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own raw_project_import_rows" ON public.raw_project_import_rows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own raw_project_import_rows" ON public.raw_project_import_rows FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own raw_project_import_rows" ON public.raw_project_import_rows FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.raw_time_log_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES public.upload_history(id) ON DELETE SET NULL,
  user_id uuid,
  source_file_name text,
  row_number integer NOT NULL,
  raw_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_course_name text NOT NULL DEFAULT '',
  normalized_course_name text NOT NULL DEFAULT '',
  compact_course_name text NOT NULL DEFAULT '',
  raw_category text NOT NULL DEFAULT '',
  raw_date text NOT NULL DEFAULT '',
  log_date date,
  raw_time_spent text NOT NULL DEFAULT '',
  minutes numeric NOT NULL DEFAULT 0,
  raw_user text NOT NULL DEFAULT '',
  parse_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raw_time_log_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read raw_time_log_rows" ON public.raw_time_log_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own raw_time_log_rows" ON public.raw_time_log_rows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own raw_time_log_rows" ON public.raw_time_log_rows FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own raw_time_log_rows" ON public.raw_time_log_rows FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.raw_sme_feedback_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid REFERENCES public.upload_history(id) ON DELETE SET NULL,
  user_id uuid,
  source_file_name text,
  row_number integer NOT NULL,
  raw_row jsonb NOT NULL DEFAULT '{}'::jsonb,
  course_key_raw text NOT NULL DEFAULT '',
  course_key_normalized text NOT NULL DEFAULT '',
  course_key_compact text NOT NULL DEFAULT '',
  course_name_raw text NOT NULL DEFAULT '',
  course_name_normalized text NOT NULL DEFAULT '',
  course_name_compact text NOT NULL DEFAULT '',
  reporting_year text,
  survey_date text,
  sme_raw text NOT NULL DEFAULT '',
  instructional_designer_raw text NOT NULL DEFAULT '',
  sme_email_raw text NOT NULL DEFAULT '',
  internal_raw text NOT NULL DEFAULT '',
  hours_worked numeric,
  amount_billed numeric,
  parse_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.raw_sme_feedback_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read raw_sme_feedback_rows" ON public.raw_sme_feedback_rows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own raw_sme_feedback_rows" ON public.raw_sme_feedback_rows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own raw_sme_feedback_rows" ON public.raw_sme_feedback_rows FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own raw_sme_feedback_rows" ON public.raw_sme_feedback_rows FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.course_alias_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_title_raw text NOT NULL,
  alias_title_normalized text NOT NULL,
  alias_title_compact text NOT NULL,
  canonical_title_raw text NOT NULL,
  canonical_title_normalized text NOT NULL,
  canonical_title_compact text NOT NULL,
  reporting_year text,
  target_project_key text,
  alias_scope text NOT NULL DEFAULT 'all',
  notes text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT course_alias_unique UNIQUE NULLS NOT DISTINCT (alias_title_compact, reporting_year, alias_scope)
);
ALTER TABLE public.course_alias_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read course_alias_config" ON public.course_alias_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own course_alias_config" ON public.course_alias_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own course_alias_config" ON public.course_alias_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own course_alias_config" ON public.course_alias_config FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_course_alias_config_updated BEFORE UPDATE ON public.course_alias_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.person_alias_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alias_name_raw text NOT NULL,
  alias_name_normalized text NOT NULL,
  canonical_name text NOT NULL,
  notes text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.person_alias_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read person_alias_config" ON public.person_alias_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own person_alias_config" ON public.person_alias_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own person_alias_config" ON public.person_alias_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own person_alias_config" ON public.person_alias_config FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_person_alias_config_updated BEFORE UPDATE ON public.person_alias_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.person_role_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  canonical_name text NOT NULL,
  role_group text NOT NULL,
  notes text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.person_role_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read person_role_config" ON public.person_role_config FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own person_role_config" ON public.person_role_config FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own person_role_config" ON public.person_role_config FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own person_role_config" ON public.person_role_config FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_person_role_config_updated BEFORE UPDATE ON public.person_role_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.sme_manual_join_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_key_compact text NOT NULL,
  course_name_compact text NOT NULL,
  reporting_year text,
  target_project_key text NOT NULL,
  notes text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sme_manual_join_unique UNIQUE NULLS NOT DISTINCT (course_key_compact, course_name_compact, reporting_year)
);
ALTER TABLE public.sme_manual_join_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read sme_manual_join_overrides" ON public.sme_manual_join_overrides FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own sme_manual_join_overrides" ON public.sme_manual_join_overrides FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own sme_manual_join_overrides" ON public.sme_manual_join_overrides FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own sme_manual_join_overrides" ON public.sme_manual_join_overrides FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_sme_manual_join_updated BEFORE UPDATE ON public.sme_manual_join_overrides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.work_entity_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_title_raw text NOT NULL,
  source_title_normalized text NOT NULL,
  source_title_compact text NOT NULL,
  reporting_year text,
  decision_type text NOT NULL,
  target_project_key text,
  standalone_title text,
  notes text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_entity_decisions_unique UNIQUE NULLS NOT DISTINCT (source_title_compact, reporting_year)
);
ALTER TABLE public.work_entity_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read work_entity_decisions" ON public.work_entity_decisions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert own work_entity_decisions" ON public.work_entity_decisions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own work_entity_decisions" ON public.work_entity_decisions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Delete own work_entity_decisions" ON public.work_entity_decisions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_work_entity_decisions_updated BEFORE UPDATE ON public.work_entity_decisions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Step 2: Drop legacy tables no longer used by the codebase
DROP TABLE IF EXISTS public.sme_collaboration_surveys CASCADE;
DROP TABLE IF EXISTS public.time_entries CASCADE;
DROP TABLE IF EXISTS public.projects CASCADE;
DROP TABLE IF EXISTS public.canceled_courses CASCADE;
DROP TABLE IF EXISTS public.lms_course_versions CASCADE;
DROP TABLE IF EXISTS public.lms_course_info CASCADE;
DROP TABLE IF EXISTS public.survey_no_match_records CASCADE;
DROP TABLE IF EXISTS public.time_match_overrides CASCADE;