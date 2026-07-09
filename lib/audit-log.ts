// lib/audit-log.ts
// Server-only. Shared by every settings/admin/cron route so audit
// capture (ip, user-agent, device type, request id) is consistent
// instead of re-implemented per route.

import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

function detectDeviceType(userAgent: string): "mobile" | "tablet" | "desktop" | "unknown" {
  if (!userAgent) return "unknown";
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|iphone|android/.test(ua)) return "mobile";
  if (/mozilla|chrome|safari|firefox|edg/.test(ua)) return "desktop";
  return "unknown";
}

export function getRequestContext(req: NextRequest) {
  const ipHeader = req.headers.get("x-forwarded-for") || "";
  const ip = ipHeader.split(",")[0].trim() || req.headers.get("x-real-ip") || "unknown";
  const userAgent = req.headers.get("user-agent") || "";
  return {
    ip,
    userAgent,
    deviceType: detectDeviceType(userAgent),
    requestId: crypto.randomUUID(),
  };
}

interface AuditLogEntry {
  userId: string | null;
  action: string;
  targetTable?: string;
  targetId?: string;
  metadata?: Record<string, any>;
  req?: NextRequest;
  success?: boolean;        // defaults to true — pass false for failed attempts
  errorCode?: string;
  responseTimeMs?: number;
}

/**
 * Best-effort audit log insert — never throws, never blocks the
 * caller's response (a logging failure must not fail the request).
 */
export async function logAudit(db: SupabaseClient, entry: AuditLogEntry): Promise<void> {
  try {
    const ctx = entry.req ? getRequestContext(entry.req) : null;
    await db.from("audit_logs").insert({
      user_id:      entry.userId,
      action:       entry.action,
      target_table: entry.targetTable || null,
      target_id:    entry.targetId || null,
      metadata:     entry.metadata || null,
      ip_address:   ctx?.ip || null,
      user_agent:   ctx?.userAgent || null,
      device_type:  ctx?.deviceType || null,
      request_id:   ctx?.requestId || null,
      success:      entry.success ?? true,
      error_code:   entry.errorCode || null,
      response_time_ms: entry.responseTimeMs ?? null,
    });
  } catch {
    // Intentionally swallowed — audit logging is best-effort and must
    // never be the reason a real user action (key creation, password
    // change, etc.) fails.
  }
}

/**
 * Convenience timer — call at the top of a route handler, pass the
 * result to logAudit's responseTimeMs so every route measures this
 * the same way instead of each one hand-rolling Date.now() math.
 */
export function startRequestTimer(): () => number {
  const start = Date.now();
  return () => Date.now() - start;
}

