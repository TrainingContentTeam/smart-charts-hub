
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'Completed',
  ADD COLUMN IF NOT EXISTS total_hours numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sme text,
  ADD COLUMN IF NOT EXISTS legal_reviewer text,
  ADD COLUMN IF NOT EXISTS data_source text;

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS entry_date date,
  ADD COLUMN IF NOT EXISTS user_name text;
