ALTER TABLE public.lms_course_versions
  ADD COLUMN IF NOT EXISTS lesson_plan text,
  ADD COLUMN IF NOT EXISTS special text,
  ADD COLUMN IF NOT EXISTS ems1a text,
  ADD COLUMN IF NOT EXISTS p1a text,
  ADD COLUMN IF NOT EXISTS fr1a text,
  ADD COLUMN IF NOT EXISTS c1a text,
  ADD COLUMN IF NOT EXISTS lgu text,
  ADD COLUMN IF NOT EXISTS d1a text;
