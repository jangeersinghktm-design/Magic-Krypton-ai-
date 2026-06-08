// app/api/payment/order/route.ts — Production Ready v3
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const PLAN_CONFIG: Record<string, { credits: number; priceInr: number; priceUsd: number; yearlyInr: number; yearlyUsd: number }> = {
  pro:     { credits: 2000,  priceInr: 2099,  priceUsd: 25,  yearlyInr: 1679,  yearlyUsd: 20  },
  premium: { credits: 5000,  priceInr: 5799,  priceUsd: 69,  yearlyInr: 4639,  yearlyUsd: 55  },
  business:{ credits: 10000, priceInr: 12499, priceUsd: 149, yearlyInr: 9999,  yearlyUsd: 119 },
  topup_50: { credits: 50,   priceInr: 1299,  priceUsd: 15,  yearlyInr: 1299,  yearlyUsd: 15  },
  topup_100:{ credits: 100,  priceInr: 2599,  priceUsd: 30,  yearlyInr: 2599,  yearlyUsd: 30  },
  topup_200:{ credits: 200,  priceInr: 4999,  priceUsd: 60,  yearlyInr: 4999,  yearlyUsd: 60  },
  topup_500:{ credits: 500,  priceInr: 11999, priceUsd: 150, yearlyInr: 11999, yearlyUsd: 150 },
};

export async function POST(req: NextRequest) {
  try {
    const { planId, billing = "monthly", currency = "INR", promoCode } = await req.json();

    if (!planId || !PLAN_CONFIG[planId]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    // Auth
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const plan = PLAN_CONFIG[planId];
    const isYearly = billing === "yearly";
    const isInr = currency === "INR";

    let baseAmount = isInr
      ? (isYearly ? plan.yearlyInr : plan.priceInr)
      : (isYearly ? plan.yearlyUsd : plan.priceUsd);

    // Apply promo code
    let discount = 0;
    if (promoCode) {
      const { data: promo } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", promoCode.toUpperCase())
        .eq("is_active", true)
        .single();

      if (promo) {
        // Check not already used
        const { data: used } = await supabase
          .from("promo_code_usage")
          .select("id")
          .eq("user_id", user.id)
          .eq("promo_code_id", promo.id)
          .single();

        if (!used) {
          if (promo.discount_percent) discount = Math.floor(baseAmount * promo.discount_percent / 100);
          if (promo.discount_amount)  discount = Math.min(discount + promo.discount_amount, baseAmount);
        }
      }
    }

    const finalAmount = Math.max(baseAmount - discount, 0);
    const amountInSmallestUnit = isInr ? finalAmount * 100 : finalAmount * 100;

    // Create Razorpay order
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID!;
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET!;
    const credentials = Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64");

    const idempotencyKey = `${user.id}-${planId}-${Date.now()}`;

    const orderRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${credentials}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        amount: amountInSmallestUnit,
        currency: isInr ? "INR" : "USD",
        receipt: `kr_${user.id.slice(0, 8)}_${Date.now()}`,
        notes: {
          user_id: user.id,
          plan_id: planId,
          billing_cycle: billing,
          idempotency_key: idempotencyKey,
        },
      }),
    });

    if (!orderRes.ok) {
      const err = await orderRes.text();
      return NextResponse.json({ error: `Razorpay error: ${err}` }, { status: 500 });
    }

    const order = await orderRes.json();

    // Get user profile for prefill
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, total_credits, used_credits")
      .eq("id", user.id)
      .single();

    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: razorpayKeyId,
      credits: plan.credits * (isYearly ? 12 : 1),
      planName: planId,
      discount,
      finalAmount,
      idempotencyKey,
      prefill: {
        name: profile?.full_name || "",
        email: user.email || "",
      },
    });

  } catch (err: any) {
    console.error("Order error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
