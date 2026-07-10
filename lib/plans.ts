// lib/plans.ts
// Single source of truth for subscription plan data. Values here MUST
// stay in sync with PLAN_CONFIG in app/api/payment/order/route.ts —
// that file is the backend source of truth for pricing/credits; this
// file is the frontend display source of truth. Both are intentionally
// kept as plain data (not shared directly) since one is a Next.js API
// route module and the other is imported into client components.

export interface Plan {
  id: string;
  name: string;
  emoji: string;
  monthlyUsd: number;
  yearlyUsd: number;
  monthlyInr: number;
  yearlyInr: number;
  creditsLabel: string;
  cta: string;
  highlight: boolean;
  badge?: string;
  features: string[];
  locked: string[];
}

export const PLANS: Plan[] = [
  {
    id: "free", name: "Free", emoji: "○",
    monthlyUsd: 0, yearlyUsd: 0, monthlyInr: 0, yearlyInr: 0,
    creditsLabel: "20 Generations / Day", cta: "Current Plan", highlight: false,
    features: ["Website Generator","App Generator","Live Preview","Download HTML","Community Support"],
    locked: ["Save Projects","Project History","Advanced AI Model","Team Workspace","API Access","Priority Support"],
  },
  {
    id: "pro", name: "Pro", emoji: "◆",
    monthlyUsd: 25, yearlyUsd: 20, monthlyInr: 2099, yearlyInr: 1679,
    creditsLabel: "100 Generations / Month", cta: "Upgrade to Pro", highlight: true, badge: "Most Popular",
    features: ["Everything in Free","Save Projects","Project History","Faster Generation","Better AI Quality","Export Source Code","Private Projects","Premium Templates","Email Support"],
    locked: ["Team Workspace","API Access"],
  },
  {
    id: "premium", name: "Premium", emoji: "◇",
    monthlyUsd: 69, yearlyUsd: 55, monthlyInr: 5799, yearlyInr: 4639,
    creditsLabel: "300 Generations / Month", cta: "Upgrade to Premium", highlight: false,
    features: ["Everything in Pro","Fastest AI Model","Unlimited Project Saves","Version History","Team (5 Users)","Screenshot to App","AI Project Manager","Priority Support"],
    locked: ["API Access"],
  },
  {
    id: "business", name: "Business", emoji: "▣",
    monthlyUsd: 149, yearlyUsd: 119, monthlyInr: 12499, yearlyInr: 9999,
    creditsLabel: "Unlimited / Day", cta: "Contact Sales", highlight: false,
    features: ["Everything in Premium","API Access","Unlimited Team","Admin Dashboard","White Label","Custom AI Training","Business SLA","Dedicated Support"],
    locked: [],
  },
];

