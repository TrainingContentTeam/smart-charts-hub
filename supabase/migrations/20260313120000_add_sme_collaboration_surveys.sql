CREATE TABLE public.sme_collaboration_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  upload_id uuid REFERENCES public.upload_history(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  course_key_raw text,
  course_name text NOT NULL,
  reporting_year text,
  hours_worked numeric(10,2),
  amount_billed numeric(12,2),
  effective_hourly_rate numeric(12,2),
  survey_date date,
  sme text,
  sme_email text,
  sme_overall_experience_score integer,
  clarity_goals_score integer,
  staff_responsiveness_score integer,
  tools_resources_score integer,
  training_support_score integer,
  use_expertise_score integer,
  incorporation_feedback_score integer,
  autonomy_course_design_score integer,
  feeling_valued_score integer,
  recommend_lexipol_score integer,
  additional_feedback_sme text,
  instructional_designer text,
  id_overall_collaboration_score integer,
  id_sme_knowledge_score integer,
  id_responsiveness_score integer,
  id_instructional_design_knowledge_score integer,
  id_contribution_development_score integer,
  id_openness_feedback_score integer,
  id_deadlines_schedule_score integer,
  id_overall_quality_score integer,
  id_assistance_interactions_score integer,
  id_realworld_examples_included boolean,
  id_sme_promoter_score integer,
  additional_comments_id text,
  source_created_at timestamptz,
  source_row jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sme_collaboration_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all sme_collaboration_surveys"
ON public.sme_collaboration_surveys
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can insert own sme_collaboration_surveys"
ON public.sme_collaboration_surveys
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sme_collaboration_surveys"
ON public.sme_collaboration_surveys
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sme_collaboration_surveys"
ON public.sme_collaboration_surveys
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
