// app/api/payment/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    // Verify webhook signature
    const expectedSig = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET!)
      .update(body)
      .digest("hex");

    if (signature !== expectedSig) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const orderId = payment.order_id;

      // Update payment status
      await supabase.from("payments")
        .update({
          razorpay_payment_id: payment.id,
          status: "completed",
        })
        .eq("razorpay_order_id", orderId);
    }

    if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      await supabase.from("payments")
        .update({ status: "failed" })
        .eq("razorpay_order_id", payment.order_id);
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

