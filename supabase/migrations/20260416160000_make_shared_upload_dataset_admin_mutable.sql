-- Shared analytics dataset: all authenticated users can read, but only admins
-- can mutate the shared import-backed tables across uploaders.

-- projects
DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects;
CREATE POLICY "Admins can insert shared projects"
ON public.projects FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared projects"
ON public.projects FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared projects"
ON public.projects FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- time_entries
DROP POLICY IF EXISTS "Users can insert own time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can update own time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Users can delete own time_entries" ON public.time_entries;
CREATE POLICY "Admins can insert shared time_entries"
ON public.time_entries FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared time_entries"
ON public.time_entries FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared time_entries"
ON public.time_entries FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- sme_collaboration_surveys
DROP POLICY IF EXISTS "Users can insert own sme_collaboration_surveys" ON public.sme_collaboration_surveys;
DROP POLICY IF EXISTS "Users can update own sme_collaboration_surveys" ON public.sme_collaboration_surveys;
DROP POLICY IF EXISTS "Users can delete own sme_collaboration_surveys" ON public.sme_collaboration_surveys;
CREATE POLICY "Admins can insert shared sme_collaboration_surveys"
ON public.sme_collaboration_surveys FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared sme_collaboration_surveys"
ON public.sme_collaboration_surveys FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared sme_collaboration_surveys"
ON public.sme_collaboration_surveys FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- time_match_overrides
DROP POLICY IF EXISTS "Authenticated users can insert time_match_overrides" ON public.time_match_overrides;
DROP POLICY IF EXISTS "Authenticated users can delete time_match_overrides" ON public.time_match_overrides;
DROP POLICY IF EXISTS "Insert own time_match_overrides" ON public.time_match_overrides;
DROP POLICY IF EXISTS "Delete own time_match_overrides" ON public.time_match_overrides;
CREATE POLICY "Admins can insert shared time_match_overrides"
ON public.time_match_overrides FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared time_match_overrides"
ON public.time_match_overrides FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared time_match_overrides"
ON public.time_match_overrides FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- survey_no_match_records
DROP POLICY IF EXISTS "Authenticated users can insert survey_no_match_records" ON public.survey_no_match_records;
DROP POLICY IF EXISTS "Authenticated users can delete survey_no_match_records" ON public.survey_no_match_records;
DROP POLICY IF EXISTS "Insert own survey_no_match" ON public.survey_no_match_records;
DROP POLICY IF EXISTS "Delete own survey_no_match" ON public.survey_no_match_records;
CREATE POLICY "Admins can insert shared survey_no_match_records"
ON public.survey_no_match_records FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared survey_no_match_records"
ON public.survey_no_match_records FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared survey_no_match_records"
ON public.survey_no_match_records FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- canceled_courses are also shared upload-review metadata.
DROP POLICY IF EXISTS "Authenticated users can insert canceled_courses" ON public.canceled_courses;
DROP POLICY IF EXISTS "Authenticated users can delete canceled_courses" ON public.canceled_courses;
CREATE POLICY "Admins can insert shared canceled_courses"
ON public.canceled_courses FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update shared canceled_courses"
ON public.canceled_courses FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete shared canceled_courses"
ON public.canceled_courses FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
