// app/api/payment/webhook/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "No signature" }, { status: 400 });
    }

    // ── Verify webhook using Web Crypto ───────────────────────────
    const encoder = new TextEncoder();
    const secret = process.env.RAZORPAY_KEY_SECRET!;

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(body)
    );

    const expectedSig = Array.from(new Uint8Array(sig))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    if (signature !== expectedSig) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Handle events ─────────────────────────────────────────────
    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      await supabase.from("payments")
        .update({
          razorpay_payment_id: payment.id,
          status: "completed",
        })
        .eq("razorpay_order_id", payment.order_id);
    }

    if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      await supabase.from("payments")
        .update({ status: "failed" })
        .eq("razorpay_order_id", payment.order_id);
    }

    return NextResponse.json({ received: true });

  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
