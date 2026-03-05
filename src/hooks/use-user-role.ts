import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useUserRole() {
  const { user, loading: authLoading } = useAuth();
  const [role, setRole] = useState<string>("user");
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setRole("user");
      setRoleLoading(false);
      return;
    }

    const fetchRole = async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!error && data) {
        setRole(data.role);
      } else {
        setRole("user");
      }
      setRoleLoading(false);
    };

    fetchRole();
  }, [user, authLoading]);

  return { role, isAdmin: role === "admin", loading: authLoading || roleLoading };
}
