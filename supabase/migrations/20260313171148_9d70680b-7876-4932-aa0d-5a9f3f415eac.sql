
CREATE TABLE public.sme_collaboration_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id),
  upload_id uuid REFERENCES public.upload_history(id),
  user_id uuid,
  course_key_raw text,
  course_name text NOT NULL,
  reporting_year text,
  hours_worked numeric NOT NULL DEFAULT 0,
  amount_billed numeric NOT NULL DEFAULT 0,
  effective_hourly_rate numeric,
  survey_date text,
  sme text,
  sme_email text,
  sme_overall_experience_score numeric,
  clarity_goals_score numeric,
  staff_responsiveness_score numeric,
  tools_resources_score numeric,
  training_support_score numeric,
  use_expertise_score numeric,
  incorporation_feedback_score numeric,
  autonomy_course_design_score numeric,
  feeling_valued_score numeric,
  recommend_lexipol_score numeric,
  additional_feedback_sme text,
  instructional_designer text,
  id_overall_collaboration_score numeric,
  id_sme_knowledge_score numeric,
  id_responsiveness_score numeric,
  id_instructional_design_knowledge_score numeric,
  id_contribution_development_score numeric,
  id_openness_feedback_score numeric,
  id_deadlines_schedule_score numeric,
  id_overall_quality_score numeric,
  id_assistance_interactions_score numeric,
  id_realworld_examples_included text,
  id_sme_promoter_score numeric,
  additional_comments_id text,
  source_created_at text,
  source_row integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sme_collaboration_surveys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sme_collaboration_surveys"
  ON public.sme_collaboration_surveys FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own sme_collaboration_surveys"
  ON public.sme_collaboration_surveys FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own sme_collaboration_surveys"
  ON public.sme_collaboration_surveys FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
