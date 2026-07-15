import { createHash } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireMethod } from "../_lib/admin-auth.js";
import { requireEnv } from "../_lib/env.js";
import { encryptToken } from "../_lib/token-crypto.js";
import { supabaseAdmin } from "../_lib/supabase-admin.js";
import { exchangeWrikeAuthorizationCode } from "../_lib/wrike-oauth.js";

interface OAuthStateRecord {
  state_hash: string;
  user_id: string;
  expires_at: string;
}

function firstQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function redirectToIntegrations(res: VercelResponse, status: "connected" | "error"): void {
  const url = new URL("/integrations", requireEnv("APP_URL"));
  url.searchParams.set("wrike", status);
  res.redirect(302, url.toString());
}

async function markConnectionError(message: string): Promise<void> {
  await supabaseAdmin
    .from("wrike_connections")
    .update({
      status: "error",
      last_error: message,
    })
    .eq("singleton_key", true);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!requireMethod(req, res, "GET")) return;

  let validatedState: OAuthStateRecord | null = null;

  try {
    const error = firstQueryValue(req.query.error);
    const code = firstQueryValue(req.query.code);
    const state = firstQueryValue(req.query.state);

    if (error) {
      console.warn("Wrike OAuth authorization declined", { error });
      redirectToIntegrations(res, "error");
      return;
    }

    if (!code || !state) {
      console.warn("Wrike OAuth callback missing code or state");
      redirectToIntegrations(res, "error");
      return;
    }

    const stateHash = sha256(state);
    const { data: stateRecord, error: stateError } = await supabaseAdmin
      .from("wrike_oauth_states")
      .select("state_hash,user_id,expires_at")
      .eq("state_hash", stateHash)
      .maybeSingle();

    if (stateError) {
      throw stateError;
    }

    if (!stateRecord) {
      console.warn("Wrike OAuth callback received an unknown state");
      redirectToIntegrations(res, "error");
      return;
    }

    validatedState = stateRecord as OAuthStateRecord;

    const { error: deleteStateError } = await supabaseAdmin
      .from("wrike_oauth_states")
      .delete()
      .eq("state_hash", stateHash);

    if (deleteStateError) {
      throw deleteStateError;
    }

    if (new Date(validatedState.expires_at).getTime() <= Date.now()) {
      console.warn("Wrike OAuth callback received an expired state");
      redirectToIntegrations(res, "error");
      return;
    }

    const tokens = await exchangeWrikeAuthorizationCode(code);
    const encryptedAccessToken = encryptToken(tokens.accessToken);
    const encryptedRefreshToken = encryptToken(tokens.refreshToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + tokens.expiresIn * 1000).toISOString();

    const { error: upsertError } = await supabaseAdmin.from("wrike_connections").upsert(
      {
        singleton_key: true,
        created_by: validatedState.user_id,
        wrike_host: tokens.host,
        oauth_scope: tokens.scope,
        access_token_ciphertext: encryptedAccessToken.ciphertext,
        access_token_iv: encryptedAccessToken.iv,
        access_token_tag: encryptedAccessToken.tag,
        refresh_token_ciphertext: encryptedRefreshToken.ciphertext,
        refresh_token_iv: encryptedRefreshToken.iv,
        refresh_token_tag: encryptedRefreshToken.tag,
        access_token_expires_at: expiresAt,
        status: "connected",
        connected_at: now.toISOString(),
        last_error: null,
      },
      { onConflict: "singleton_key" },
    );

    if (upsertError) {
      throw upsertError;
    }

    redirectToIntegrations(res, "connected");
  } catch (error) {
    console.error("Wrike OAuth callback failed", error);

    if (validatedState) {
      try {
        await markConnectionError("Wrike authorization failed. Review server logs.");
      } catch (markError) {
        console.error("Unable to record Wrike connection error", markError);
      }
    }

    redirectToIntegrations(res, "error");
  }
}
