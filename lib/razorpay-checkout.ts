// lib/razorpay-checkout.ts
// Extracted from app/billing/page.tsx's original inline handlePayment —
// same two endpoints, same payload shape, same Razorpay config. Only
// the billing-page-specific side effects (alert(), setState, loadData())
// were replaced with callbacks so this can be reused from UpgradeModal
// too, without duplicating the payment logic itself.

let scriptLoadPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise; // avoid injecting the script twice on rapid calls
  scriptLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => { scriptLoadPromise = null; reject(new Error("Failed to load Razorpay checkout script.")); };
    document.body.appendChild(script);
  });
  return scriptLoadPromise;
}

export interface RazorpayCheckoutParams {
  planId: string;                 // matches a PLAN_CONFIG key in /api/payment/order
  planName: string;                // shown in the Razorpay checkout description
  billing?: "monthly" | "yearly";
  currency?: string;
  promoCode?: string;
  accessToken: string;
  onSuccess: (result: any) => void;
  onFailure: (message: string) => void;
  onDismiss?: () => void;          // user closed the Razorpay checkout without paying
}

export async function openRazorpayCheckout(params: RazorpayCheckoutParams): Promise<void> {
  const billingCycle = params.billing || "monthly";
  const currency = params.currency || "INR";

  const res = await fetch("/api/payment/order", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${params.accessToken}` },
    body: JSON.stringify({ planId: params.planId, billing: billingCycle, currency, promoCode: params.promoCode || "" }),
  });
  const order = await res.json();
  if (!res.ok) { params.onFailure(order.error || "Payment failed to initialize."); return; }

  try {
    await loadRazorpayScript();
  } catch (e: any) {
    params.onFailure(e.message || "Could not load payment gateway.");
    return;
  }

  const rzp = new (window as any).Razorpay({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency || "INR",
    name: "Krypton AI",
    description: params.planName,
    image: "/logo.png",
    order_id: order.orderId,
    prefill: order.prefill,
    theme: { color: "#FFD84D" },
    method: { card: true, upi: true, netbanking: true, wallet: true, emi: true },
    handler: async (response: any) => {
      const verifyRes = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${params.accessToken}` },
        body: JSON.stringify({
          razorpay_order_id: response.razorpay_order_id,
          razorpay_payment_id: response.razorpay_payment_id,
          razorpay_signature: response.razorpay_signature,
          planId: params.planId, billing: billingCycle, currency,
          idempotencyKey: order.idempotencyKey,
        }),
      });
      const result = await verifyRes.json();
      if (result.success) params.onSuccess(result);
      else params.onFailure("Payment verification failed. Contact support.");
    },
    modal: { ondismiss: () => params.onDismiss?.() },
  });
  rzp.open();
}

