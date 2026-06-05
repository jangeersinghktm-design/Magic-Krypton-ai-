import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
    } = await req.json();

    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
      return NextResponse.json(
        { error: "Razorpay secret not set" },
        { status: 500 }
      );
    }

    // Verify signature
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSig = crypto
      .createHmac("sha256", keySecret)
      .update(body)
      .digest("hex");

    if (expectedSig !== razorpay_signature) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
