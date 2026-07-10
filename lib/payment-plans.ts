// lib/payment-plans.ts
// Single source of truth for credit top-up tiers, shared by Billing page,
// UpgradeModal, and any future pricing UI. Values MUST match the
// topup_* entries in app/api/payment/order/route.ts's PLAN_CONFIG —
// that route is the backend source of truth; this is the frontend
// display source of truth for the exact same 4 tiers.

export interface TopupTier {
  id: string;       // must match a PLAN_CONFIG key in app/api/payment/order/route.ts
  credits: number;
  usd: number;
  inr: number;
}

export const TOPUPS: TopupTier[] = [
  { id: "topup_50",  credits: 50,  usd: 15,  inr: 1299  },
  { id: "topup_100", credits: 100, usd: 30,  inr: 2599  },
  { id: "topup_200", credits: 200, usd: 60,  inr: 4999  },
  { id: "topup_500", credits: 500, usd: 150, inr: 11999 },
];

