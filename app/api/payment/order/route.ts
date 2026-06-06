// app/api/payment/order/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Razorpay from "razorpay";

export const runtime = "edge";

const PLANS: Record<string, { name: string; price_inr: number; price_usd: number; credits: number }> = {
  pro:      { name: "Pro",      price_inr: 209900, price_usd: 25,  credits: 2000  },
  premium:  { name: "Premium",  price_inr: 579900, price_usd: 69,  credits: 5000  },
  business: { name: "Business", price_inr: 1249900,price_usd: 149, credits: 10000 },
  topup_50:  { name: "Top-up 50 Credits",  price_inr: 129900, price_usd: 15, credits: 50  },
  topup_100: { name: "Top-up 100 Credits", price_inr: 259900, price_usd: 30, credits: 100 },
  topup_200: { name: "Top-up 200 Credits", price_inr: 499900, price_usd: 60, credits: 200 },
  topup_500: { name: "Top-up 500 Credits", price_inr: 1199900,price_usd: 150,credits: 500 },
};

export async function POST(req: NextRequest) {
  try {
    const { planId } = await req.json();

    if (!planId || !PLANS[planId]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
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

    const plan = PLANS[planId];

    // Create Razorpay order
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const order = await razorpay.orders.create({
      amount: plan.price_inr, // in paise
      currency: "INR",
      receipt: `krypton_${user.id.slice(0, 8)}_${Date.now()}`,
      notes: {
        user_id: user.id,
        plan_id: planId,
        credits: plan.credits.toString(),
      },
    });

    // Save pending payment in DB
    await supabase.from("payments").insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      amount_inr: plan.price_inr / 100,
      amount_usd: plan.price_usd,
      plan_id: planId.startsWith("topup") ? null : planId,
      credits_added: plan.credits,
      status: "pending",
      type: planId.startsWith("topup") ? "topup" : "subscription",
    });

    return NextResponse.json({
      orderId: order.id,
      amount: plan.price_inr,
      currency: "INR",
      keyId: process.env.RAZORPAY_KEY_ID,
      planName: plan.name,
      credits: plan.credits,
    });

  } catch (err: any) {
    console.error("Order error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

