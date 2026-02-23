
-- Add user_id column to all tables
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.time_entries ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.upload_history ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop all existing permissive public policies on projects
DROP POLICY IF EXISTS "Allow public read on projects" ON public.projects;
DROP POLICY IF EXISTS "Allow public insert on projects" ON public.projects;
DROP POLICY IF EXISTS "Allow public update on projects" ON public.projects;
DROP POLICY IF EXISTS "Allow public delete on projects" ON public.projects;

-- Drop all existing permissive public policies on time_entries
DROP POLICY IF EXISTS "Allow public read on time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow public insert on time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow public update on time_entries" ON public.time_entries;
DROP POLICY IF EXISTS "Allow public delete on time_entries" ON public.time_entries;

-- Drop all existing permissive public policies on upload_history
DROP POLICY IF EXISTS "Allow public read on upload_history" ON public.upload_history;
DROP POLICY IF EXISTS "Allow public insert on upload_history" ON public.upload_history;
DROP POLICY IF EXISTS "Allow public update on upload_history" ON public.upload_history;
DROP POLICY IF EXISTS "Allow public delete on upload_history" ON public.upload_history;

-- Create user-scoped RLS policies for projects
CREATE POLICY "Users can read own projects" ON public.projects FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own projects" ON public.projects FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create user-scoped RLS policies for time_entries
CREATE POLICY "Users can read own time_entries" ON public.time_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own time_entries" ON public.time_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own time_entries" ON public.time_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own time_entries" ON public.time_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Create user-scoped RLS policies for upload_history
CREATE POLICY "Users can read own upload_history" ON public.upload_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own upload_history" ON public.upload_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own upload_history" ON public.upload_history FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own upload_history" ON public.upload_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
