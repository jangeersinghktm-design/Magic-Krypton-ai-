// app/api/settings/account/cancel-deletion/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/api-security";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await rateLimit(`account-cancel-delete:${user.id}`, 10, 60_000);
  if (!allowed) return NextResponse.json({ error: "Too many requests. Slow down." }, { status: 429 });

  const { data: existing } = await db
    .from("account_deletion_requests")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "No pending deletion request found." }, { status: 404 });
  }

  const { error } = await db
    .from("account_deletion_requests")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", existing.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(db, {
    userId: user.id, action: "account.deletion_cancelled",
    targetTable: "account_deletion_requests", targetId: existing.id,
    req,
  });

  return NextResponse.json({ success: true });
}

