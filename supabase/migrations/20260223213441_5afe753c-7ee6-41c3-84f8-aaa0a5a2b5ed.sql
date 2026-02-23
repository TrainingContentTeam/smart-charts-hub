
-- Add course metadata columns to projects table
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS id_assigned text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS authoring_tool text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS vertical text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS course_length text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS course_type text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS course_style text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS reporting_year text;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS interaction_count integer;
