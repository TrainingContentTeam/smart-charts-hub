
-- Projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Time entries table
CREATE TABLE public.time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  phase TEXT NOT NULL,
  hours NUMERIC(10,2) NOT NULL DEFAULT 0,
  quarter TEXT,
  raw_task_name TEXT,
  raw_time_spent TEXT,
  upload_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Upload history table
CREATE TABLE public.upload_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  row_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add foreign key for upload_id
ALTER TABLE public.time_entries
  ADD CONSTRAINT fk_time_entries_upload
  FOREIGN KEY (upload_id) REFERENCES public.upload_history(id) ON DELETE SET NULL;

-- Enable RLS on all tables
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_history ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (no auth required for this analytics tool)
CREATE POLICY "Allow public read on projects" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Allow public insert on projects" ON public.projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on projects" ON public.projects FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on projects" ON public.projects FOR DELETE USING (true);

CREATE POLICY "Allow public read on time_entries" ON public.time_entries FOR SELECT USING (true);
CREATE POLICY "Allow public insert on time_entries" ON public.time_entries FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on time_entries" ON public.time_entries FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on time_entries" ON public.time_entries FOR DELETE USING (true);

CREATE POLICY "Allow public read on upload_history" ON public.upload_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert on upload_history" ON public.upload_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update on upload_history" ON public.upload_history FOR UPDATE USING (true);
CREATE POLICY "Allow public delete on upload_history" ON public.upload_history FOR DELETE USING (true);

-- Updated_at trigger for projects
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
