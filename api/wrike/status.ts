import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin, requireMethod, sendApiError } from "../_lib/admin-auth.js";
import { supabaseAdmin } from "../_lib/supabase-admin.js";

interface WrikeConnectionStatus {
  status: "connected" | "error" | "disconnected";
  wrike_host: string | null;
  oauth_scope: string | null;
  connected_at: string | null;
  access_token_expires_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, "GET")) return;

  try {
    await requireAdmin(req);

    const { data, error } = await supabaseAdmin
      .from("wrike_connections")
      .select("status,wrike_host,oauth_scope,connected_at,access_token_expires_at,last_sync_at,last_error")
      .eq("singleton_key", true)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const connection = data as WrikeConnectionStatus | null;

    res.status(200).json({
      connected: connection?.status === "connected",
      status: connection?.status ?? "disconnected",
      wrikeHost: connection?.wrike_host ?? null,
      scope: connection?.oauth_scope ?? null,
      connectedAt: connection?.connected_at ?? null,
      tokenExpiresAt: connection?.access_token_expires_at ?? null,
      lastSyncAt: connection?.last_sync_at ?? null,
      lastError: connection?.last_error ?? null,
    });
  } catch (error) {
    sendApiError(res, error);
  }
}
