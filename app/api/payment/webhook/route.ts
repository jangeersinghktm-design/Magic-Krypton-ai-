// app/api/payment/webhook/route.ts — Production Ready v3
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function verifyWebhookSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const computed = Array.from(new Uint8Array(signatureBytes))
    .map(b => b.toString(16).padStart(2, "0")).join("");
  return computed === signature;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET!;

    // ── CRITICAL: Verify webhook signature ───────────────────────
    const isValid = await verifyWebhookSignature(body, signature, webhookSecret);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const paymentId = event.payload?.payment?.entity?.id;
    const orderId   = event.payload?.payment?.entity?.order_id;
    const notes     = event.payload?.payment?.entity?.notes || {};

    console.log(`Webhook event: ${event.event}`, { paymentId, orderId });

    switch (event.event) {

      case "payment.captured": {
        // Payment successful — already handled in verify route
        // This is backup confirmation
        await supabase.from("payments")
          .update({ status: "success" })
          .eq("razorpay_payment_id", paymentId);
        break;
      }

      case "payment.failed": {
        const userId = notes.user_id;
        if (userId) {
          await supabase.from("notifications").insert({
            user_id: userId,
            title: "❌ Payment Failed",
            message: "Your payment could not be processed. Please try again.",
            type: "error",
            link: "/billing",
          });
        }
        await supabase.from("payments")
          .update({ status: "failed" })
          .eq("razorpay_order_id", orderId);
        break;
      }

      case "refund.created": {
        const refundPaymentId = event.payload?.refund?.entity?.payment_id;
        const refundAmount    = event.payload?.refund?.entity?.amount;

        await supabase.from("payments")
          .update({ status: "refunded", refunded_at: new Date().toISOString() })
          .eq("razorpay_payment_id", refundPaymentId);

        await supabase.from("invoices")
          .update({ status: "refunded" })
          .eq("razorpay_payment_id", refundPaymentId);

        // Notify user
        const { data: payment } = await supabase
          .from("payments")
          .select("user_id, amount")
          .eq("razorpay_payment_id", refundPaymentId)
          .single();

        if (payment?.user_id) {
          await supabase.from("notifications").insert({
            user_id: payment.user_id,
            title: "💰 Refund Processed",
            message: `Your refund of ₹${Math.floor(refundAmount / 100)} has been processed.`,
            type: "info",
            link: "/billing",
          });
        }
        break;
      }

      case "subscription.activated": {
        const subId = event.payload?.subscription?.entity?.id;
        const userId = notes.user_id;
        const planId = notes.plan_id || notes.planId;
        if (userId) {
          // P1 FIX: also update profiles.plan as backup if verify route failed
          await supabase.from("subscriptions")
            .update({ status: "active", razorpay_subscription_id: subId })
            .eq("user_id", userId);
          if (planId) {
            const PLAN_CREDITS: Record<string,number> = { pro: 100, premium: 300, business: 1000 };
            const credits = PLAN_CREDITS[planId] || 100;
            await supabase.from("profiles")
              .update({ plan: planId, total_credits: credits })
              .eq("id", userId);
          }
        }
        break;
      }

      case "subscription.cancelled": {
        const userId = notes.user_id;
        if (userId) {
          await supabase.from("subscriptions")
            .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
            .eq("user_id", userId);

          await supabase.from("profiles")
            .update({ subscription_status: "cancelled", cancel_at_period_end: true })
            .eq("id", userId);

          await supabase.from("notifications").insert({
            user_id: userId,
            title: "📋 Subscription Cancelled",
            message: "Your subscription has been cancelled. You can continue using it until period end.",
            type: "info",
            link: "/billing",
          });
        }
        break;
      }

      default:
        console.log("Unhandled webhook event:", event.event);
    }

    return NextResponse.json({ received: true, event: event.event });

  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
