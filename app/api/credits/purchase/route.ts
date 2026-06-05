import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { amount, credits, type, planId } = body;

    if (!amount || !credits) {
      return NextResponse.json(
        { error: "Amount and credits required" },
        { status: 400 }
      );
    }

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay not configured" },
        { status: 500 }
      );
    }

    // Edge Runtime compatible base64
    const credentials = btoa(`${keyId}:${keySecret}`);

    const razorpayRes = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${credentials}`,
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100),
          currency: "INR",
          receipt: `krypton_${Date.now()}`,
          notes: {
            credits: String(credits),
            type: type || "topup",
            planId: planId || "",
          },
        }),
      }
    );

    const data = await razorpayRes.json();

    if (!razorpayRes.ok) {
      return NextResponse.json(
        { error: data?.error?.description || "Razorpay order creation failed" },
        { status: razorpayRes.status }
      );
    }

    return NextResponse.json(data);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
