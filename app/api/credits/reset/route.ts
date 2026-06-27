// app/api/credits/reset/route.ts
// Called by Vercel Cron Job daily at midnight
// Also called on every user login to check/reset

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = req.headers.get("Authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().toISOString().split("T")[0];

    // Get all free users who haven't been reset today
    const { data: freeUsers, error } = await supabase
      .from("profiles")
      .select("id, total_credits, used_credits, credits_last_reset")
      .or("plan.eq.free,plan.is.null")
      .eq("is_suspended", false)
      .lt("credits_last_reset", today);

    if (error) throw error;

    let resetCount = 0;
    let skippedCount = 0;

    for (const user of freeUsers || []) {
      const remaining = Math.max(0, (user.total_credits || 0) - (user.used_credits || 0));

      if (remaining <= 0) { // Changing the condition here
        // Top up to 5 — never exceed 5
        const creditsToAdd = 5 - remaining;

        await supabase.from("profiles")
          .update({
            total_credits: 5,
            used_credits: 0,
            credits_last_reset: today,
            daily_generations: 0,
            daily_reset_date: today,
          })
          .eq("id", user.id);

        // Log the reset
        await supabase.from("credit_resets").insert({
          user_id: user.id,
          plan: "free",
          credits_before: remaining,
          credits_after: 5,
          reset_date: today,
        });

        await supabase.from("credit_transactions").insert({
          user_id: user.id,
          amount: creditsToAdd,
          type: "daily_reset",
          description: `Daily reset: ${remaining} → 5 credits`,
        });

        resetCount++;
      } else {
        // Already at max — just update reset date
        await supabase.from("profiles")
          .update({
            credits_last_reset: today,
            daily_generations: 0,
            daily_reset_date: today,
          })
          .eq("id", user.id);

        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      date: today,
      usersReset: resetCount,
      usersSkipped: skippedCount,
      totalProcessed: (freeUsers || []).length,
    });

  } catch (err: any) {
    console.error("Credit reset error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET — Manual trigger for a single user (called on login)
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

    const today = new Date().toISOString().split("T")[0];

    const { data: profile } = await supabase
      .from("profiles")
      .select("plan, total_credits, used_credits, credits_last_reset")
      .eq("id", user.id)
      .single();

    if (!profile || (profile.plan !== "free" && profile.plan !== null)) {
      return NextResponse.json({ message: "Not a free user", plan: profile?.plan });
    }

    const lastReset = profile.credits_last_reset || "2000-01-01";

    if (lastReset >= today) {
      const remaining = Math.max(0, (profile.total_credits || 0) - (profile.used_credits || 0));
      return NextResponse.json({ message: "Already reset today", remaining, resetDate: lastReset });
    }

    const remaining = Math.max(0, (profile.total_credits || 0) - (profile.used_credits || 0));
    const creditsToAdd = 5 - remaining;

    await supabase.from("profiles")
      .update({
        total_credits: 5,
        used_credits: 0,
        credits_last_reset: today,
        daily_generations: 0,
        daily_reset_date: today,
      })
      .eq("id", user.id);

    if (creditsToAdd > 0) {
      await supabase.from("credit_transactions").insert({
        user_id: user.id,
        amount: creditsToAdd,
        type: "daily_reset",
        description: `Daily reset: +${creditsToAdd} credits`,
      });
    }

    return NextResponse.json({
      success: true,
      creditsReset: true,
      creditsAdded: creditsToAdd,
      newBalance: 5,
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
