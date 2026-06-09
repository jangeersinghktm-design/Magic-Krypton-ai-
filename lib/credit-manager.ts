// lib/credit-manager.ts
// Centralized Credit Management System
// Use this everywhere — NEVER hardcode credit values

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Plan Credit Limits ───────────────────────────────────────────
export const PLAN_CREDITS = {
  free:     { monthly: 5,    daily: 5,   max: 5    },
  pro:      { monthly: 2000, daily: null, max: 2000 },
  premium:  { monthly: 5000, daily: null, max: 5000 },
  business: { monthly: null, daily: 100, max: null  }, // unlimited
} as const;

export const CREDIT_COSTS = {
  generate_quick:    1,  // 1-15 words
  generate_standard: 2,  // 16-25 words
  generate_detailed: 3,  // 26-100 words
  generate_complex:  4,  // 100+ words (up to 8)
  ai_edit:           1,
  screenshot_to_app: 15,
  ai_project_manager:5,
  ai_analysis:       5,
  deploy:            2,
} as const;

export const FREE_MAX_CREDITS = 5;
export const FREE_DAILY_GENERATIONS = 5;

export type Plan = "free" | "pro" | "premium" | "business";
export type Feature = 
  | "generate" | "save_projects" | "project_history" | "advanced_ai"
  | "team_workspace" | "api_access" | "premium_templates" | "export_source"
  | "screenshot_to_app" | "ai_project_manager" | "github_push"
  | "custom_domains" | "version_history" | "private_projects" | "cloud_code"
  | "ai_edit" | "ai_analysis" | "deploy" | "download_html";

export interface CreditStatus {
  plan: Plan;
  total: number;
  used: number;
  remaining: number;
  dailyGenerations: number;
  nextReset: string | null;
  periodEnd: string | null;
  isExpired: boolean;
}

export interface GateResult {
  allowed: boolean;
  reason?: string;
  remainingCredits?: number;
  creditCost?: number;
  upgradeRequired?: boolean;
  requiredPlan?: string;
  plan?: Plan;
}

// ── Get credit cost based on prompt length ───────────────────────
export function calculateCreditCost(prompt: string, isEdit = false): number {
  if (isEdit) return CREDIT_COSTS.ai_edit;
  const words = prompt.trim().split(/\s+/).length;
  if (words <= 15) return CREDIT_COSTS.generate_quick;
  if (words <= 25) return CREDIT_COSTS.generate_standard;
  if (words <= 100) return CREDIT_COSTS.generate_detailed;
  return Math.min(4 + Math.floor((words - 100) / 50), 8);
}

// ── Get current credit status ────────────────────────────────────
export async function checkCredits(
  userId: string,
  supabase: SupabaseClient
): Promise<CreditStatus> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, total_credits, used_credits, daily_generations, daily_reset_date, credits_last_reset, current_period_end")
    .eq("id", userId)
    .single();

  if (!profile) throw new Error("Profile not found");

  const plan = (profile.plan || "free") as Plan;
  const today = new Date().toISOString().split("T")[0];

  // Auto-reset daily for free users
  if (plan === "free") {
    const lastReset = profile.credits_last_reset || "2000-01-01";
    if (lastReset < today) {
      const remaining = Math.max(0, profile.total_credits - profile.used_credits);
      if (remaining === 0) {
        await supabase.from("profiles").update({
          total_credits: FREE_MAX_CREDITS,
          used_credits: 0,
          credits_last_reset: today,
          daily_generations: 0,
          daily_reset_date: today,
        }).eq("id", userId);
        profile.total_credits = FREE_MAX_CREDITS;
        profile.used_credits = 0;
        profile.daily_generations = 0;
      } else {
        await supabase.from("profiles").update({
          credits_last_reset: today,
          daily_generations: 0,
          daily_reset_date: today,
        }).eq("id", userId);
        profile.daily_generations = 0;
      }
    }
  }

  // Auto-reset daily for business (100/day)
  if (plan === "business") {
    const dailyReset = profile.daily_reset_date || "2000-01-01";
    if (dailyReset < today) {
      await supabase.from("profiles").update({
        used_credits: 0,
        daily_generations: 0,
        daily_reset_date: today,
        total_credits: 100,
      }).eq("id", userId);
      profile.total_credits = 100;
      profile.used_credits = 0;
    }
  }

  const remaining = Math.max(0, (profile.total_credits || 0) - (profile.used_credits || 0));
  const periodEnd = profile.current_period_end;
  const isExpired = periodEnd ? new Date(periodEnd) < new Date() : false;

  return {
    plan,
    total: profile.total_credits || 0,
    used: profile.used_credits || 0,
    remaining,
    dailyGenerations: profile.daily_generations || 0,
    nextReset: profile.credits_last_reset || today,
    periodEnd,
    isExpired,
  };
}

// ── Check feature access ─────────────────────────────────────────
export async function checkPlanAccess(
  userId: string,
  feature: Feature,
  supabase: SupabaseClient
): Promise<GateResult> {
  const status = await checkCredits(userId, supabase);

  // Check subscription expiry
  if (status.isExpired && status.plan !== "free") {
    await supabase.from("profiles")
      .update({ plan: "free", total_credits: FREE_MAX_CREDITS, used_credits: 0, subscription_status: "expired" })
      .eq("id", userId);
    return { allowed: false, reason: "Subscription expired. Downgraded to free.", upgradeRequired: true, plan: "free" };
  }

  // Check feature permission
  const { data: permission } = await supabase
    .from("plan_features")
    .select("allowed")
    .eq("plan", status.plan)
    .eq("feature", feature)
    .single();

  if (!permission?.allowed) {
    const requiredPlan = getRequiredPlan(feature);
    return {
      allowed: false,
      reason: `${feature.replace(/_/g, " ")} requires ${requiredPlan} plan.`,
      upgradeRequired: true,
      requiredPlan,
      plan: status.plan,
    };
  }

  return { allowed: true, plan: status.plan, remainingCredits: status.remaining };
}

// ── Consume credits ──────────────────────────────────────────────
export async function consumeCredits(
  userId: string,
  amount: number,
  description: string,
  supabase: SupabaseClient
): Promise<{ success: boolean; remaining: number; error?: string }> {
  const status = await checkCredits(userId, supabase);

  if (status.remaining < amount) {
    return {
      success: false,
      remaining: status.remaining,
      error: status.plan === "free"
        ? `Need ${amount} credits. You have ${status.remaining}. Free plan: ${FREE_MAX_CREDITS}/day.`
        : `Need ${amount} credits. You have ${status.remaining}.`,
    };
  }

  const today = new Date().toISOString().split("T")[0];
  const updates: any = { used_credits: status.used + amount };

  if (status.plan === "free") {
    const dailyReset = (await supabase.from("profiles").select("daily_reset_date, daily_generations").eq("id", userId).single()).data;
    const currentDailyGens = dailyReset?.daily_reset_date === today ? (dailyReset?.daily_generations || 0) : 0;
    if (currentDailyGens >= FREE_DAILY_GENERATIONS) {
      return { success: false, remaining: status.remaining, error: "Daily generation limit reached. Come back tomorrow!" };
    }
    updates.daily_generations = currentDailyGens + 1;
    updates.daily_reset_date = today;
  }

  await supabase.from("profiles").update(updates).eq("id", userId);

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: -amount,
    type: "usage",
    description,
  });

  return { success: true, remaining: status.remaining - amount };
}

// ── Add credits (after payment) ──────────────────────────────────
export async function addCredits(
  userId: string,
  amount: number,
  plan: Plan,
  description: string,
  supabase: SupabaseClient
): Promise<void> {
  const planCredits = PLAN_CREDITS[plan];
  const maxCredits = planCredits.max;

  // For free plan: never exceed 5
  if (plan === "free") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("total_credits, used_credits")
      .eq("id", userId)
      .single();

    const remaining = Math.max(0, (profile?.total_credits || 0) - (profile?.used_credits || 0));
    if (remaining > 0) return; // Don't add if credits remain

    await supabase.from("profiles").update({
      total_credits: FREE_MAX_CREDITS,
      used_credits: 0,
    }).eq("id", userId);
  } else {
    await supabase.from("profiles").update({
      plan,
      total_credits: amount,
      used_credits: 0,
      subscription_status: "active",
    }).eq("id", userId);
  }

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount,
    type: plan === "free" ? "daily_reset" : "subscription",
    description,
  });
}

// ── Reset credits ────────────────────────────────────────────────
export async function resetCredits(
  userId: string,
  plan: Plan,
  supabase: SupabaseClient
): Promise<void> {
  const planCredits = PLAN_CREDITS[plan];
  const credits = plan === "business" ? 100 : (planCredits.monthly || FREE_MAX_CREDITS);

  await supabase.from("profiles").update({
    total_credits: credits,
    used_credits: 0,
    credits_last_reset: new Date().toISOString().split("T")[0],
    daily_generations: 0,
  }).eq("id", userId);
}

// ── Get required plan for feature ───────────────────────────────
export function getRequiredPlan(feature: Feature): string {
  const businessOnly = ["api_access"];
  const premiumOnly  = ["team_workspace"];
  const proRequired  = ["save_projects", "project_history", "advanced_ai", "premium_templates", "export_source", "screenshot_to_app", "ai_project_manager", "github_push", "custom_domains", "version_history", "private_projects", "cloud_code"];

  if (businessOnly.includes(feature)) return "Business";
  if (premiumOnly.includes(feature))  return "Premium";
  if (proRequired.includes(feature))  return "Pro";
  return "Free";
}
  
