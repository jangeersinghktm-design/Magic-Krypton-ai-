// app/api/cron/process-account-deletions/route.ts
// Triggered daily by Vercel Cron (see vercel.json).
// Auth pattern mirrors app/api/credits/reset/route.ts, hardened with
// a timing-safe comparison for this new route.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { logAudit } from "@/lib/audit-log";

export const runtime = "nodejs";
export const maxDuration = 60;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isValidCronSecret(authHeader: string | null, cronSecret: string): boolean {
  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader || "";
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(provided);
  // timingSafeEqual requires equal-length buffers, or it throws
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  if (!isValidCronSecret(req.headers.get("Authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = admin();
  const nowIso = new Date().toISOString();

  const { data: due, error } = await db
    .from("account_deletion_requests")
    .select("id, user_id")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let deleted = 0;
  let failed = 0;

  for (const request of due || []) {
    try {
      // Permanent, irreversible deletion via the Auth Admin API.
      const { error: delErr } = await db.auth.admin.deleteUser(request.user_id);
      if (delErr) throw delErr;

      await db.from("account_deletion_requests")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", request.id);

      await logAudit(db, {
        userId: request.user_id, action: "account.deletion_completed",
        targetTable: "account_deletion_requests", targetId: request.id,
      });

      deleted++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ success: true, processed: (due || []).length, deleted, failed });
}

