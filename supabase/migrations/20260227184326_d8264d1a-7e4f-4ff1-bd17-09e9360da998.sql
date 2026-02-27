
-- Drop old restrictive SELECT policies
DROP POLICY IF EXISTS "Users can read own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can read own time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can read own upload_history" ON public.upload_history;

-- Create shared-read SELECT policies
CREATE POLICY "Authenticated users can read all projects"
ON public.projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read all time_entries"
ON public.time_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read all upload_history"
ON public.upload_history FOR SELECT TO authenticated USING (true);
