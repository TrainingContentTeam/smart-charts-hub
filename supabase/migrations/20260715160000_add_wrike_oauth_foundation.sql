-- Secure Wrike OAuth foundation and raw staging tables.

CREATE TABLE IF NOT EXISTS public.wrike_oauth_states (
  state_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wrike_oauth_states_expires_at_idx
  ON public.wrike_oauth_states (expires_at);

CREATE TABLE IF NOT EXISTS public.wrike_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton_key boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  wrike_host varchar(256) NOT NULL,
  oauth_scope text NOT NULL DEFAULT 'wsReadOnly',
  access_token_ciphertext text NOT NULL,
  access_token_iv text NOT NULL,
  access_token_tag text NOT NULL,
  refresh_token_ciphertext text NOT NULL,
  refresh_token_iv text NOT NULL,
  refresh_token_tag text NOT NULL,
  access_token_expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'error', 'disconnected')),
  connected_at timestamptz,
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wrike_connections_singleton_key_check CHECK (singleton_key IS TRUE),
  CONSTRAINT wrike_connections_singleton_key_unique UNIQUE (singleton_key)
);

CREATE TABLE IF NOT EXISTS public.wrike_contacts (
  wrike_contact_id varchar(256) PRIMARY KEY,
  first_name text,
  last_name text,
  email text,
  active boolean NOT NULL DEFAULT true,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wrike_tasks (
  wrike_task_id varchar(256) PRIMARY KEY,
  title text,
  standard_status text,
  custom_status_id varchar(256),
  importance text,
  start_date date,
  due_date date,
  completed_at timestamptz,
  responsible_ids varchar(256)[] NOT NULL DEFAULT '{}'::varchar(256)[],
  parent_ids varchar(256)[] NOT NULL DEFAULT '{}'::varchar(256)[],
  custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  permalink text,
  selected_for_sync boolean NOT NULL DEFAULT false,
  deleted boolean NOT NULL DEFAULT false,
  wrike_updated_at timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wrike_tasks_active_selected_idx
  ON public.wrike_tasks (wrike_updated_at DESC)
  WHERE selected_for_sync IS TRUE AND deleted IS FALSE;

CREATE TABLE IF NOT EXISTS public.wrike_time_entries (
  wrike_timelog_id varchar(256) PRIMARY KEY,
  wrike_task_id varchar(256) REFERENCES public.wrike_tasks(wrike_task_id) ON DELETE SET NULL,
  wrike_contact_id varchar(256) REFERENCES public.wrike_contacts(wrike_contact_id) ON DELETE SET NULL,
  hours numeric(10, 2) NOT NULL DEFAULT 0,
  minutes integer GENERATED ALWAYS AS (round(hours * 60)::integer) STORED,
  tracked_date date,
  comment text,
  timelog_category_id varchar(256),
  billing_type text,
  approval_status text,
  wrike_created_at timestamptz,
  wrike_updated_at timestamptz,
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wrike_time_entries_task_tracked_date_idx
  ON public.wrike_time_entries (wrike_task_id, tracked_date);

CREATE INDEX IF NOT EXISTS wrike_time_entries_contact_tracked_date_idx
  ON public.wrike_time_entries (wrike_contact_id, tracked_date);

CREATE TABLE IF NOT EXISTS public.wrike_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL CHECK (status IN ('running', 'succeeded', 'failed')),
  trigger_source text NOT NULL CHECK (trigger_source IN ('manual', 'cron', 'oauth')),
  tasks_seen integer NOT NULL DEFAULT 0,
  tasks_upserted integer NOT NULL DEFAULT 0,
  time_entries_seen integer NOT NULL DEFAULT 0,
  time_entries_upserted integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.wrike_oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrike_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrike_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrike_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrike_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wrike_sync_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read wrike_contacts"
ON public.wrike_contacts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read wrike_tasks"
ON public.wrike_tasks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can read wrike_time_entries"
ON public.wrike_time_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can read wrike_sync_runs"
ON public.wrike_sync_runs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_wrike_connections_updated_at ON public.wrike_connections;
CREATE TRIGGER update_wrike_connections_updated_at
BEFORE UPDATE ON public.wrike_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
