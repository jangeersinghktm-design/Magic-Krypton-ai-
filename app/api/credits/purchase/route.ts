import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { amount, credits, type, planId } = await req.json();

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay keys not set" },
        { status: 500 }
      );
    }

    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`,
      },
      body: JSON.stringify({
        amount: amount * 100,
        currency: "INR",
        receipt: `krypton_${Date.now()}`,
        notes: { credits: String(credits), type, planId },
      }),
    });

    const order = await response.json();
    return NextResponse.json(order);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
