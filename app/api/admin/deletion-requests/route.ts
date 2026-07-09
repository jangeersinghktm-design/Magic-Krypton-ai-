// app/api/admin/deletion-requests/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, supabaseAdmin } from "@/lib/admin-ai/supabase-admin";
import { rateLimit } from "@/lib/api-security";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

// ── GET — list pending deletion requests ────────────────────────────
export async function GET(req: NextRequest) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { allowed } = await rateLimit(`admin-deletion-list:${check.userId}`, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  const { data, error } = await supabaseAdmin
    .from("account_deletion_requests")
    .select("id, user_id, status, reason, requested_at, scheduled_for")
    .eq("status", "pending")
    .order("scheduled_for", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ requests: data || [] });
}

// ── POST — admin cancels a pending request (e.g. fraud/abuse hold) ──
export async function POST(req: NextRequest) {
  const check = await requireAdmin(req);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: check.status });

  const { allowed } = await rateLimit(`admin-deletion-cancel:${check.userId}`, 20, 60_000);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  const { requestId } = await req.json().catch(() => ({}));
  if (!requestId) return NextResponse.json({ error: "requestId is required." }, { status: 400 });

  const { error } = await supabaseAdmin
    .from("account_deletion_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), reviewed_by: check.userId })
    .eq("id", requestId)
    .eq("status", "pending");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabaseAdmin, {
    userId: check.userId!, action: "admin.deletion_request_cancelled",
    targetTable: "account_deletion_requests", targetId: requestId,
    req,
  });

  return NextResponse.json({ success: true });
}

