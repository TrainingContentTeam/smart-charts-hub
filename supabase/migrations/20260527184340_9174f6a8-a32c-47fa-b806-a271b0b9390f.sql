
-- raw_project_import_rows
DROP POLICY IF EXISTS "Insert own raw_project_import_rows" ON public.raw_project_import_rows;
DROP POLICY IF EXISTS "Update own raw_project_import_rows" ON public.raw_project_import_rows;
DROP POLICY IF EXISTS "Delete own raw_project_import_rows" ON public.raw_project_import_rows;
CREATE POLICY "Admins insert raw_project_import_rows" ON public.raw_project_import_rows FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update raw_project_import_rows" ON public.raw_project_import_rows FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete raw_project_import_rows" ON public.raw_project_import_rows FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- raw_time_log_rows
DROP POLICY IF EXISTS "Insert own raw_time_log_rows" ON public.raw_time_log_rows;
DROP POLICY IF EXISTS "Update own raw_time_log_rows" ON public.raw_time_log_rows;
DROP POLICY IF EXISTS "Delete own raw_time_log_rows" ON public.raw_time_log_rows;
CREATE POLICY "Admins insert raw_time_log_rows" ON public.raw_time_log_rows FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update raw_time_log_rows" ON public.raw_time_log_rows FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete raw_time_log_rows" ON public.raw_time_log_rows FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- raw_sme_feedback_rows
DROP POLICY IF EXISTS "Insert own raw_sme_feedback_rows" ON public.raw_sme_feedback_rows;
DROP POLICY IF EXISTS "Update own raw_sme_feedback_rows" ON public.raw_sme_feedback_rows;
DROP POLICY IF EXISTS "Delete own raw_sme_feedback_rows" ON public.raw_sme_feedback_rows;
CREATE POLICY "Admins insert raw_sme_feedback_rows" ON public.raw_sme_feedback_rows FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update raw_sme_feedback_rows" ON public.raw_sme_feedback_rows FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete raw_sme_feedback_rows" ON public.raw_sme_feedback_rows FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- upload_history
DROP POLICY IF EXISTS "Users can insert own upload_history" ON public.upload_history;
DROP POLICY IF EXISTS "Users can update own upload_history" ON public.upload_history;
DROP POLICY IF EXISTS "Users can delete own upload_history" ON public.upload_history;
CREATE POLICY "Admins insert upload_history" ON public.upload_history FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update upload_history" ON public.upload_history FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete upload_history" ON public.upload_history FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- course_alias_config
DROP POLICY IF EXISTS "Insert own course_alias_config" ON public.course_alias_config;
DROP POLICY IF EXISTS "Update own course_alias_config" ON public.course_alias_config;
DROP POLICY IF EXISTS "Delete own course_alias_config" ON public.course_alias_config;
CREATE POLICY "Admins insert course_alias_config" ON public.course_alias_config FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update course_alias_config" ON public.course_alias_config FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete course_alias_config" ON public.course_alias_config FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- person_alias_config
DROP POLICY IF EXISTS "Insert own person_alias_config" ON public.person_alias_config;
DROP POLICY IF EXISTS "Update own person_alias_config" ON public.person_alias_config;
DROP POLICY IF EXISTS "Delete own person_alias_config" ON public.person_alias_config;
CREATE POLICY "Admins insert person_alias_config" ON public.person_alias_config FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update person_alias_config" ON public.person_alias_config FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete person_alias_config" ON public.person_alias_config FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- person_role_config
DROP POLICY IF EXISTS "Insert own person_role_config" ON public.person_role_config;
DROP POLICY IF EXISTS "Update own person_role_config" ON public.person_role_config;
DROP POLICY IF EXISTS "Delete own person_role_config" ON public.person_role_config;
CREATE POLICY "Admins insert person_role_config" ON public.person_role_config FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update person_role_config" ON public.person_role_config FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete person_role_config" ON public.person_role_config FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- sme_manual_join_overrides
DROP POLICY IF EXISTS "Insert own sme_manual_join_overrides" ON public.sme_manual_join_overrides;
DROP POLICY IF EXISTS "Update own sme_manual_join_overrides" ON public.sme_manual_join_overrides;
DROP POLICY IF EXISTS "Delete own sme_manual_join_overrides" ON public.sme_manual_join_overrides;
CREATE POLICY "Admins insert sme_manual_join_overrides" ON public.sme_manual_join_overrides FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update sme_manual_join_overrides" ON public.sme_manual_join_overrides FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete sme_manual_join_overrides" ON public.sme_manual_join_overrides FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- work_entity_decisions
DROP POLICY IF EXISTS "Insert own work_entity_decisions" ON public.work_entity_decisions;
DROP POLICY IF EXISTS "Update own work_entity_decisions" ON public.work_entity_decisions;
DROP POLICY IF EXISTS "Delete own work_entity_decisions" ON public.work_entity_decisions;
CREATE POLICY "Admins insert work_entity_decisions" ON public.work_entity_decisions FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins update work_entity_decisions" ON public.work_entity_decisions FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins delete work_entity_decisions" ON public.work_entity_decisions FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
