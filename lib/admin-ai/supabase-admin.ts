// lib/admin-ai/supabase-admin.ts
// Service-role Supabase client + admin-only access check.
// Used by every /api/admin/ai-engineer/* route.

import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface AdminCheckResult {
  ok: boolean;
  userId?: string;
  error?: string;
  status?: number;
}

/**
 * Verifies the request's Bearer token belongs to a user with
 * profiles.role = 'admin'. Returns { ok:false, status, error } if not.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminCheckResult> {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!token) {
    return { ok: false, status: 401, error: "Missing Authorization header" };
  }

  const { data: { user }, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !user) {
    return { ok: false, status: 401, error: "Invalid or expired token" };
  }

  const { data: profile, error: profileErr } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileErr || !profile) {
    return { ok: false, status: 403, error: "Profile not found" };
  }

  if (profile.role !== "admin") {
    return { ok: false, status: 403, error: "Admin access required" };
  }

  return { ok: true, userId: user.id };
}

