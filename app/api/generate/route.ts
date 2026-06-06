// app/api/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 60;

// ── In-memory Rate Limiter ─────────────────────────────────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const key = `generate:${ip}`;
  const entry = rateLimitMap.get(key);
  const LIMIT = 10;
  const WINDOW = 60 * 1000; // 1 minute

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + WINDOW });
    return true;
  }
  if (entry.count >= LIMIT) return false;
  entry.count++;
  return true;
}

// ── Input Sanitizer ────────────────────────────────────────────────
function sanitize(prompt: string): { clean: string; error?: string } {
  if (!prompt?.trim()) return { clean: "", error: "Prompt required" };
  if (prompt.length > 2000) return { clean: "", error: "Prompt too long. Max 2000 chars." };
  if (prompt.trim().length < 3) return { clean: "", error: "Prompt too short." };

  const clean = prompt
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/javascript:/gi, "")
    .trim();

  return { clean };
}

export async function POST(request: NextRequest) {
  try {
    // ── Rate Limit ───────────────────────────────────────────────
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!rateLimit(ip)) {
      return NextResponse.json(
        { error: "Too many requests. Please wait." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const body = await request.json();
    const { prompt } = body;

    // ── Sanitize Input ───────────────────────────────────────────
    const { clean, error: sanitizeError } = sanitize(prompt);
    if (sanitizeError) {
      return NextResponse.json({ error: sanitizeError }, { status: 400 });
    }

    // ── Auth + Credit Check ──────────────────────────────────────
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    let userId: string | null = null;
    let userProfile: any = null;

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: profile } = await supabase
          .from("profiles")
          .select("total_credits, used_credits, plan")
          .eq("id", user.id)
          .single();

        userProfile = profile;

        const remaining = (profile?.total_credits || 100) - (profile?.used_credits || 0);
        if (remaining < 5) {
          return NextResponse.json(
            { error: "Insufficient credits! Please upgrade your plan." },
            { status: 402 }
          );
        }
      }
    }

    // ── System Prompt ────────────────────────────────────────────
    const systemPrompt = `You are an elite full-stack developer and UI/UX designer. Build EXACTLY what the user asks.

USER REQUEST: "${clean}"

OUTPUT FORMAT:
- Output ONLY raw HTML starting with <!DOCTYPE html>
- End with </html>
- ZERO backticks, ZERO markdown
- Single self-contained HTML file

DESIGN:
- White or light background ALWAYS
- Dark readable text ALWAYS
- Premium fonts from Google Fonts
- Smooth animations and hover effects
- Mobile responsive

FOR GAMES:
- Use HTML5 Canvas
- 60fps with requestAnimationFrame
- Keyboard + touch controls
- Score system and game over screen

FOR WEBSITES:
- Full multi-section: header, hero, features, pricing, footer
- Working hamburger menu on mobile

FOR APPS:
- Fully functional
- LocalStorage for data persistence

QUALITY: Think Stripe, Linear, Notion level quality.`;

    const isGameRequest = /game|snake|tetris|pong|chess|puzzle|arcade/i.test(clean);
    const isWebsiteRequest = /website|landing|portfolio|business|saas/i.test(clean);

    const validateHtml = (html: string) => {
      const issues: string[] = [];
      if (!html.startsWith("<!DOCTYPE") || !html.includes("</html>")) issues.push("Invalid HTML");
      if (html.length < 1500) issues.push("HTML too short");
      if (isWebsiteRequest && !html.includes("<header")) issues.push("Missing header");
      if (isWebsiteRequest && !html.includes("<footer")) issues.push("Missing footer");
      if (isGameRequest && !html.includes("<canvas")) issues.push("Missing canvas");
      return { valid: issues.length === 0, issues };
    };

    const cleanHtml = (html: string) => {
      html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      const idx = html.indexOf("<!DOCTYPE");
      if (idx > 0) html = html.substring(idx);
      return html;
    };

    const callClaude = async (content: string) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 12000,
          messages: [{ role: "user", content }],
        }),
      });
      if (!res.ok) {
        const err = await res.text();
        console.log("Claude error:", res.status, err);
        return null;
      }
      const data = await res.json();
      return data.content[0].text;
    };

    const processHtml = async (raw: string) => {
      const html = cleanHtml(raw);
      const { valid, issues } = validateHtml(html);
      if (valid) return html;

      const repairPrompt = `Fix these HTML issues and return ONLY corrected HTML:\n${issues.join("\n")}\nHTML: ${html.substring(0, 10000)}`;
      const repaired = await callClaude(repairPrompt);
      if (repaired) {
        const fixed = cleanHtml(repaired);
        if (fixed.length > 1500) return fixed;
      }
      return html.length > 1500 ? html : null;
    };

    const deductCredits = async () => {
      if (!userId || !userProfile) return;
      const newUsed = (userProfile.used_credits || 0) + 5;
      await supabase.from("profiles").update({ used_credits: newUsed }).eq("id", userId);
      await supabase.from("credit_transactions").insert({
        user_id: userId,
        amount: -5,
        type: "usage",
        description: `Generate: ${clean.slice(0, 50)}`,
      });
    };

    // ── Try Claude ───────────────────────────────────────────────
    try {
      const raw = await callClaude(systemPrompt);
      if (raw) {
        const html = await processHtml(raw);
        if (html) {
          await deductCredits();
          return NextResponse.json({ html, model: "claude" });
        }
      }
    } catch (e: any) {
      console.log("Claude error:", e.message);
    }

    // ── Try Gemini ───────────────────────────────────────────────
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { maxOutputTokens: 12000 },
          }),
        }
      );
      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const html = await processHtml(raw);
        if (html) {
          await deductCredits();
          return NextResponse.json({ html, model: "gemini" });
        }
      }
    } catch (e: any) {
      console.log("Gemini error:", e.message);
    }

    return NextResponse.json(
      { error: "All AI services failed. Please try again." },
      { status: 500 }
    );

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
