// app/api/generate/route.ts — Production v4 with strict feature gates
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkFeatureGate, deductCredits } from "@/lib/feature-gate";

const FREE_PLAN_MAX_CREDITS = 5;

export const maxDuration = 60;
export const runtime = "nodejs";

// Rate limit store (in-memory for edge)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit by IP ────────────────────────────────────────
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(`ip_${ip}`, 10, 60000)) {
      return NextResponse.json({ error: "Rate limit exceeded. Try again in 1 minute." }, { status: 429 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Auth check ──────────────────────────────────────────────
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: "Invalid session. Please login again." }, { status: 401 });
    }

    const { prompt, projectId, isEdit = false } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (prompt.length > 2000) {
      return NextResponse.json({ error: "Prompt too long. Max 2000 characters." }, { status: 400 });
    }

    // ── Feature gate check ──────────────────────────────────────
    const feature = isEdit ? "ai_edit" : "generate";
    const gate = await checkFeatureGate(user.id, feature, supabase);

    if (!gate.allowed) {
      return NextResponse.json({
        error: gate.reason,
        upgradeRequired: gate.upgradeRequired,
        remainingCredits: gate.remainingCredits,
        plan: gate.plan,
        creditCost: gate.creditCost,
        code: gate.upgradeRequired ? "UPGRADE_REQUIRED" : "INSUFFICIENT_CREDITS",
      }, { status: 402 });
    }

    // ── Get user plan for model selection ───────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .single();

    const plan = profile?.plan || "free";

    // ── Select AI model based on plan ───────────────────────────
    const model = plan === "business" || plan === "premium"
     ? "claude-sonnet-4-6"        // Best quality
     : "claude-haiku-4-5-20251001"; // Fast — no timeout

    // ── Rate limit by user (stricter for free) ──────────────────
    const userLimit = plan === "free" ? 3 : 20;
    if (!checkRateLimit(`user_${user.id}`, userLimit, 60000)) {
      return NextResponse.json({
        error: `Too many requests. ${plan === "free" ? "Free users: 3/minute. Upgrade for more." : "Please wait a moment."}`,
        upgradeRequired: plan === "free",
      }, { status: 429 });
    }

    // ── Build system prompt ─────────────────────────────────────
    const systemPrompt = `You are Krypton AI, an expert web developer.
Generate a complete, self-contained HTML file for the user's request.

RULES:
- Output ONLY raw HTML starting with <!DOCTYPE html>
- End with </html>
- No markdown, no backticks, no explanations
- Include all CSS in <style> tags
- Include all JavaScript in <script> tags
- Make it fully responsive
- Use modern design with animations
- Premium quality production code
- Minimum 200 lines of code

${plan === "free" ? "Note: Standard quality generation." : "Use the highest quality, most sophisticated code."}`;

    // ── Call Claude API ─────────────────────────────────────────
    let html = "";
    let usedGemini = false;

    try {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: plan === "free" ? 8000 : 16000,
          system: systemPrompt,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      if (!claudeRes.ok) throw new Error(`Claude API error: ${claudeRes.status}`);

      const data = await claudeRes.json();
      html = data.content[0].text;

    } catch (claudeErr) {
      // Fallback to Gemini
      if (process.env.GEMINI_API_KEY) {
        try {
          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: `${systemPrompt}\n\nUser request: ${prompt}` }] }],
              }),
            }
          );
          const gemData = await geminiRes.json();
          html = gemData.candidates?.[0]?.content?.parts?.[0]?.text || "";
          usedGemini = true;
        } catch (gemErr) {
          throw new Error("Both AI services unavailable. Please try again.");
        }
      } else {
        throw claudeErr;
      }
    }

    // ── Clean HTML ──────────────────────────────────────────────
    html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const idx = html.indexOf("<!DOCTYPE");
    if (idx > 0) html = html.substring(idx);

    if (!html.includes("<!DOCTYPE") || html.length < 500) {
      return NextResponse.json({ error: "Generated code is invalid. Please try again with a more detailed prompt." }, { status: 500 });
    }

    // ── Deduct credits ──────────────────────────────────────────
    await deductCredits(user.id, feature, supabase, `${isEdit ? "AI Edit" : "Generation"}: ${prompt.slice(0, 50)}...`);

    // ── Save or update project ──────────────────────────────────
    let savedProjectId = projectId;

    // Only save if not free plan (free users can't save)
    const canSave = true;

    // Save for ALL users including free
    if (projectId) {
      await supabase.from("projects").update({
       html_code: html,
       prompt,
       updated_at: new Date().toISOString(),
     }).eq("id", projectId).eq("user_id", user.id);
    } else {
      const { data: newProject } = await supabase.from("projects").insert({
      user_id: user.id,
      title: prompt.slice(0, 60),
      prompt,
      html_code: html,
      status: "completed",
     }).select().single();
     savedProjectId = newProject?.id;
    }
          html_code: html,
          prompt,
          updated_at: new Date().toISOString(),
        }).eq("id", projectId).eq("user_id", user.id);
      } else {
        const { data: newProject } = await supabase.from("projects").insert({
          user_id: user.id,
          title: prompt.slice(0, 60),
          prompt,
          html_code: html,
          status: "completed",
        }).select().single();
        savedProjectId = newProject?.id;
      }
    }

    // ── Get fresh credit balance ────────────────────────────────
    const { data: updatedProfile } = await supabase
      .from("profiles")
      .select("total_credits, used_credits")
      .eq("id", user.id)
      .single();

    const remaining = Math.max(0, (updatedProfile?.total_credits || 0) - (updatedProfile?.used_credits || 0));

    return NextResponse.json({
      html,
      projectId: savedProjectId,
      creditsUsed: gate.creditCost,
      creditsRemaining: remaining,
      model: usedGemini ? "gemini" : model,
      canSave,
      plan,
    });

  } catch (err: any) {
    console.error("Generate error:", err);
    return NextResponse.json({ error: err.message || "Generation failed" }, { status: 500 });
  }
}
