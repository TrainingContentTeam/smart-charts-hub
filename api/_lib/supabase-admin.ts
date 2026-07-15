import { createClient } from "@supabase/supabase-js";
import { getSupabaseBackendKey, requireEnv } from "./env.js";

export const supabaseAdmin = createClient(requireEnv("SUPABASE_URL"), getSupabaseBackendKey(), {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
