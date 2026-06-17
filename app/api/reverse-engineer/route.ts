// app/api/reverse-engineer/route.ts
// Krypton AI — Browser Intelligence Engine v4.0
// 3-Tier Architecture:
//   Tier 1 (FREE):        thum.io screenshot + GPT-4o Vision + HTML parse
//   Tier 2 ($19/mo):      ScreenshotOne API → better screenshots
//   Tier 3 ($49/mo):      Browserless.io → real Playwright, JS-rendered sites
//
// HONEST LIMITATIONS:
//   - Without Tier 3: Stripe/Linear/Apple/Framer = partial analysis only
//   - Playwright on Vercel directly: NOT POSSIBLE (170MB binary > 50MB limit)
//   - PDF support: YES (no extra package needed — ArrayBuffer parsing)
//   - ZIP support: YES (jszip already in package.json)

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime    = "nodejs";
export const maxDuration = 55;

// ── Service availability detection ───────────────────────────────
const SERVICES = {
  // Tier 3: Browserless.io for real Playwright
  // Add BROWSERLESS_API_KEY to Vercel env to enable
  browserless: !!process.env.BROWSERLESS_API_KEY,
  // Tier 2: ScreenshotOne for high-quality screenshots
  // Add SCREENSHOTONE_KEY to Vercel env to enable
  screenshotOne: !!process.env.SCREENSHOTONE_KEY,
  // Always available
  openai:    !!process.env.OPENAI_API_KEY,
  anthropic: !!process.env.ANTHROPIC_API_KEY,
};

// ── JS-rendered sites (need Tier 3 for full analysis) ────────────
const JS_HEAVY = new Set([
  "stripe.com","linear.app","framer.com","notion.so",
  "vercel.com","figma.com","loom.com","webflow.com",
  "apple.com","shopify.com","retool.com",
]);

// ══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════
export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await req.json().catch(() => ({}));
  const { url, accessToken, depth = "standard", assetType = "url" } = body;
  // assetType: "url" | "pdf_base64" | "zip_base64" | "image_base64"

  // Auth
  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Route to correct analyzer ─────────────────────────────────
  try {
    let result: any;

    if (assetType === "pdf_base64") {
      result = await analyzePDF(body.data, body.filename || "document.pdf");
    } else if (assetType === "zip_base64") {
      result = await analyzeZIP(body.data, body.filename || "archive.zip");
    } else if (assetType === "image_base64") {
      result = await analyzeImage(body.data, body.mediaType || "image/png");
    } else {
      // URL analysis (main path)
      if (!url?.trim()) return NextResponse.json({ error: "URL required" }, { status: 400 });
      let normalizedUrl = url.trim();
      if (!normalizedUrl.startsWith("http")) normalizedUrl = "https://" + normalizedUrl;
      let domain = "";
      try { domain = new URL(normalizedUrl).hostname.replace("www.",""); }
      catch { return NextResponse.json({ error: "Invalid URL" }, { status: 400 }); }

      // Cache check
      const { data: cached } = await supabase
        .from("extracted_blueprints").select("*")
        .eq("url", normalizedUrl)
        .not("fetch_status","in","(error,processing)")
        .single();
      if (cached) return NextResponse.json({ status:"cached", blueprint:cached, cached:true });

      result = await analyzeURL(normalizedUrl, domain, depth, supabase);
    }

    return NextResponse.json({ status:"complete", blueprint:result, cached:false });
  } catch (err: any) {
    console.error("[browser-intelligence]", err.message);
    return NextResponse.json({ status:"error", error:err.message }, { status:500 });
  }
}

// ══════════════════════════════════════════════════════════════════
// URL ANALYSIS ENGINE — 3-tier fallback
// ══════════════════════════════════════════════════════════════════
async function analyzeURL(url: string, domain: string, depth: string, supabase: any) {
  const isJSHeavy = JS_HEAVY.has(domain) || JS_HEAVY.has(domain.split(".").slice(-2).join("."));
  let html = "";
  let screenshotBase64 = "";
  let analysisMethod = "html_only";

  // ── TIER 3: Browserless.io (real Playwright, JS sites work) ──
  if (SERVICES.browserless && (isJSHeavy || depth === "full")) {
    try {
      const result = await browserlessAnalysis(url);
      html             = result.html;
      screenshotBase64 = result.screenshotBase64;
      analysisMethod   = "playwright_browserless";
    } catch (e: any) {
      console.warn("[tier3] Browserless failed:", e.message, "→ falling back");
    }
  }

  // ── TIER 2: ScreenshotOne API (better screenshots) ────────────
  const screenshotUrl = SERVICES.screenshotOne
    ? getScreenshotOneUrl(url)
    : `https://image.thum.io/get/width/1280/crop/900/noanimate/${encodeURIComponent(url)}`;

  // Fetch screenshot as base64 for Vision API (only if we have AI credits)
  if (!screenshotBase64 && SERVICES.openai) {
    try {
      screenshotBase64 = await fetchScreenshotAsBase64(screenshotUrl);
      analysisMethod = analysisMethod === "html_only" ? "screenshot_vision" : analysisMethod;
    } catch (e) {
      console.warn("[screenshot] fetch failed, continuing without vision");
    }
  }

  // ── TIER 1: HTML fetch (always try for non-JS-heavy sites) ────
  if (!html && !isJSHeavy) {
    const pages = depth === "quick" ? ["/"] : ["/", "/pricing", "/features"];
    const results = await Promise.allSettled(pages.map(p => fetchPageSafe(new URL(url).origin + p)));
    const htmlPages = results.filter(r=>r.status==="fulfilled").map(r=>(r as any).value as string).filter(h=>h.length>500);
    html = htmlPages.join("\n<!-- PAGE -->\n");
    if (html.length > 500) analysisMethod = analysisMethod==="screenshot_vision" ? "html_and_vision" : "html_only";
  }

  // ── Extract structure from HTML ───────────────────────────────
  const structure   = extractStructure(html, domain);
  const components  = extractComponents(html);
  const cssContent  = extractCSS(html);
  const design      = analyzeDesignProfile(html, cssContent);

  // ── GPT-4o Vision analysis ────────────────────────────────────
  let visionDNA: VisionDNA | null = null;
  if (screenshotBase64 && SERVICES.openai) {
    visionDNA = await runVisionAnalysis(screenshotBase64, domain, structure);
  } else if (SERVICES.openai && html.length > 200) {
    visionDNA = await runTextAnalysis(html, domain, structure);
  }

  // ── Build Competitor DNA ──────────────────────────────────────
  const dna   = buildCompetitorDNA(structure, design, components, visionDNA);
  const score = scoreBlueprint(structure, design, components, analysisMethod);

  const blueprint: any = {
    url, domain,
    title:         structure.title,
    description:   structure.description,
    industry:      visionDNA?.industry || structure.industry,
    hero_pattern:  structure.heroPattern,
    section_order: structure.sectionOrder,
    nav_items:     structure.navItems,
    cta_primary:   structure.ctaPrimary,
    cta_secondary: structure.ctaSecondary,
    cta_pattern:   structure.ctaPattern,
    trust_pattern: structure.trustPattern,
    fetch_status:  html.length > 500 ? "success" : (isJSHeavy ? "js_rendered" : "partial"),
    fetch_method:  analysisMethod,
    raw_headings:  structure.headings.slice(0,8),
    design_profile: {
      ...design,
      screenshotUrl,
      screenshotCaptured: !!screenshotBase64,
      colorPalette:    visionDNA?.colorPalette   || [],
      typographyScale: visionDNA?.typographyScale || design.typographyHint,
      spacingSystem:   visionDNA?.spacingSystem   || design.densityLabel,
      cardStyle:       visionDNA?.cardStyle       || design.cardStyle,
      buttonStyle:     visionDNA?.buttonStyle     || "rounded",
      visualSummary:   visionDNA?.visualSummary   || null,
    },
    components,
    competitor_dna: dna,
    quality_score:  score,
    analysis_meta: {
      tier:            SERVICES.browserless ? 3 : SERVICES.screenshotOne ? 2 : 1,
      method:          analysisMethod,
      isJSHeavy,
      screenshotUrl,
      visionUsed:      !!visionDNA,
      servicesActive:  Object.entries(SERVICES).filter(([,v])=>v).map(([k])=>k),
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await supabase.from("extracted_blueprints").upsert(blueprint, { onConflict:"url" });
  return blueprint;
}

// ══════════════════════════════════════════════════════════════════
// TIER 3: BROWSERLESS.IO INTEGRATION
// Real Playwright rendering — handles Stripe, Linear, Apple etc.
// Add BROWSERLESS_API_KEY to Vercel env to enable.
// Plans: $49/mo for 2000 minutes/month
// https://browserless.io
// ══════════════════════════════════════════════════════════════════
async function browserlessAnalysis(url: string): Promise<{html:string; screenshotBase64:string}> {
  const wsUrl = `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_API_KEY}`;

  // Browserless REST API (simpler than WebSocket, works in Node.js)
  const [htmlRes, screenshotRes] = await Promise.allSettled([
    // Get rendered HTML
    fetch(`https://chrome.browserless.io/content?token=${process.env.BROWSERLESS_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        waitFor: 3000,         // wait 3s for JS hydration
        gotoOptions: { waitUntil: "networkidle0", timeout: 20000 },
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120",
        viewport: { width: 1440, height: 900 },
      }),
      signal: AbortSignal.timeout(25000),
    }),
    // Get screenshot
    fetch(`https://chrome.browserless.io/screenshot?token=${process.env.BROWSERLESS_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url,
        waitFor: 2000,
        options: { type: "png", fullPage: false }, // don't fullPage — too large
        gotoOptions: { waitUntil: "networkidle0", timeout: 20000 },
        viewport: { width: 1440, height: 900 },
      }),
      signal: AbortSignal.timeout(25000),
    }),
  ]);

  let html = "";
  let screenshotBase64 = "";

  if (htmlRes.status === "fulfilled" && htmlRes.value.ok) {
    html = await htmlRes.value.text();
  }
  if (screenshotRes.status === "fulfilled" && screenshotRes.value.ok) {
    const buffer = await screenshotRes.value.arrayBuffer();
    screenshotBase64 = Buffer.from(buffer).toString("base64");
  }

  if (!html && !screenshotBase64) throw new Error("Browserless returned empty results");
  return { html, screenshotBase64 };
}

// ══════════════════════════════════════════════════════════════════
// SCREENSHOT SERVICES
// ══════════════════════════════════════════════════════════════════
function getScreenshotOneUrl(url: string): string {
  // ScreenshotOne API: https://screenshotone.com ($19/mo, reliable)
  const key = process.env.SCREENSHOTONE_KEY;
  return `https://api.screenshotone.com/take?access_key=${key}&url=${encodeURIComponent(url)}&viewport_width=1440&viewport_height=900&format=png&image_quality=80&full_page=false`;
}

async function fetchScreenshotAsBase64(screenshotUrl: string): Promise<string> {
  const res = await fetch(screenshotUrl, {
    signal: AbortSignal.timeout(10000),
    headers: { "Accept": "image/*" },
  });
  if (!res.ok) throw new Error(`Screenshot ${res.status}`);
  const ct = res.headers.get("content-type") || "image/png";
  if (!ct.startsWith("image/")) throw new Error("Not an image response");
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

// ══════════════════════════════════════════════════════════════════
// PHASE 2: GPT-4o VISION ANALYSIS
// ══════════════════════════════════════════════════════════════════
interface VisionDNA {
  industry: string; designLanguage: string; colorPalette: string[];
  typographyScale: string; spacingSystem: string; visualDensity: string;
  layoutHierarchy: string; heroType: string; ctaPlacement: string;
  trustElements: string[]; conversionStrategy: string; trustStrategy: string;
  ctaStrategy: string; brandPositioning: string; visualSummary: string;
  cardPatterns: string; buttonStyle: string; cardStyle: string;
  designScore: number; conversionScore: number; trustScore: number;
  uxScore: number; mobileScore: number; overallScore: number;
  recommendations: string[];
}

async function runVisionAnalysis(base64: string, domain: string, structure: any): Promise<VisionDNA> {
  const prompt = `You are a senior UX/CRO analyst. Analyze this website screenshot.
Domain: ${domain} | Sections detected: ${structure.sectionOrder.join(", ")}

Return ONLY valid JSON — no markdown, no explanation:
{
  "industry":"SaaS",
  "designLanguage":"Stripe Modern",
  "colorPalette":["#6366f1","#111827","#f8fafc"],
  "typographyScale":"editorial",
  "spacingSystem":"generous",
  "visualDensity":"balanced",
  "layoutHierarchy":"describe the visual hierarchy you see",
  "heroType":"split|center|full-bleed|editorial|product|dashboard",
  "ctaPlacement":"above-fold|mid-page|multiple",
  "trustElements":["logo bar","testimonials","security badges"],
  "conversionStrategy":"one sentence describing how this converts",
  "trustStrategy":"one sentence describing trust building",
  "ctaStrategy":"one sentence on CTA approach",
  "brandPositioning":"luxury|premium|professional|friendly|innovative|corporate",
  "visualSummary":"two sentences describing the overall visual design",
  "cardPatterns":"elevated|outlined|flat|glass",
  "buttonStyle":"pill|rounded|square|ghost|gradient",
  "cardStyle":"elevated|outlined|flat|glass",
  "designScore":85,
  "conversionScore":80,
  "trustScore":75,
  "uxScore":85,
  "mobileScore":80,
  "overallScore":81,
  "recommendations":["specific improvement 1","specific improvement 2","specific improvement 3"]
}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type":"application/json", "Authorization":`Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 800,
      temperature: 0,
      messages: [{
        role: "user",
        content: [
          { type:"image_url", image_url:{ url:`data:image/png;base64,${base64}`, detail:"high" } },
          { type:"text", text:prompt },
        ],
      }],
    }),
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) throw new Error(`GPT-4o Vision ${res.status}: ${await res.text()}`);
  const d = await res.json();
  const text = d.choices?.[0]?.message?.content || "{}";
  return JSON.parse(text.replace(/```json|```/g,"").trim()) as VisionDNA;
}

// Text-only analysis fallback (when no screenshot available)
async function runTextAnalysis(html: string, domain: string, structure: any): Promise<VisionDNA> {
  const stripped = html.replace(/<script[\s\S]*?<\/script>/gi,"")
    .replace(/<style[\s\S]*?<\/style>/gi,"")
    .replace(/<[^>]+>/g," ").replace(/\s{2,}/g," ").slice(0,2500);

  const prompt = `Analyze website structure. Domain: ${domain}
Sections: ${structure.sectionOrder.join(",")} | CTA: "${structure.ctaPrimary}"
Text content sample: ${stripped.slice(0,1000)}
Return ONLY valid JSON (same schema as before — no screenshot available, infer from structure):
{"industry":"","designLanguage":"Linear Creative","colorPalette":["#6366f1","#111827"],"typographyScale":"balanced","spacingSystem":"standard","visualDensity":"balanced","layoutHierarchy":"inferred from HTML","heroType":"center","ctaPlacement":"above-fold","trustElements":[],"conversionStrategy":"","trustStrategy":"","ctaStrategy":"","brandPositioning":"professional","visualSummary":"","cardPatterns":"elevated","buttonStyle":"rounded","cardStyle":"elevated","designScore":60,"conversionScore":60,"trustScore":50,"uxScore":65,"mobileScore":70,"overallScore":61,"recommendations":["add screenshots for better analysis"]}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.OPENAI_API_KEY}`},
    body: JSON.stringify({ model:"gpt-4o-mini", max_tokens:600, temperature:0, messages:[{role:"user",content:prompt}] }),
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`GPT-4o-mini ${res.status}`);
  const d = await res.json();
  return JSON.parse(d.choices?.[0]?.message?.content?.replace(/```json|```/g,"").trim()||"{}") as VisionDNA;
}

// ══════════════════════════════════════════════════════════════════
// PHASE 3 + 4: PDF ANALYSIS
// No extra package needed — uses native ArrayBuffer parsing
// ══════════════════════════════════════════════════════════════════
async function analyzePDF(base64Data: string, filename: string): Promise<any> {
  if (!base64Data) throw new Error("PDF data required");
  if (!SERVICES.openai && !SERVICES.anthropic) throw new Error("AI service required for PDF analysis");

  // Send PDF to GPT-4o for structural analysis
  // Note: OpenAI doesn't support PDF natively, so we use Claude if available
  // Claude supports PDF via document block
  if (SERVICES.anthropic) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json","x-api-key":process.env.ANTHROPIC_API_KEY!,"anthropic-version":"2023-06-01"},
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        messages:[{
          role:"user",
          content:[
            { type:"document", source:{ type:"base64", media_type:"application/pdf", data:base64Data } },
            { type:"text", text:`Analyze this PDF document's STRUCTURE only (not content for copyright reasons).

Return ONLY valid JSON:
{
  "documentType": "landing page|pitch deck|case study|report|portfolio|other",
  "pageCount": "estimated pages",
  "layoutStyle": "single-column|multi-column|magazine|minimal|dense",
  "designLanguage": "corporate|creative|minimal|editorial|modern",
  "colorTheme": "dark|light|colorful|monochrome",
  "typographyStyle": "serif|sans-serif|mixed",
  "hasImages": true,
  "hasTables": false,
  "hasCharts": false,
  "sections": ["cover","executive summary","problem","solution","pricing","contact"],
  "conversionGoal": "lead generation|information|sales|portfolio",
  "brandPositioning": "luxury|professional|friendly|innovative",
  "designScore": 75,
  "recommendations": ["recommendation 1", "recommendation 2"]
}` },
          ],
        }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`Claude PDF ${res.status}`);
    const d = await res.json();
    const text = d.content?.[0]?.text || "{}";
    const analysis = JSON.parse(text.replace(/```json|```/g,"").trim());
    return {
      assetType: "pdf",
      filename,
      analysis,
      competitor_dna: buildPDFDNA(analysis),
      quality_score: { overall: analysis.designScore || 70, method: "claude_vision_pdf" },
    };
  }

  throw new Error("Claude API required for PDF analysis. Add ANTHROPIC_API_KEY.");
}

function buildPDFDNA(analysis: any) {
  return {
    designLanguage:      analysis.designLanguage,
    brandPositioning:    analysis.brandPositioning,
    layoutStyle:         analysis.layoutStyle,
    sections:            analysis.sections,
    conversionGoal:      analysis.conversionGoal,
    reusableBlueprintPrompt: `PDF BLUEPRINT: ${analysis.documentType} with ${analysis.layoutStyle} layout.
Design: ${analysis.designLanguage} | Brand: ${analysis.brandPositioning} | Theme: ${analysis.colorTheme}
Section order: ${(analysis.sections||[]).join(" → ")}
Typography: ${analysis.typographyStyle} | Goal: ${analysis.conversionGoal}`,
  };
}

// ══════════════════════════════════════════════════════════════════
// PHASE 4: ZIP / SOURCE CODE ANALYSIS
// jszip already in package.json — no new dependency
// ══════════════════════════════════════════════════════════════════
async function analyzeZIP(base64Data: string, filename: string): Promise<any> {
  // Dynamic import of jszip (already in package.json)
  const JSZip = (await import("jszip")).default;
  const buffer = Buffer.from(base64Data, "base64");
  const zip = await JSZip.loadAsync(buffer);

  const fileTree: string[] = [];
  const cssFiles:  string[] = [];
  const jsFiles:   string[] = [];
  const components: string[] = [];
  let colorTokens:  string[] = [];
  let fontTokens:   string[] = [];
  let designTokens  = "";

  // Analyze file structure
  zip.forEach((path) => fileTree.push(path));

  // Extract CSS/Tailwind/design tokens
  const cssPromises = Object.keys(zip.files)
    .filter(f => /\.(css|scss|sass|less)$/i.test(f) || f.includes("tailwind") || f.includes("tokens"))
    .slice(0, 5)
    .map(async f => {
      const content = await zip.files[f].async("string");
      cssFiles.push(f);
      return content.slice(0, 3000);
    });

  const cssContents = await Promise.all(cssPromises);

  // Extract component files
  Object.keys(zip.files)
    .filter(f => /\.(tsx|jsx|vue|svelte)$/i.test(f))
    .slice(0, 20)
    .forEach(f => components.push(f));

  // Detect design tokens from CSS content
  const allCSS = cssContents.join("\n");
  const hexColors = [...new Set((allCSS.match(/#[0-9a-fA-F]{6}/g)||[]).slice(0,8))];
  colorTokens = hexColors;

  const fontMatches = allCSS.match(/font-family:\s*['"]?([^,;'"]+)/gi)||[];
  fontTokens = [...new Set(fontMatches.map(f=>f.replace(/font-family:\s*['"]?/i,"").split(",")[0].trim().slice(0,30)))].slice(0,3);

  // Check for Tailwind
  const hasTailwind = fileTree.some(f => f.includes("tailwind")) ||
    Object.keys(zip.files).some(f => f.includes("tailwind.config"));

  // Detect framework
  const hasNext    = fileTree.some(f => f.includes("next.config"));
  const hasReact   = fileTree.some(f => f.endsWith(".tsx") || f.endsWith(".jsx"));
  const hasVue     = fileTree.some(f => f.endsWith(".vue"));
  const hasSvelte  = fileTree.some(f => f.endsWith(".svelte"));
  const framework  = hasNext ? "Next.js" : hasReact ? "React" : hasVue ? "Vue" : hasSvelte ? "Svelte" : "HTML/CSS";

  // Read package.json if exists
  let dependencies: string[] = [];
  if (zip.files["package.json"]) {
    try {
      const pkg = JSON.parse(await zip.files["package.json"].async("string"));
      dependencies = Object.keys({...pkg.dependencies, ...pkg.devDependencies}).slice(0, 20);
    } catch {}
  }

  const dna = {
    framework,
    colorSystem:      colorTokens,
    typography:       fontTokens,
    hasTailwind,
    componentCount:   components.length,
    cssFileCount:     cssFiles.length,
    totalFiles:       fileTree.length,
    dependencies:     dependencies.slice(0, 10),
    designTokens:     colorTokens.length > 0 ? `Colors: ${colorTokens.join(",")}` : "No tokens found",
    reusableBlueprintPrompt: `SOURCE CODE BLUEPRINT: ${framework} project
Files: ${fileTree.length} total | Components: ${components.length}
CSS: ${cssFiles.join(",")||"none"} | Tailwind: ${hasTailwind}
Color tokens: ${colorTokens.join(",")||"none"} | Fonts: ${fontTokens.join(",")||"none"}
Dependencies: ${dependencies.slice(0,5).join(",")}`,
  };

  return {
    assetType: "zip",
    filename,
    fileTree: fileTree.slice(0, 50),
    cssFiles, components, colorTokens, fontTokens,
    competitor_dna: dna,
    quality_score: { overall: 70, method: "zip_analysis" },
  };
}

// ══════════════════════════════════════════════════════════════════
// PHASE 4: IMAGE ANALYSIS
// ══════════════════════════════════════════════════════════════════
async function analyzeImage(base64Data: string, mediaType: string): Promise<any> {
  if (!SERVICES.openai && !SERVICES.anthropic) throw new Error("AI service required");

  const visionDNA = await runVisionAnalysis(base64Data, "uploaded-image", {
    sectionOrder: [], ctaPrimary: "", headings: [],
  });

  return {
    assetType: "image",
    visionDNA,
    competitor_dna: {
      designLanguage:          visionDNA.designLanguage,
      brandPositioning:        visionDNA.brandPositioning,
      conversionStrategy:      visionDNA.conversionStrategy,
      trustStrategy:           visionDNA.trustStrategy,
      ctaStrategy:             visionDNA.ctaStrategy,
      reusableBlueprintPrompt: `IMAGE BLUEPRINT:
Design Language: ${visionDNA.designLanguage} | Brand: ${visionDNA.brandPositioning}
Hero: ${visionDNA.heroType} | CTA placement: ${visionDNA.ctaPlacement}
Visual: ${visionDNA.visualSummary}
Colors: ${visionDNA.colorPalette.join(",")}
Conversion: ${visionDNA.conversionStrategy}`,
    },
    quality_score: {
      design:     visionDNA.designScore,
      conversion: visionDNA.conversionScore,
      trust:      visionDNA.trustScore,
      ux:         visionDNA.uxScore,
      mobile:     visionDNA.mobileScore,
      overall:    visionDNA.overallScore,
      method:     "vision_analysis",
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// COMPETITOR DNA BUILDER
// ══════════════════════════════════════════════════════════════════
function buildCompetitorDNA(structure: any, design: any, components: any, vision: VisionDNA|null) {
  const dl = vision?.designLanguage || (
    design.hasGlass ? "Apple Clean" :
    design.hasGradients && design.theme==="dark" ? "Stripe Modern" :
    design.borderRadius==="none" ? "Editorial Luxury" :
    design.density==="compact" ? "Nike Bold" : "Linear Creative"
  );

  return {
    designLanguage:      dl,
    typographySystem:    vision?.typographyScale  || design.typographyHint,
    spacingSystem:       vision?.spacingSystem    || design.densityLabel,
    colorSystem:         vision?.colorPalette     || [design.primaryColor],
    conversionStrategy:  vision?.conversionStrategy || `${structure.ctaPattern} CTA approach`,
    trustStrategy:       vision?.trustStrategy    || structure.trustPattern,
    ctaStrategy:         vision?.ctaStrategy      || `"${structure.ctaPrimary}" — ${structure.ctaPattern}`,
    contentStructure:    structure.sectionOrder,
    sectionHierarchy:    structure.sectionOrder,
    brandPositioning:    vision?.brandPositioning || "professional",
    heroPattern:         vision?.heroType         || structure.heroPattern,
    cardPatterns:        vision?.cardPatterns     || design.cardStyle,
    trustElements:       vision?.trustElements    || [structure.trustPattern],
    reusableBlueprintPrompt: [
      `COMPETITOR DNA — ${structure.industry || "Business"}:`,
      `Design: ${dl} | Brand: ${vision?.brandPositioning||"professional"}`,
      `Theme: ${design.theme} | Density: ${design.density} | Cards: ${design.cardStyle}`,
      `Sections: ${structure.sectionOrder.slice(0,8).join(" → ")}`,
      `Hero: ${vision?.heroType||structure.heroPattern} | CTA: ${structure.ctaPattern}`,
      `Trust: ${(vision?.trustElements||[structure.trustPattern]).slice(0,3).join(", ")}`,
      vision ? `Vision insight: ${vision.conversionStrategy}` : "",
      vision ? `Recommendations: ${vision.recommendations?.slice(0,2).join(" | ")}` : "",
    ].filter(Boolean).join("\n"),
  };
}

// ══════════════════════════════════════════════════════════════════
// QUALITY SCORE
// ══════════════════════════════════════════════════════════════════
function scoreBlueprint(structure: any, design: any, components: any, method: string) {
  let d=0, c=0, t=0, u=0;
  if (design.hasGradients)  d+=4;
  if (design.hasAnimations)  d+=4;
  if (design.hasGlass)       d+=4;
  if (design.theme==="dark") d+=4;
  if (design.borderRadius!=="none") d+=4;

  if (components.hero?.hasImage) c+=6;
  if (components.pricing?.detected) c+=5;
  if (structure.ctaPattern!=="minimal") c+=5;
  if (structure.sectionOrder.includes("cta")) c+=4;

  if (components.testimonials?.detected) t+=7;
  if (structure.sectionOrder.includes("social-proof")) t+=6;

  if (components.navbar?.detected) u+=5;
  if (components.faq?.detected) u+=4;
  if (structure.sectionOrder.length>=5) u+=4;
  if (components.footer?.detected) u+=3;

  // Bonus for better analysis methods
  const methodBonus = method==="playwright_browserless" ? 15 : method.includes("vision") ? 10 : method.includes("html") ? 5 : 0;

  return {
    design: Math.min(20,d), conversion: Math.min(20,c),
    trust: Math.min(20,t), ux: Math.min(20,u), mobile: 10,
    method_bonus: methodBonus,
    overall: Math.min(100, d+c+t+u+10+methodBonus),
    analysisMethod: method,
    tier: method==="playwright_browserless" ? 3 : method.includes("vision") ? 2 : 1,
  };
}

// ══════════════════════════════════════════════════════════════════
// HTML UTILITIES (reused from v3)
// ══════════════════════════════════════════════════════════════════
function extractStructure(html: string, domain: string) {
  const title = html.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.trim() || domain;
  const desc  = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']{1,160})["']/i)?.[1]?.trim() || "";
  const headings: string[] = [];
  let m; const hre = /<h([1-3])[^>]*>([^<]{3,60})<\/h[1-3]>/gi;
  while ((m=hre.exec(html))!==null && headings.length<10) { const t=m[2].replace(/<[^>]+>/g,"").trim(); if(t.length>2) headings.push(`H${m[1]}: ${t.slice(0,55)}`); }
  const navItems: string[] = [];
  const navHtml = html.match(/<nav[^>]*>([\s\S]{0,3000}?)<\/nav>/i)?.[1]||"";
  const lre = /<a[^>]*>([^<]{2,25})<\/a>/gi;
  while ((m=lre.exec(navHtml))!==null && navItems.length<8) { const t=m[1].trim(); if(t.length>1) navItems.push(t); }
  const ctaBtns: string[] = [];
  const bre = /<(?:button|a)[^>]*>([^<]{3,35})<\/(?:button|a)>/gi;
  while ((m=bre.exec(html))!==null && ctaBtns.length<6) { const t=m[1].replace(/<[^>]+>/g,"").trim(); if(/get|start|try|join|sign|free|now|buy|book/i.test(t)) ctaBtns.push(t.slice(0,40)); }
  const sectionOrder = detectSectionOrder(html);
  return { title, description:desc, headings, navItems, ctaPrimary:ctaBtns[0]||"Get Started", ctaSecondary:ctaBtns[1]||"Learn More", ctaPattern:ctaBtns.length>=4?"aggressive":ctaBtns.length>=2?"balanced":"minimal", heroPattern:detectHeroPattern(html), trustPattern:detectTrustPattern(sectionOrder), sectionOrder, industry:detectIndustry(domain,headings,title), hasNav:/<nav/i.test(html), hasFooter:/<footer/i.test(html) };
}

function extractComponents(html: string) {
  if (!html) return { navbar:{detected:false,pattern:"unknown",hasCTA:false}, hero:{detected:false,pattern:"center",hasImage:false}, features:{detected:false,count:0}, testimonials:{detected:false,count:0}, pricing:{detected:false,count:0}, faq:{detected:false,count:0}, footer:{detected:false,hasNewsletter:false}, cta_section:{detected:false} };
  const h=html.toLowerCase();
  return { navbar:{detected:/<nav[\s>]/i.test(html),pattern:/sticky|fixed/.test(h)?"sticky":"static",hasCTA:/<nav[\s\S]{0,600}?(?:btn|sign.?up|get.?start)/i.test(html)}, hero:{detected:/hero|jumbotron|banner/i.test(html),pattern:detectHeroPattern(html),hasImage:/<img|video|picture/i.test(html.slice(0,html.length*0.25))}, features:{detected:/feature|benefit|solution/i.test(html),count:(html.match(/feature[-_](?:card|item)/gi)||[]).length}, testimonials:{detected:/testimonial|review|quote/i.test(html),count:(html.match(/testimonial[-_]card/gi)||[]).length}, pricing:{detected:/pricing|price|plan/i.test(html),count:(html.match(/pricing[-_]card/gi)||[]).length}, faq:{detected:/faq|accordion/i.test(html),count:(html.match(/accordion[-_]item/gi)||[]).length}, footer:{detected:/<footer/i.test(html),hasNewsletter:/<footer[\s\S]{0,500}?(?:newsletter|subscribe)/i.test(html)}, cta_section:{detected:/get.?start.?(?:ed|now)|sign.?up.?free/i.test(html)} };
}

function analyzeDesignProfile(html: string, css: string) {
  if (!html&&!css) return {theme:"dark",primaryColor:"#6366f1",borderRadius:"medium",cardStyle:"elevated",density:"balanced",densityLabel:"balanced",typographyHint:"system-ui",hasAnimations:false,hasGradients:false,hasGlass:false};
  const combined=(html+css).toLowerCase();
  const darkCount=(combined.match(/background(?:-color)?:\s*#[012]/gi)||[]).length;
  const theme=darkCount>2?"dark":"light";
  const hexes=combined.match(/#[0-9a-f]{6}/gi)||[];
  const freq:Record<string,number>={};
  hexes.forEach(h=>{if(!["#ffffff","#000000","#111111","#f0f0f0"].includes(h))freq[h]=(freq[h]||0)+1;});
  const primaryColor=Object.entries(freq).sort((a,b)=>b[1]-a[1])[0]?.[0]||"#6366f1";
  const radii=(combined.match(/border-radius:\s*(\d+)px/gi)||[]).map(r=>parseInt(r.replace(/\D/g,"")));
  const avg=radii.length?radii.reduce((a,b)=>a+b,0)/radii.length:8;
  const borderRadius=avg===0?"none":avg<4?"small":avg<12?"medium":avg<24?"large":"pill";
  const hasGlass=/backdrop-filter/.test(combined);
  const hasShadow=/box-shadow/.test(combined);
  const hasBorder=/border:\s*\d+px\s+solid/.test(combined);
  const cardStyle=hasGlass?"glass":hasShadow?"elevated":hasBorder?"outlined":"flat";
  const pads=(combined.match(/padding:\s*(\d+)px/gi)||[]).map(p=>parseInt(p.replace(/\D/g,"")));
  const avgPad=pads.length?pads.reduce((a,b)=>a+b,0)/pads.length:24;
  const density=avgPad>40?"spacious":avgPad>20?"balanced":"compact";
  const fontMatch=combined.match(/font-family:\s*['"]?([^,;'"<]{3,40})/i);
  return {theme,primaryColor,borderRadius,cardStyle,density,densityLabel:density,typographyHint:fontMatch?.[1]?.trim().slice(0,30)||"system-ui",hasAnimations:/animation:|@keyframes/.test(combined),hasGradients:/linear-gradient|radial-gradient/.test(combined),hasGlass};
}

function extractCSS(html: string): string {
  const blocks:string[]=[]; let m;
  const re=/<style[^>]*>([\s\S]*?)<\/style>/gi;
  while((m=re.exec(html))!==null) blocks.push(m[1]);
  return blocks.join("\n").slice(0,8000);
}

function detectSectionOrder(html: string): string[] {
  const checks:[RegExp,string][]=[
    [/hero|banner|jumbotron/i,"hero"],[/trusted.by|partner|logo.bar/i,"social-proof"],
    [/feature|benefit|capability/i,"features"],[/product.*demo|screenshot/i,"product-demo"],
    [/how.it.works|our.process/i,"how-it-works"],[/case.stud|success.stor/i,"case-studies"],
    [/testimonial|customer.say/i,"testimonials"],[/integrat|ecosystem/i,"integrations"],
    [/price|plan|tier/i,"pricing"],[/faq|frequently.asked/i,"faq"],
    [/about.us|our.team/i,"about"],[/contact.us|reach.us/i,"contact"],
    [/get.started.now|sign.up.free/i,"cta"],[/<footer/i,"footer"],
  ];
  const found:{label:string;pos:number}[]=[]; const h=html.toLowerCase();
  for(const [re,label] of checks){const idx=h.search(re);if(idx>-1)found.push({label,pos:idx});}
  found.sort((a,b)=>a.pos-b.pos);
  const order=[...new Set(found.map(f=>f.label))];
  if(!order.includes("hero"))order.unshift("hero");
  return order;
}

function detectHeroPattern(html: string): string {
  const h=html.toLowerCase().slice(0,Math.min(html.length*0.3,10000));
  if(/grid.*(?:hero|banner)|split.*hero/i.test(h)) return "split";
  if(/product.*hero|mockup/i.test(h)) return "product";
  if(/full.*bleed|bg-cover/i.test(h)) return "full-bleed";
  if(/dashboard|app.*preview/i.test(h)) return "dashboard";
  return "center";
}

function detectTrustPattern(sections: string[]): string {
  const t=[];
  if(sections.includes("social-proof")) t.push("logo-bar");
  if(sections.includes("testimonials")) t.push("testimonials");
  if(sections.includes("case-studies")) t.push("case-studies");
  return t.join(" + ")||"reviews";
}

function detectIndustry(domain: string, headings: string[], title: string): string {
  const t=(domain+title+headings.join(" ")).toLowerCase();
  if(/saas|software|platform|api/.test(t)) return "SaaS";
  if(/restaurant|food|cafe|dining/.test(t)) return "Food & Dining";
  if(/fitness|gym|workout/.test(t)) return "Fitness";
  if(/finance|invest|crypto/.test(t)) return "Finance";
  if(/agency|marketing|creative/.test(t)) return "Agency";
  if(/shop|ecommerce|store/.test(t)) return "E-Commerce";
  if(/education|course|learn/.test(t)) return "Education";
  if(/travel|hotel|tour/.test(t)) return "Travel";
  return "Business";
}

async function fetchPageSafe(url: string): Promise<string> {
  try {
    const res=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 Chrome/120","Accept":"text/html"},signal:AbortSignal.timeout(8000),redirect:"follow"});
    if(!res.ok) return "";
    const ct=res.headers.get("content-type")||"";
    if(!ct.includes("text/html")) return "";
    return await res.text();
  } catch { return ""; }
}
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           }
