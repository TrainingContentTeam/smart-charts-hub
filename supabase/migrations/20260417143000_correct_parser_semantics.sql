-- Parser semantics correction: keep time-log durations nullable when invalid
-- and split SME ID-vs-SME survey date provenance into dedicated columns.

ALTER TABLE public.raw_time_log_rows
  ALTER COLUMN minutes DROP NOT NULL,
  ALTER COLUMN minutes DROP DEFAULT;

ALTER TABLE public.raw_sme_feedback_rows
  ADD COLUMN IF NOT EXISTS id_survey_raw_created text,
  ADD COLUMN IF NOT EXISTS id_survey_created_at timestamp without time zone,
  ADD COLUMN IF NOT EXISTS id_survey_date date,
  ADD COLUMN IF NOT EXISTS id_survey_date_source text,
  ADD COLUMN IF NOT EXISTS sme_survey_raw_date text,
  ADD COLUMN IF NOT EXISTS sme_survey_date date,
  ADD COLUMN IF NOT EXISTS sme_survey_date_source text;

UPDATE public.raw_sme_feedback_rows
SET
  sme_survey_raw_date = COALESCE(sme_survey_raw_date, survey_date::text, ''),
  sme_survey_date = COALESCE(sme_survey_date, survey_date),
  sme_survey_date_source = COALESCE(sme_survey_date_source, CASE WHEN survey_date IS NOT NULL THEN 'Survey Date' ELSE NULL END)
WHERE survey_date IS NOT NULL
   OR sme_survey_raw_date IS NULL
   OR sme_survey_date IS NULL
   OR sme_survey_date_source IS NULL;
