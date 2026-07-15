// app/api/generate-pro/route.ts
// Krypton AI — Multi-Generator Engine
// 8 Specialized Generators: Website / Landing / App / Game / Dashboard / Tool / E-Commerce / Portfolio
// Each has its own dedicated system prompt + phase steps

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { detectNiche } from "@/lib/rendering-engine/niche-detection";
import { applyDesignVariant, shuffleMiddleSections } from "@/lib/rendering-engine/design-variants";
import { getDesignLanguage } from "@/lib/rendering-engine/design-language";
import { architectBlueprint, type DomainBlueprint } from "@/lib/rendering-engine/domain-knowledge";
import {
  generateComponentContent, assembleFromComponentLibrary, buildGenericComponentContent,
} from "@/lib/rendering-engine/content-generation";
import { generateCSS, generateJS, combineOutput } from "@/lib/rendering-engine/output-generation";
import { cleanHTML } from "@/lib/rendering-engine/html-utils";
import { detectProjectType, getRealImageSet } from "@/lib/rendering-engine/generation-helpers";
import { kryptonGenerate } from "@/lib/ai-providers";
import { generationSeedFromId } from "@/lib/design-engine";

export const maxDuration = 120;
export const runtime     = "edge";

// ── AI Providers ─────────────────────────────────────────────────
// callClaude/callOpenAI/callGemini/generate()/cleanHTML/BASE_RULES/GENERATORS
// were removed — replaced by the shared rendering engine (same modules
// app/api/orchestrate/route.ts, app/api/generate/route.ts, and
// app/api/multipage/route.ts use). See imports above.


// ── Credit Cost ───────────────────────────────────────────────────
function creditCost(type: string): number {
  const costs: Record<string, number> = {
    website: 3, landing: 2, app: 3, game: 0, // removed
    dashboard: 4, tool: 2, ecommerce: 4, portfolio: 2,
  };
  return costs[type] ?? 3;
}

// ── 8 Specialized System Prompts ─────────────────────────────────


// ── Phase Steps Per Generator ────────────────────────────────────
const PHASES: Record<string, Array<{ icon: string; action: string }>> = {
  website:   [
    { icon: "🔍", action: "Analyzing your website requirements..." },
    { icon: "🧠", action: "Planning 11-section architecture..." },
    { icon: "🎨", action: "Designing premium UI system..." },
    { icon: "⚙️", action: "Building navbar & hero section..." },
    { icon: "📦", action: "Crafting features & showcase..." },
    { icon: "💬", action: "Adding testimonials & pricing..." },
    { icon: "📱", action: "Optimizing mobile responsiveness..." },
    { icon: "✨", action: "Applying animations & interactions..." },
    { icon: "🚀", action: "Finalizing CTAs & footer..." },
    { icon: "✅", action: "Website build complete!" },
  ],
  landing:   [
    { icon: "🔍", action: "Analyzing conversion goals..." },
    { icon: "🧠", action: "Planning persuasion architecture..." },
    { icon: "🎨", action: "Designing hero section..." },
    { icon: "⚙️", action: "Building problem/solution sections..." },
    { icon: "💎", action: "Crafting social proof & testimonials..." },
    { icon: "📱", action: "Optimizing for mobile conversions..." },
    { icon: "✨", action: "Adding micro-animations..." },
    { icon: "🚀", action: "Finalizing CTAs & copy..." },
    { icon: "✅", action: "Landing page complete!" },
  ],
  app:       [
    { icon: "🔍", action: "Analyzing app requirements..." },
    { icon: "🧠", action: "Designing component architecture..." },
    { icon: "⚙️", action: "Building app shell & navigation..." },
    { icon: "💾", action: "Implementing CRUD operations..." },
    { icon: "🔄", action: "Adding search, filter & sort..." },
    { icon: "📱", action: "Optimizing mobile layout..." },
    { icon: "✨", action: "Adding modals & notifications..." },
    { icon: "🧪", action: "Validating all interactions..." },
    { icon: "✅", action: "App build complete!" },
  ],
  game:      [
    { icon: "🎮", action: "Detecting game genre & mechanics..." },
    { icon: "🧠", action: "Designing game loop architecture..." },
    { icon: "🗺️", action: "Planning levels & progression..." },
    { icon: "⚙️", action: "Engineering core game engine..." },
    { icon: "🎯", action: "Building player controls & physics..." },
    { icon: "👾", action: "Creating enemies & obstacles..." },
    { icon: "🎨", action: "Designing HUD & game UI..." },
    { icon: "✨", action: "Adding particles & effects..." },
    { icon: "🔊", action: "Wiring audio & input events..." },
    { icon: "✅", action: "Game build complete!" },
  ],
  dashboard: [
    { icon: "🔍", action: "Analyzing dashboard requirements..." },
    { icon: "🧠", action: "Planning layout & data structure..." },
    { icon: "⚙️", action: "Building sidebar & navigation..." },
    { icon: "📊", action: "Creating KPI cards & metrics..." },
    { icon: "📈", action: "Integrating Chart.js visualizations..." },
    { icon: "📋", action: "Building data tables & sorting..." },
    { icon: "📱", action: "Optimizing responsive layout..." },
    { icon: "✨", action: "Adding animations & interactions..." },
    { icon: "✅", action: "Dashboard build complete!" },
  ],
  tool:      [
    { icon: "🔍", action: "Understanding tool requirements..." },
    { icon: "🧠", action: "Designing tool interface..." },
    { icon: "⚙️", action: "Building core tool functionality..." },
    { icon: "💾", action: "Adding history & export features..." },
    { icon: "📱", action: "Optimizing for mobile use..." },
    { icon: "✨", action: "Adding keyboard shortcuts & UX..." },
    { icon: "✅", action: "Tool build complete!" },
  ],
  ecommerce: [
    { icon: "🛍️", action: "Analyzing store requirements..." },
    { icon: "🧠", action: "Planning product architecture..." },
    { icon: "🎨", action: "Designing product cards & grid..." },
    { icon: "🛒", action: "Engineering cart & state system..." },
    { icon: "🔍", action: "Adding search, filter & sort..." },
    { icon: "💳", action: "Building checkout flow..." },
    { icon: "📱", action: "Optimizing mobile experience..." },
    { icon: "✨", action: "Adding hover effects & animations..." },
    { icon: "✅", action: "Store build complete!" },
  ],
  portfolio: [
    { icon: "💼", action: "Analyzing portfolio requirements..." },
    { icon: "🧠", action: "Planning personal brand architecture..." },
    { icon: "🎨", action: "Designing hero & about sections..." },
    { icon: "🖼️", action: "Building projects showcase..." },
    { icon: "⏱️", action: "Creating experience timeline..." },
    { icon: "📱", action: "Optimizing mobile layout..." },
    { icon: "✨", action: "Adding scroll animations & effects..." },
    { icon: "✅", action: "Portfolio build complete!" },
  ],
};

// ── Project Type Detector ─────────────────────────────────────────
const VALID_TYPES = ["website", "landing", "app", "dashboard", "tool", "ecommerce", "portfolio", "game"];
function detectType(prompt: string, requestedType?: string): string {
  if (requestedType && VALID_TYPES.includes(requestedType)) return requestedType;
  return detectProjectType(prompt);
}

// ── Main Handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}

  const { prompt, type: requestedType, userId, accessToken } = body;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Auth
  let uid = userId;
  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    uid = user?.id || userId;
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      try {
        // ── Credit Check ─────────────────────────────────────────
        if (uid) {
          const { data: pc } = await supabase.from("profiles")
            .select("total_credits, used_credits, plan, daily_reset_date")
            .eq("id", uid).single();

          if (pc) {
            const today = new Date().toISOString().split("T")[0];
            if (pc.plan === "free" && pc.daily_reset_date !== today) {
              await supabase.from("profiles").update({ used_credits: 0, daily_reset_date: today }).eq("id", uid);
              pc.used_credits = 0;
            }
            const rem = (pc.total_credits || 5) - (pc.used_credits || 0);
            if (rem < 1) {
              send("error", { message: "No credits remaining. Free plan resets daily.", code: "NO_CREDITS" });
              finish(); return;
            }
          }
        }

        // ── Detect Type ───────────────────────────────────────────
        const type = detectType(prompt, requestedType);
        const phases = PHASES[type] || PHASES.website;
        const cost = creditCost(type);

        send("meta", { type, cost });

        // ── Stream Phases ─────────────────────────────────────────
        for (let i = 0; i < phases.length - 1; i++) {
          send("phase", {
            agent: `Step ${i + 1}`,
            icon: phases[i].icon,
            action: phases[i].action,
            pct: Math.round(((i + 1) / phases.length) * 85),
            done: false,
          });
          await new Promise(r => setTimeout(r, 600));
        }

        // ── Generate — same unified Component-Library pipeline as
        // /api/orchestrate, /api/generate, /api/multipage. AI only ever
        // produces structured JSON content; real HTML always comes from
        // renderComponent(). Real crypto-random seed (never Math.random()).
        send("phase", { agent: "Generating", icon: "⚡", action: "AI is building your project...", pct: 90, done: false });

        const designSeed = generationSeedFromId(crypto.randomUUID());
        let niche = detectNiche(`${type} project: ${prompt}`);
        niche = applyDesignVariant(niche, designSeed);
        niche.sectionOrder = shuffleMiddleSections(niche.sectionOrder, designSeed);

        let domainPlan: DomainBlueprint | null = null;
        try { domainPlan = await architectBlueprint(prompt, type, niche, kryptonGenerate); } catch {}

        const dl = getDesignLanguage(niche);
        const pipelineBlueprint = domainPlan
          ? `SECTIONS: ${domainPlan.sectionOrder.join(", ")}\nKEY_COMPONENTS: ${Object.entries(domainPlan.sectionPurpose).map(([s,p])=>`${s} (${p})`).join("; ")}\nCONTENT_FOCUS: ${domainPlan.businessGoal} — ${domainPlan.tagline}. ${domainPlan.copyTone} Key benefits: ${domainPlan.keyBenefits.join(", ")}. Avoid: ${domainPlan.avoidMistakes.join(", ")}.`
          : "";

        let componentContent = await generateComponentContent(niche, pipelineBlueprint, prompt, type, domainPlan);
        if (!componentContent) {
          componentContent = await generateComponentContent(niche, pipelineBlueprint, prompt, type, domainPlan);
        }
        if (!componentContent) {
          componentContent = buildGenericComponentContent(niche);
        }

        const realImages = await getRealImageSet(niche.industry, niche.imageKeyword || type, 6).catch(() => [] as string[]);
        const sectionsHTML = await assembleFromComponentLibrary(niche, componentContent, realImages, designSeed);

        let html = "";
        const provider = "claude"; // same disclosed cosmetic limitation as orchestrate/generate

        if (sectionsHTML) {
          const generatedCSS = await generateCSS(niche, dl, sectionsHTML);
          const generatedJS  = await generateJS(sectionsHTML, type);
          html = cleanHTML(combineOutput(sectionsHTML, generatedCSS, generatedJS, niche, prompt.slice(0, 60)));
        }

        if (!html || html.length < 500) {
          send("error", { message: "Generation failed. Please try again.", code: "BAD_OUTPUT" });
          finish(); return;
        }

        // ── Deduct Credits ────────────────────────────────────────
        let savedProjectId: string | null = null;
        if (uid) {
          try {
            const { error: rpcError } = await supabase.rpc("deduct_credits", { user_id: uid, amount: cost });
            if (rpcError) {
              const { data: pc2 } = await supabase.from("profiles").select("used_credits").eq("id", uid).single();
              await supabase.from("profiles").update({ used_credits: (pc2?.used_credits || 0) + cost }).eq("id", uid);
            }
          } catch {
            const { data: pc2 } = await supabase.from("profiles").select("used_credits").eq("id", uid).single();
            await supabase.from("profiles").update({ used_credits: (pc2?.used_credits || 0) + cost }).eq("id", uid);
          }

          // Save project
          try {
            const { data: proj } = await supabase.from("projects").insert({
              user_id: uid,
              title: prompt.slice(0, 60),
              name: prompt.slice(0, 60),
              prompt,
              html_code: html,
              status: "completed",
              project_type: type,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).select("id").single();
            savedProjectId = proj?.id || null;
          } catch {}
        }

        // ── Final Phase ───────────────────────────────────────────
        const lastPhase = phases[phases.length - 1];
        send("phase", { agent: "Done", icon: lastPhase.icon, action: lastPhase.action, pct: 100, done: true });

        send("complete", {
          html,
          projectId: savedProjectId,
          creditsUsed: cost,
          provider,
          type,
          canSave: true,
        });

      } catch (err: any) {
        console.error("[generate-pro]", err);
        send("error", { message: "Something went wrong. Please try again.", code: "FATAL" });
      } finally {
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
