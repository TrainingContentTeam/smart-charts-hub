
-- 1) Restrict raw_sme_feedback_rows reads to admins (contains PII + financial data)
DROP POLICY IF EXISTS "Auth read raw_sme_feedback_rows" ON public.raw_sme_feedback_rows;

CREATE POLICY "Admins can read raw_sme_feedback_rows"
ON public.raw_sme_feedback_rows
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2) Harden get_all_users_with_roles: enforce admin-only inside the function
CREATE OR REPLACE FUNCTION public.get_all_users_with_roles()
 RETURNS TABLE(user_id uuid, email text, role text, created_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

-- 3) Tighten user_roles INSERT policy to require non-null user_id
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::public.app_role)
  AND user_id IS NOT NULL
);
