import { createHash, randomBytes } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAdmin, requireMethod, sendApiError } from "../_lib/admin-auth.js";
import { requireEnv } from "../_lib/env.js";
import { supabaseAdmin } from "../_lib/supabase-admin.js";
import { buildWrikeAuthorizationUrl } from "../_lib/wrike-oauth.js";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, "POST")) return;

  try {
    const { user } = await requireAdmin(req);
    const state = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: cleanupError } = await supabaseAdmin
      .from("wrike_oauth_states")
      .delete()
      .lt("expires_at", new Date().toISOString());

    if (cleanupError) {
      throw cleanupError;
    }

    const { error } = await supabaseAdmin.from("wrike_oauth_states").insert({
      state_hash: sha256(state),
      user_id: user.id,
      expires_at: expiresAt,
    });

    if (error) {
      throw error;
    }

    res.status(200).json({
      authorizationUrl: buildWrikeAuthorizationUrl(state),
      callbackUrl: requireEnv("WRIKE_REDIRECT_URI"),
    });
  } catch (error) {
    sendApiError(res, error);
  }
}
