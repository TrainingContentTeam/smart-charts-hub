import type { User } from "@supabase/supabase-js";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { supabaseAdmin } from "./supabase-admin.js";

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

export interface AdminContext {
  user: User;
}

function getBearerToken(req: VercelRequest): string {
  const header = req.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;

  if (!value) {
    throw new ApiError(401, "Missing Authorization header.");
  }

  const match = value.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    throw new ApiError(401, "Authorization header must use Bearer authentication.");
  }

  return match[1];
}

export async function requireAdmin(req: VercelRequest): Promise<AdminContext> {
  const token = getBearerToken(req);
  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data.user) {
    throw new ApiError(401, "Invalid or expired session.");
  }

  const { data: role, error: roleError } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("user_id", data.user.id)
    .eq("role", "admin")
    .maybeSingle();

  if (roleError) {
    throw new ApiError(500, "Unable to verify administrator role.");
  }

  if (!role) {
    throw new ApiError(403, "Administrator access is required.");
  }

  return { user: data.user };
}

export function sendApiError(res: VercelResponse, error: unknown): void {
  if (error instanceof ApiError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error("Unhandled API error", error);
  res.status(500).json({ error: "Unexpected server error." });
}

export function requireMethod(req: VercelRequest, res: VercelResponse, method: string): boolean {
  if (req.method === method) {
    return true;
  }

  res.setHeader("Allow", method);
  res.status(405).json({ error: `Method ${req.method || "UNKNOWN"} is not allowed.` });
  return false;
}
