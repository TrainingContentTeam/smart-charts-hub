import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";

const DEV_BYPASS_AUTH = import.meta.env.DEV && import.meta.env.VITE_BYPASS_AUTH === "true";

const DEV_SESSION = {
  access_token: "dev-bypass-token",
  refresh_token: "dev-bypass-refresh",
  expires_in: 60 * 60 * 24 * 365,
  token_type: "bearer",
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "dev@local.test",
  },
} as Session;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (DEV_BYPASS_AUTH) {
      setSession(DEV_SESSION);
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = () => (DEV_BYPASS_AUTH ? Promise.resolve({ error: null }) : supabase.auth.signOut());

  return { session, user: session?.user ?? null, loading, signOut };
}
