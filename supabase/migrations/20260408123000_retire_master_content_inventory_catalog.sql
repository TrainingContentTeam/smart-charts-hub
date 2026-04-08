DELETE FROM public.upload_history
WHERE dataset_type LIKE 'catalog_%';

DROP TABLE IF EXISTS public.lms_course_versions CASCADE;
DROP TABLE IF EXISTS public.lms_course_info CASCADE;
