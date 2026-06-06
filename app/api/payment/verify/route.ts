// app/api/payment/verify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      credits,
    } = await req.json();

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    // Auth check
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Get current profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_credits, used_credits, plan")
      .eq("id", user.id)
      .single();

    const currentCredits = profile?.total_credits || 100;
    const isTopup = planId?.startsWith("topup");

    // Update profile
    const updates: any = {
      total_credits: currentCredits + (credits || 0),
    };

    if (!isTopup && planId) {
      updates.plan = planId;
      updates.credits_reset_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    }

    await supabase.from("profiles").update(updates).eq("id", user.id);

    // Update payment record
    await supabase.from("payments")
      .update({
        razorpay_payment_id,
        razorpay_signature,
        status: "completed",
      })
      .eq("razorpay_order_id", razorpay_order_id);

    // Add credit transaction
    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount: credits,
      type: isTopup ? "topup" : "purchase",
      description: isTopup
        ? `Top-up: ${credits} credits`
        : `Plan upgrade to ${planId}`,
    });

    return NextResponse.json({
      success: true,
      creditsAdded: credits,
      newTotal: currentCredits + (credits || 0),
    });

  } catch (err: any) {
    console.error("Verify error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

