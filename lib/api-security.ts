// lib/api-security.ts
// Krypton AI — Reusable API Security Middleware

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// ── Rate Limiting (in-memory) ──────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

// ── Auth Check ────────────────────────────────────────────────────
export async function authCheck(req: NextRequest): Promise<{
  user: any;
  profile: any;
  error?: NextResponse;
}> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const authHeader = req.headers.get("Authorization");
  const token = authHeader?.replace("Bearer ", "");

  if (!token) {
    return {
      user: null,
      profile: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      user: null,
      profile: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("total_credits, used_credits, plan")
    .eq("id", user.id)
    .single();

  return { user, profile };
}

// ── Input Sanitization ────────────────────────────────────────────
export function sanitizePrompt(prompt: string): {
  clean: string;
  error?: string;
} {
  if (!prompt || typeof prompt !== "string") {
    return { clean: "", error: "Prompt is required" };
  }

  // Length check
  if (prompt.length > 2000) {
    return { clean: "", error: "Prompt too long. Max 2000 characters." };
  }

  if (prompt.trim().length < 3) {
    return { clean: "", error: "Prompt too short. Min 3 characters." };
  }

  // Remove dangerous patterns
  const clean = prompt
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/on\w+\s*=/gi, "")
    .trim();

  return { clean };
}

// ── Credit Check ──────────────────────────────────────────────────
export function creditCheck(
  profile: any,
  required: number
): { allowed: boolean; error?: NextResponse } {
  if (!profile) {
    return {
      allowed: false,
      error: NextResponse.json({ error: "Profile not found" }, { status: 404 }),
    };
  }

  const remaining = (profile.total_credits || 100) - (profile.used_credits || 0);

  if (remaining < required) {
    return {
      allowed: false,
      error: NextResponse.json(
        { error: `Insufficient credits. Need ${required}, have ${remaining}.` },
        { status: 402 }
      ),
    };
  }

  return { allowed: true };
}

// ── Full Security Check ───────────────────────────────────────────
export async function secureRoute(
  req: NextRequest,
  options: {
    rateLimit?: { key: string; limit: number; windowMs: number };
    requireAuth?: boolean;
    requiredCredits?: number;
    sanitizeBody?: boolean;
  } = {}
): Promise<{
  user?: any;
  profile?: any;
  prompt?: string;
  error?: NextResponse;
}> {
  // Rate limiting
  if (options.rateLimit) {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const key = `${options.rateLimit.key}:${ip}`;
    const { allowed, remaining } = rateLimit(
      key,
      options.rateLimit.limit,
      options.rateLimit.windowMs
    );

    if (!allowed) {
      return {
        error: NextResponse.json(
          { error: "Too many requests. Please slow down." },
          {
            status: 429,
            headers: { "Retry-After": "60" },
          }
        ),
      };
    }
  }

  // Auth check
  if (options.requireAuth !== false) {
    const { user, profile, error } = await authCheck(req);
    if (error) return { error };

    // Credit check
    if (options.requiredCredits) {
      const { allowed, error: creditError } = creditCheck(
        profile,
        options.requiredCredits
      );
      if (!allowed) return { error: creditError };
    }

    return { user, profile };
  }

  return {};
}

