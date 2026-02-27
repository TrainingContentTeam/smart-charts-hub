-- Make uploaded data readable by all authenticated users
-- while keeping writes user-scoped via existing INSERT/UPDATE/DELETE policies.

-- Projects: shared read for authenticated users
DROP POLICY IF EXISTS "Users can read own projects" ON public.projects;
CREATE POLICY "Authenticated users can read all projects"
ON public.projects
FOR SELECT
TO authenticated
USING (true);

-- Time entries: shared read for authenticated users
DROP POLICY IF EXISTS "Users can read own time_entries" ON public.time_entries;
CREATE POLICY "Authenticated users can read all time_entries"
ON public.time_entries
FOR SELECT
TO authenticated
USING (true);

-- Upload history: shared read for authenticated users
DROP POLICY IF EXISTS "Users can read own upload_history" ON public.upload_history;
CREATE POLICY "Authenticated users can read all upload_history"
ON public.upload_history
FOR SELECT
TO authenticated
USING (true);
