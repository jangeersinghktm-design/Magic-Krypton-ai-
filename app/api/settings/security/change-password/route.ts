// app/api/settings/security/change-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { rateLimit } from "@/lib/api-security";
import { logAudit, startRequestTimer } from "@/lib/audit-log";

export const runtime = "nodejs";

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const elapsed = startRequestTimer();
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = admin();
  const { data: { user } } = await db.auth.getUser(token);
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await rateLimit(`pw-change:${user.id}`, 5, 60_000);
  if (!allowed) {
    await logAudit(db, { userId: user.id, action: "security.password_changed", success: false, errorCode: "RATE_LIMITED", responseTimeMs: elapsed(), req });
    return NextResponse.json({ error: "Too many attempts. Try again in a minute." }, { status: 429 });
  }

  const { currentPassword, newPassword } = await req.json().catch(() => ({}));
  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current and new password are required." }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
  }

  // ── Re-verify current password (Supabase Auth has no separate
  //    "verify password" call — signing in again IS the verification) ──
  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { error: verifyError } = await anon.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (verifyError) {
    // Logged as a failure — repeated failures here are a brute-force signal.
    await logAudit(db, { userId: user.id, action: "security.password_changed", success: false, errorCode: "WRONG_CURRENT_PASSWORD", responseTimeMs: elapsed(), req });
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const { error: updateError } = await db.auth.admin.updateUserById(user.id, { password: newPassword });
  if (updateError) {
    await logAudit(db, { userId: user.id, action: "security.password_changed", success: false, errorCode: "UPDATE_FAILED", responseTimeMs: elapsed(), req });
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logAudit(db, { userId: user.id, action: "security.password_changed", success: true, responseTimeMs: elapsed(), req });

  return NextResponse.json({ success: true });
}

