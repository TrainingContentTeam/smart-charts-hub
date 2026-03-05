import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<string>("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole("user");
      setLoading(false);
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
      setLoading(false);
    };

    fetchRole();
  }, [user]);

  return { role, isAdmin: role === "admin", loading };
}
