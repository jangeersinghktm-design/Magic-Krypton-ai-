// app/api/payment/verify/route.ts — Production Ready v3
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PLAN_CREDITS: Record<string, number> = {
  pro: 2000, premium: 5000, business: 10000,
  topup_50: 50, topup_100: 100, topup_200: 200, topup_500: 500,
};

const PLAN_PERIOD_DAYS: Record<string, number> = {
  pro: 30, premium: 30, business: 30,
};

async function verifySignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const body = `${orderId}|${paymentId}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computedSignature = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  return computedSignature === signature;
}

export async function POST(req: NextRequest) {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planId,
      billing = "monthly",
      currency = "INR",
      idempotencyKey,
    } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Auth
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // ── CRITICAL: Verify Razorpay signature ──────────────────────
    const isValid = await verifySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      process.env.RAZORPAY_KEY_SECRET!
    );

    if (!isValid) {
      console.error("Invalid Razorpay signature for payment:", razorpay_payment_id);
      return NextResponse.json({ error: "Payment verification failed — invalid signature" }, { status: 400 });
    }

    // ── CRITICAL: Idempotency check — prevent duplicate credits ──
    const { data: existingPayment } = await supabase
      .from("payments")
      .select("id")
      .eq("razorpay_payment_id", razorpay_payment_id)
      .single();

    if (existingPayment) {
      console.log("Duplicate payment detected:", razorpay_payment_id);
      return NextResponse.json({ success: true, duplicate: true, message: "Payment already processed" });
    }

    // ── Get current profile ───────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_credits, used_credits, plan")
      .eq("id", user.id)
      .single();

    const isTopup = planId.startsWith("topup_");
    const creditsToAdd = PLAN_CREDITS[planId] || 0;
    const isYearly = billing === "yearly";

    // Generate invoice number
    const { data: seqData } = await supabase.rpc("nextval", { sequence_name: "invoice_number_seq" }).single();
    const invoiceNumber = `KR-${new Date().getFullYear()}-${String(seqData || Math.floor(Math.random() * 9000) + 1000).padStart(6, "0")}`;

    // Get payment amount from Razorpay
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID!;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET!;
    const credentials = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");

    const paymentRes = await fetch(`https://api.razorpay.com/v1/payments/${razorpay_payment_id}`, {
      headers: { "Authorization": `Basic ${credentials}` },
    });
    const paymentData = paymentRes.ok ? await paymentRes.json() : {};
    const paidAmount = Math.floor((paymentData.amount || 0) / 100);

    // ── Create invoice ────────────────────────────────────────────
    const { data: invoice } = await supabase.from("invoices").insert({
      user_id: user.id,
      invoice_number: invoiceNumber,
      plan: planId,
      billing_cycle: isTopup ? null : billing,
      currency: currency,
      amount: paidAmount,
      tax: 0,
      total: paidAmount,
      status: "paid",
      razorpay_payment_id,
      razorpay_order_id,
      credits_added: creditsToAdd,
    }).select().single();

    // ── Record payment ────────────────────────────────────────────
    await supabase.from("payments").insert({
      user_id: user.id,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      plan: planId,
      amount: paidAmount,
      currency,
      status: "success",
      idempotency_key: idempotencyKey || razorpay_payment_id,
      invoice_id: invoice?.id,
    });

    // ── Add credit transaction ────────────────────────────────────
    await supabase.from("credit_transactions").insert({
      user_id: user.id,
      amount: creditsToAdd,
      type: isTopup ? "topup" : "subscription",
      description: isTopup
        ? `Top-up: +${creditsToAdd} credits`
        : `${planId.charAt(0).toUpperCase() + planId.slice(1)} Plan — ${isYearly ? "Yearly" : "Monthly"}`,
      invoice_id: invoice?.id,
      idempotency_key: `credits_${razorpay_payment_id}`,
    });

    // ── Update profile credits ────────────────────────────────────
    const newTotalCredits = isTopup
      ? (profile?.total_credits || 100) + creditsToAdd
      : creditsToAdd;

    const now = new Date();
    const periodEnd = new Date(now);
    if (!isTopup) {
      periodEnd.setDate(periodEnd.getDate() + (isYearly ? 365 : 30));
    }

    await supabase.from("profiles").update({
      ...(isTopup ? {
        total_credits: newTotalCredits,
      } : {
        plan: planId,
        total_credits: creditsToAdd,
        used_credits: 0,
        subscription_status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      }),
    }).eq("id", user.id);

    // ── Upsert subscription record ────────────────────────────────
    if (!isTopup) {
      await supabase.from("subscriptions").upsert({
        user_id: user.id,
        plan: planId,
        status: "active",
        billing_cycle: billing,
        currency,
        amount: paidAmount,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
        updated_at: now.toISOString(),
      }, { onConflict: "user_id" });
    }

    // ── Send notification ────────────────────────────────────────
    await supabase.from("notifications").insert({
      user_id: user.id,
      title: isTopup ? `⚡ +${creditsToAdd} Credits Added!` : `🎉 Welcome to ${planId} Plan!`,
      message: isTopup
        ? `Your top-up was successful. Invoice: ${invoiceNumber}`
        : `Your ${planId} subscription is now active. ${creditsToAdd} credits added. Invoice: ${invoiceNumber}`,
      type: "success",
      link: "/billing",
    });

    return NextResponse.json({
      success: true,
      creditsAdded: creditsToAdd,
      invoiceNumber,
      planId,
      message: isTopup
        ? `${creditsToAdd} credits added successfully!`
        : `Welcome to ${planId}! ${creditsToAdd} credits added.`,
    });

  } catch (err: any) {
    console.error("Verify error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
