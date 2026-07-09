// app/api/settings/account/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/api-security";
import { logAudit, startRequestTimer } from "@/lib/audit-log";

export const runtime = "nodejs";

const RECOVERY_WINDOW_DAYS = 7;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await rateLimit(`account-delete-status:${user.id}`, 30, 60_000);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  const { data } = await db
    .from("account_deletion_requests")
    .select("scheduled_for")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  return NextResponse.json({ pending: !!data, scheduledFor: data?.scheduled_for || null });
}

export async function POST(req: NextRequest) {
  const elapsed = startRequestTimer();
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await rateLimit(`account-delete:${user.id}`, 3, 60_000);
  if (!allowed) return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });

  const { password, confirmText, reason } = await req.json().catch(() => ({}));
  if (confirmText !== "DELETE") {
    return NextResponse.json({ error: 'Type "DELETE" to confirm.' }, { status: 400 });
  }
  if (!password) {
    return NextResponse.json({ error: "Password is required to confirm deletion." }, { status: 400 });
  }

  // ── Re-verify password before scheduling anything destructive ──────
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error: verifyError } = await anon.auth.signInWithPassword({ email: user.email, password });
  if (verifyError) {
    await logAudit(db, { userId: user.id, action: "account.deletion_requested", success: false, errorCode: "WRONG_PASSWORD", responseTimeMs: elapsed(), req });
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  // ── Don't duplicate an existing pending request ─────────────────────
  const { data: existing } = await db
    .from("account_deletion_requests")
    .select("id, scheduled_for")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ alreadyRequested: true, scheduledFor: existing.scheduled_for });
  }

  const scheduledFor = new Date(Date.now() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from("account_deletion_requests")
    .insert({ user_id: user.id, reason: reason || null, scheduled_for: scheduledFor })
    .select("id, scheduled_for")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(db, {
    userId: user.id, action: "account.deletion_requested",
    targetTable: "account_deletion_requests", targetId: data.id,
    metadata: { scheduled_for: scheduledFor },
    success: true, responseTimeMs: elapsed(),
    req,
  });

  return NextResponse.json({ success: true, scheduledFor: data.scheduled_for });
}

