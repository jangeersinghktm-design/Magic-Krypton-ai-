// app/api/credits/route.ts
// GET — Get credit status
// POST — Reset credits (cron job)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkCredits, FREE_MAX_CREDITS } from "@/lib/credit-manager";

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const status = await checkCredits(user.id, supabase);

    return NextResponse.json({
      plan: status.plan,
      total: status.total,
      used: status.used,
      remaining: status.remaining,
      dailyGenerations: status.dailyGenerations,
      nextReset: status.nextReset,
      periodEnd: status.periodEnd,
      maxCredits: FREE_MAX_CREDITS,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST — Cron job daily reset
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().toISOString().split("T")[0];
    let resetCount = 0, skipCount = 0;

    // Reset free users (only if 0 credits remain)
    const { data: freeUsers } = await supabase
      .from("profiles")
      .select("id, total_credits, used_credits")
      .or("plan.eq.free,plan.is.null")
      .eq("is_suspended", false)
      .lt("credits_last_reset", today);

    for (const user of freeUsers || []) {
      const remaining = Math.max(0, user.total_credits - user.used_credits);
      if (remaining === 0) {
        await supabase.from("profiles").update({
          total_credits: FREE_MAX_CREDITS,
          used_credits: 0,
          credits_last_reset: today,
          daily_generations: 0,
          daily_reset_date: today,
        }).eq("id", user.id);
        resetCount++;
      } else {
        await supabase.from("profiles").update({
          credits_last_reset: today,
          daily_generations: 0,
          daily_reset_date: today,
        }).eq("id", user.id);
        skipCount++;
      }
    }

    // Reset business users (100/day)
    await supabase.from("profiles")
      .update({ used_credits: 0, daily_generations: 0, daily_reset_date: today, total_credits: 100 })
      .eq("plan", "business")
      .eq("is_suspended", false)
      .lt("daily_reset_date", today);

    return NextResponse.json({ success: true, resetCount, skipCount, date: today });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


