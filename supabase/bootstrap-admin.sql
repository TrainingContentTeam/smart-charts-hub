-- Run once in the Supabase SQL Editor for the linked project.
-- This is intentionally separate from migrations so a first admin can be
-- established while the imported migration history is being reconciled.

BEGIN;

DO $$
BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can read all roles" ON public.user_roles;
CREATE POLICY "Admins can read all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND user_id IS NOT NULL
);

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM auth.users
    WHERE lower(email) = lower('dweiss@lexipol.com')
  ) THEN
    RAISE EXCEPTION 'No Supabase Auth user exists for dweiss@lexipol.com';
  END IF;
END
$$;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('dweiss@lexipol.com')
ON CONFLICT (user_id, role) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
    SELECT
      u.id AS user_id,
      u.email::text AS email,
      COALESCE(ur.role::text, 'user') AS role,
      u.created_at
    FROM auth.users u
    LEFT JOIN public.user_roles ur ON ur.user_id = u.id
    ORDER BY u.created_at;
END;
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.get_all_users_with_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_all_users_with_roles() TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;

COMMIT;

SELECT
  u.email,
  ur.role,
  ur.created_at
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE lower(u.email) = lower('dweiss@lexipol.com');
