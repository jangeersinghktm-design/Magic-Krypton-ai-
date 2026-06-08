// lib/feature-gate.ts
// Server-side feature gate system
// Use this in every API route that needs plan checking

import { createClient } from "@supabase/supabase-js";

export const FREE_PLAN_MAX_CREDITS = 5;

export const FEATURE_COST: Record<string, number> = {
  generate:           5,
  ai_edit:            1,
  screenshot_to_app:  15,
  ai_project_manager: 5,
  deploy:             2,
  analysis:           5,
};

export type Feature =
  | "generate"
  | "save_projects"
  | "project_history"
  | "advanced_ai"
  | "team_workspace"
  | "api_access"
  | "premium_templates"
  | "export_full_code"
  | "screenshot_to_app"
  | "ai_project_manager"
  | "github_push"
  | "deploy"
  | "private_projects"
  | "version_history"
  | "ai_edit"
  | "analysis";

export interface GateResult {
  allowed: boolean;
  reason?: string;
  remainingCredits?: number;
  plan?: string;
  upgradeRequired?: boolean;
  creditCost?: number;
}

export async function checkFeatureGate(
  userId: string,
  feature: Feature,
  supabase: ReturnType<typeof createClient>
): Promise<GateResult> {
  // Get user profile
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("plan, total_credits, used_credits, is_suspended, credits_last_reset, daily_generations, daily_reset_date, current_period_end, subscription_status")
    .eq("id", userId)
    .single();

  if (error || !profile) {
    return { allowed: false, reason: "Profile not found" };
  }

  // Check suspension
  if (profile.is_suspended) {
    return { allowed: false, reason: "Account suspended. Contact support." };
  }

  const plan = profile.plan || "free";
  const creditCost = FEATURE_COST[feature] || 1;
  const remaining = Math.max(0, (profile.total_credits || 0) - (profile.used_credits || 0));

  // ── FREE PLAN: Daily credit reset check ──────────────────────
  if (plan === "free") {
    const today = new Date().toISOString().split("T")[0];
    const lastReset = profile.credits_last_reset || "2000-01-01";

    if (lastReset < today) {
      // Auto-reset: cap at 5, never exceed
      const newCredits = Math.min(5, remaining + (5 - remaining));
      await supabase.from("profiles")
        .update({
          total_credits: FREE_PLAN_MAX_CREDITS,
          used_credits: 0,
          credits_last_reset: today,
          daily_generations: 0,
          daily_reset_date: today,
        })
        .eq("id", userId);
    }
  }

  // ── Check subscription expiry for paid plans ─────────────────
  if (plan !== "free" && profile.current_period_end) {
    const periodEnd = new Date(profile.current_period_end);
    if (periodEnd < new Date()) {
      // Downgrade to free
      await supabase.from("profiles")
        .update({
          plan: "free",
          total_credits: FREE_PLAN_MAX_CREDITS,
          used_credits: 0,
          subscription_status: "expired",
        })
        .eq("id", userId);

      return {
        allowed: false,
        reason: "Subscription expired. Downgraded to free plan.",
        upgradeRequired: true,
        plan: "free",
      };
    }
  }

  // ── Check feature permission ─────────────────────────────────
  const { data: permission } = await supabase
    .from("plan_features")
    .select("allowed, limit_value")
    .eq("plan", plan)
    .eq("feature", feature)
    .single();

  if (!permission?.allowed) {
    return {
      allowed: false,
      reason: `${feature.replace(/_/g, " ")} requires a paid plan.`,
      upgradeRequired: true,
      plan,
      remainingCredits: remaining,
    };
  }

  // ── Check credit balance ────────────────────────────────────
  const freshRemaining = Math.max(0, (profile.total_credits || 0) - (profile.used_credits || 0));

  if (freshRemaining < creditCost) {
    const isFree = plan === "free";
    return {
      allowed: false,
      reason: isFree
        ? `Insufficient credits. Free plan gets ${FREE_PLAN_MAX_CREDITS} credits/day. You have ${freshRemaining}.`
        : `Insufficient credits. You have ${freshRemaining} credits remaining.`,
      remainingCredits: freshRemaining,
      creditCost,
      upgradeRequired: isFree,
      plan,
    };
  }

  // ── Check daily limit for free plan ─────────────────────────
  if (plan === "free" && feature === "generate") {
    const today = new Date().toISOString().split("T")[0];
    const dailyReset = profile.daily_reset_date || "2000-01-01";
    const dailyGens = dailyReset === today ? (profile.daily_generations || 0) : 0;
    const dailyLimit = 1; // Free: 1 generation per day (costs 5 credits)

    if (dailyGens >= dailyLimit) {
      return {
        allowed: false,
        reason: `Free plan allows ${dailyLimit} generation per day. Upgrade for unlimited.`,
        remainingCredits: freshRemaining,
        upgradeRequired: true,
        plan,
      };
    }
  }

  return {
    allowed: true,
    remainingCredits: freshRemaining,
    creditCost,
    plan,
  };
}

// ── Deduct credits after successful generation ───────────────
export async function deductCredits(
  userId: string,
  feature: Feature,
  supabase: ReturnType<typeof createClient>,
  description?: string
): Promise<void> {
  const creditCost = FEATURE_COST[feature] || 1;

  const { data: profile } = await supabase
    .from("profiles")
    .select("used_credits, daily_generations, plan")
    .eq("id", userId)
    .single();

  if (!profile) return;

  const updates: any = {
    used_credits: (profile.used_credits || 0) + creditCost,
  };

  // Track daily generations for free plan
  if (profile.plan === "free" || !profile.plan) {
    const today = new Date().toISOString().split("T")[0];
    updates.daily_generations = (profile.daily_generations || 0) + 1;
    updates.daily_reset_date = today;
  }

  await supabase.from("profiles")
    .update(updates)
    .eq("id", userId);

  // Log transaction
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: -creditCost,
    type: "usage",
    description: description || `${feature.replace(/_/g, " ")} — ${creditCost} credits`,
  });
}

// ── Check if user can access a route ────────────────────────
export function getRequiredPlan(feature: Feature): string {
  const proFeatures   = ["save_projects", "project_history", "advanced_ai", "premium_templates", "export_full_code", "screenshot_to_app", "ai_project_manager", "github_push", "deploy", "private_projects", "version_history"];
  const premiumFeatures = ["team_workspace"];
  const businessFeatures = ["api_access"];

  if (businessFeatures.includes(feature)) return "business";
  if (premiumFeatures.includes(feature))  return "premium";
  if (proFeatures.includes(feature))      return "pro";
  return "free";
}
  
