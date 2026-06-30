// app/api/multipage/route.ts
// Krypton AI — Multi-page Generation
//
// STRICT ARCHITECTURE:
// AI   → JSON content only (headlines, paragraphs, CTAs, copy)
// HTML → Component Library only (renderComponent, never AI-generated HTML)
//
// Cost:  1 AI call for ALL pages combined
// HTML:  100% deterministic from component library

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  renderComponent,
  getDefaultVariant,
  buildComponentContext,
  buildRootTokens,
  type ComponentCategory,
} from "@/lib/component-library";

export const runtime    = "nodejs";
export const maxDuration = 300;

// ── Page → component mapping ──────────────────────────────────────
// Structure is fixed. Only content (copy) comes from AI.
const PAGE_STRUCTURE: Record<string, ComponentCategory[]> = {
  about:    ["hero", "features", "testimonials", "cta", "footer"],
  services: ["hero", "features", "pricing",      "cta", "footer"],
  pricing:  ["hero", "pricing",  "faq",          "cta", "footer"],
  contact:  ["hero", "contact",                       "footer"],
};

// ── Strict TypeScript types for AI-generated JSON ─────────────────
// AI fills ONLY these fields. No HTML. No inline styles. No components.
interface NavItem   { label: string; href: string; }
interface CTAButton { text: string; href: string; }
interface Tier      { name: string; price: string; period: string; features: string[]; cta: CTAButton; highlighted: boolean; }
interface FAQItem   { question: string; answer: string; }
interface Feature   { icon: string; title: string; desc: string; }
interface TestiItem { quote: string; name: string; role: string; rating: number; }

interface PageJSON {
  hero:         { badge?: string; headline: string; subheadline: string; ctaPrimary: CTAButton; };
  features?:    { eyebrow: string; headline: string; items: Feature[]; };
  testimonials?:{ eyebrow: string; headline: string; items: TestiItem[]; };
  pricing?:     { eyebrow: string; headline: string; tiers: Tier[]; };
  faq?:         { eyebrow: string; headline: string; items: FAQItem[]; };
  cta?:         { headline: string; subheadline: string; ctaPrimary: CTAButton; };
  contact?:     { headline: string; subheadline: string; email?: string; phone?: string; submitText?: string; };
}

interface AllPagesJSON {
  nav:     { logoText: string; links: NavItem[]; cta: CTAButton; };
  footer:  { logoText: string; tagline: string; columns: {title:string; links:NavItem[]}[]; copyrightName: string; };
  about:    PageJSON;
  services: PageJSON;
  pricing:  PageJSON;
  contact:  PageJSON;
}

// ── Extract brand from existing HTML (zero AI calls) ─────────────
function extractBrand(html: string) {
  const root = html.match(/:root\s*\{([^}]+)\}/)?.[1] || "";
  const getVar = (...names: string[]) => {
    for (const n of names) {
      const m = root.match(new RegExp(`--${n}\\s*:\\s*([^;\\n]+)`));
      if (m) return m[1].trim();
    }
    return "";
  };

  const brandName =
    (html.match(/<title>([^|<–\-]{2,40})/)?.[1] ||
     html.match(/class="[^"]*logo[^"]*"[^>]*>\s*([A-Za-z][^<]{1,25})/)?.[1] || "Brand")
    .trim().replace(/\s*(AI|–|-|\|).*$/, "").trim();

  return {
    brandName,
    primaryColor:   getVar("primary","color-primary","accent") || "#6366F1",
    secondaryColor: getVar("secondary","color-secondary")       || "#8B5CF6",
    bgColor:        getVar("bg","background","color-bg")        || "#050816",
    headingFont:    getVar("heading-font")                      || "'Syne', sans-serif",
    bodyFont:       getVar("body-font")                         || "'DM Sans', sans-serif",
    fontImports:    (html.match(/<link[^>]*fonts\.googleapis[^>]*>/g) || []).join("\n"),
  };
}

// ── ONE AI call — returns strictly typed JSON, no HTML ────────────
async function generateCopyJSON(
  prompt: string,
  brand:  ReturnType<typeof extractBrand>,
  pages:  string[]
): Promise<AllPagesJSON> {

  const ANTHROPIC = process.env.ANTHROPIC_API_KEY;
  const OPENAI    = process.env.OPENAI_API_KEY;

  const system = `You are a professional copywriter. Return ONLY valid JSON. No markdown, no backticks, no HTML, no explanation. Every field must contain real, compelling copy specific to the business. Never use placeholder text.`;

  // Build per-page spec based on selected pages
  const pageSpec = pages.map(p => {
    const specs: Record<string,string> = {
      about:    `"about":{"hero":{"badge":"Our Story","headline":"[compelling about headline]","subheadline":"[2 sentence brand story]","ctaPrimary":{"text":"Meet the Team","href":"contact.html"}},"features":{"eyebrow":"What We Stand For","headline":"[values headline]","items":[{"icon":"🎯","title":"[value]","desc":"[2 sentences]"},{"icon":"💡","title":"[value]","desc":"[2 sentences]"},{"icon":"🤝","title":"[value]","desc":"[2 sentences]"}]},"testimonials":{"eyebrow":"Client Stories","headline":"[social proof headline]","items":[{"quote":"[specific testimonial about results]","name":"[name]","role":"[title, company]","rating":5},{"quote":"[specific testimonial]","name":"[name]","role":"[title]","rating":5}]},"cta":{"headline":"[closing about cta headline]","subheadline":"[1 sentence]","ctaPrimary":{"text":"Start Today","href":"contact.html"}}}`,
      services: `"services":{"hero":{"badge":"What We Do","headline":"[services headline]","subheadline":"[2 sentence overview]","ctaPrimary":{"text":"View Pricing","href":"pricing.html"}},"features":{"eyebrow":"Our Services","headline":"[services section headline]","items":[{"icon":"⚡","title":"[service]","desc":"[2 sentences]"},{"icon":"🔒","title":"[service]","desc":"[2 sentences]"},{"icon":"📊","title":"[service]","desc":"[2 sentences]"},{"icon":"🎨","title":"[service]","desc":"[2 sentences]"}]},"pricing":{"eyebrow":"Service Plans","headline":"[pricing headline]","tiers":[{"name":"Starter","price":"$X","period":"month","features":["[feature]","[feature]","[feature]"],"cta":{"text":"Get Started","href":"contact.html"},"highlighted":false},{"name":"Pro","price":"$X","period":"month","features":["[feature]","[feature]","[feature]","[feature]"],"cta":{"text":"Get Pro","href":"contact.html"},"highlighted":true}]},"cta":{"headline":"[services cta]","subheadline":"[1 sentence]","ctaPrimary":{"text":"Get Started","href":"contact.html"}}}`,
      pricing:  `"pricing":{"hero":{"badge":"Pricing","headline":"[pricing hero headline]","subheadline":"[2 sentence pitch]","ctaPrimary":{"text":"Start Free","href":"contact.html"}},"pricing":{"eyebrow":"Choose Your Plan","headline":"[pricing section headline]","tiers":[{"name":"Free","price":"$0","period":"forever","features":["[feature]","[feature]","[feature]"],"cta":{"text":"Start Free","href":"contact.html"},"highlighted":false},{"name":"Pro","price":"$X","period":"month","features":["[feature]","[feature]","[feature]","[feature]"],"cta":{"text":"Get Pro","href":"contact.html"},"highlighted":true},{"name":"Enterprise","price":"Custom","period":"","features":["[feature]","[feature]","[feature]"],"cta":{"text":"Contact Us","href":"contact.html"},"highlighted":false}]},"faq":{"eyebrow":"Common Questions","headline":"Frequently Asked Questions","items":[{"question":"[realistic FAQ 1]","answer":"[clear answer]"},{"question":"[realistic FAQ 2]","answer":"[clear answer]"},{"question":"[realistic FAQ 3]","answer":"[clear answer]"},{"question":"[realistic FAQ 4]","answer":"[clear answer]"}]},"cta":{"headline":"[pricing bottom cta]","subheadline":"[1 sentence urgency]","ctaPrimary":{"text":"Get Started Now","href":"contact.html"}}}`,
      contact:  `"contact":{"hero":{"badge":"Contact Us","headline":"[contact headline]","subheadline":"[warm 1-2 sentence invitation]","ctaPrimary":{"text":"Send Message","href":"#contact"}},"contact":{"headline":"Send Us a Message","subheadline":"[response time promise]","email":"hello@${brand.brandName.toLowerCase().replace(/\s/,'')+".com"}","submitText":"Send Message"}}`,
    };
    return specs[p] || `"${p}":{"hero":{"headline":"${p}","subheadline":"Content for ${p} page","ctaPrimary":{"text":"Learn More","href":"index.html"}}}`;
  }).join(",\n  ");

  const user = `Business: "${prompt}"
Brand name: ${brand.brandName}
Pages to generate: ${pages.join(", ")}

Return this exact JSON structure with all fields filled with real copy for "${prompt}":
{
  "nav": {
    "logoText": "${brand.brandName}",
    "links": [
      {"label":"Home","href":"index.html"},
      {"label":"About","href":"about.html"},
      {"label":"Services","href":"services.html"},
      {"label":"Pricing","href":"pricing.html"},
      {"label":"Contact","href":"contact.html"}
    ],
    "cta": {"text":"Get Started","href":"contact.html"}
  },
  "footer": {
    "logoText": "${brand.brandName}",
    "tagline": "[one-line brand tagline]",
    "columns": [
      {"title":"Company","links":[{"label":"About","href":"about.html"},{"label":"Services","href":"services.html"}]},
      {"title":"Support","links":[{"label":"Pricing","href":"pricing.html"},{"label":"Contact","href":"contact.html"}]}
    ],
    "copyrightName": "${brand.brandName}"
  },
  ${pageSpec}
}

Replace every [placeholder] with specific, compelling content for: "${prompt}". Every word must be relevant to this specific business.`;

  // Try Claude (with caching — system prompt cached across pages)
  if (ANTHROPIC) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC,
          "anthropic-version": "2023-06-01",
          "anthropic-beta": "prompt-caching-2024-07-31",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 4000,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: user }],
        }),
        signal: AbortSignal.timeout(90000),
      });
      if (res.ok) {
        const d = await res.json();
        const raw = d.content?.[0]?.text?.trim() || "{}";
        try { return JSON.parse(raw); } catch {}
        const m = raw.match(/\{[\s\S]+\}/);
        if (m) return JSON.parse(m[0]);
      }
    } catch {}
  }

  // Fallback: OpenAI (json_object mode forces valid JSON)
  if (OPENAI) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI}` },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (res.ok) {
      const d = await res.json();
      return JSON.parse(d.choices?.[0]?.message?.content || "{}");
    }
  }

  throw new Error("All AI providers failed");
}

// ── Build NicheProfile for renderComponent ─────────────────────────
function makeNiche(brand: ReturnType<typeof extractBrand>) {
  return {
    palette: {
      primary:   brand.primaryColor,
      secondary: brand.secondaryColor,
      grad:      `linear-gradient(135deg,${brand.primaryColor},${brand.secondaryColor})`,
      accent:    brand.secondaryColor,
      bg:        brand.bgColor,
      surface:   "#070B16",
      card:      "#0C1020",
      text2:     "#8892A0",
    },
    typography: {
      headingFont:    brand.headingFont,
      bodyFont:       brand.bodyFont,
      headingWeight:  "800",
      headingSpacing: "-0.02em",
    },
  };
}

// ── Assemble ONE page from component library ─────────────────────
// Zero AI calls. All HTML from renderComponent().
function assemblePage(
  pageName:   string,
  pageJSON:   PageJSON | undefined,
  copy:       AllPagesJSON,
  brand:      ReturnType<typeof extractBrand>,
  filename:   string
): string {
  const niche   = makeNiche(brand);
  const ctx     = buildComponentContext(brand.primaryColor);
  const tokens  = buildRootTokens(niche);
  const tone    = "default";
  const comps   = PAGE_STRUCTURE[pageName] || ["hero", "cta", "footer"];

  // Shared nav
  const navHTML = renderComponent("navbar", getDefaultVariant("navbar", tone), ctx, {
    logoText: copy.nav.logoText,
    links:    copy.nav.links,
    cta:      copy.nav.cta,
  });

  // Shared footer
  const footerHTML = renderComponent("footer", getDefaultVariant("footer", tone), ctx, {
    logoText:      copy.footer.logoText,
    tagline:       copy.footer.tagline,
    columns:       copy.footer.columns,
    socialLinks:   [],
    copyrightName: copy.footer.copyrightName,
  });

  // Page sections — each from component library
  let bodyHTML = navHTML;

  for (const comp of comps) {
    if (comp === "footer") continue;

    const content = pageJSON?.[comp as keyof PageJSON];
    if (!content) continue;

    // All HTML from renderComponent — never from AI
    bodyHTML += renderComponent(
      comp,
      getDefaultVariant(comp, tone),
      ctx,
      content
    );
  }

  bodyHTML += footerHTML;

  const title = pageName.charAt(0).toUpperCase() + pageName.slice(1);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — ${brand.brandName}</title>
${brand.fontImports}
<style>
${tokens}
html{scroll-behavior:smooth;}
body{overflow-x:hidden;-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px;}
.reveal{opacity:0;transform:translateY(20px);transition:opacity .6s,transform .6s;}
.reveal.visible{opacity:1;transform:none;}
@keyframes pulse{0%,100%{opacity:.3;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}
</style>
</head>
<body>
${bodyHTML}
<script>
const obs=new IntersectionObserver(e=>{e.forEach(el=>{if(el.isIntersecting){el.target.classList.add('visible');obs.unobserve(el.target);}});},{threshold:0.08});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
</script>
</body>
</html>`;
}

// ── ZIP builder (pure Node.js) ─────────────────────────────────────
function buildZip(files: {name:string;content:string}[]): Buffer {
  const entries: Buffer[] = [];
  const cd:      Buffer[] = [];
  let   offset = 0;

  for (const { name, content } of files) {
    const n = Buffer.from(name, "utf8");
    const d = Buffer.from(content, "utf8");
    const u16 = (v: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(v); return b; };
    const u32 = (v: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };

    let crc = 0xffffffff;
    for (const byte of d) { crc ^= byte; for (let k=0;k<8;k++) crc=(crc&1)?(crc>>>1)^0xedb88320:crc>>>1; }
    crc = (crc^0xffffffff)>>>0;

    const local = Buffer.concat([
      Buffer.from([0x50,0x4b,0x03,0x04]),
      u16(20),u16(0),u16(0),u16(0),u16(0),
      u32(crc),u32(d.length),u32(d.length),
      u16(n.length),u16(0),n,d,
    ]);
    cd.push(Buffer.concat([
      Buffer.from([0x50,0x4b,0x01,0x02]),
      u16(20),u16(20),u16(0),u16(0),u16(0),u16(0),
      u32(crc),u32(d.length),u32(d.length),
      u16(n.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),n,
    ]));
    entries.push(local);
    offset += local.length;
  }

  const cdBuf = Buffer.concat(cd);
  const eocd  = Buffer.concat([
    Buffer.from([0x50,0x4b,0x05,0x06,0,0,0,0]),
    (() => { const b = Buffer.alloc(2); b.writeUInt16LE(files.length); return b; })(),
    (() => { const b = Buffer.alloc(2); b.writeUInt16LE(files.length); return b; })(),
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(cdBuf.length); return b; })(),
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(offset);       return b; })(),
    Buffer.from([0,0]),
  ]);

  return Buffer.concat([...entries, cdBuf, eocd]);
}

// ── Main handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { homeHtml, prompt, accessToken, userId, selectedPages } =
    await req.json().catch(() => ({}));

  if (!homeHtml || !prompt) {
    return NextResponse.json({ error: "homeHtml and prompt required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Auth
  let uid = userId;
  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    uid = user?.id || uid;
  }
  if (!uid) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  // Credits (costs 2)
  const { data: profile } = await supabase
    .from("profiles").select("total_credits,used_credits").eq("id", uid).single();
  if (((profile?.total_credits||5) - (profile?.used_credits||0)) < 2) {
    return NextResponse.json({ error: "Multi-page costs 2 credits", code: "NO_CREDITS" }, { status: 402 });
  }

  const valid   = ["about","services","pricing","contact"];
  const pages   = ((selectedPages || valid) as string[]).filter(p => valid.includes(p.toLowerCase())).map(p => p.toLowerCase());
  if (!pages.length) return NextResponse.json({ error: "No valid pages" }, { status: 400 });

  // ── STEP 1: Extract brand — 0 AI calls ──────────────────────────
  const brand = extractBrand(homeHtml);

  // ── STEP 2: Generate ALL copy in 1 AI call ──────────────────────
  let copy: AllPagesJSON;
  try {
    copy = await generateCopyJSON(prompt, brand, pages) as AllPagesJSON;
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  // ── STEP 3: Assemble pages from component library — 0 AI calls ──
  // Sync index.html's navbar to the same shared nav used on every other
  // page, so cross-page links (about.html, pricing.html, ...) work from
  // the home page too — not just from the generated subpages.
  const niche0 = makeNiche(brand);
  const ctx0   = buildComponentContext(brand.primaryColor);
  const sharedNavHtml = renderComponent("navbar", getDefaultVariant("navbar", "default"), ctx0, {
    logoText: copy.nav.logoText,
    links:    copy.nav.links,
    cta:      copy.nav.cta,
  });
  const existingNavMatch = homeHtml.match(/<nav[^>]*>[\s\S]*?<\/nav>/i);
  const syncedHomeHtml = existingNavMatch
    ? homeHtml.replace(existingNavMatch[0], sharedNavHtml)
    : homeHtml.replace(/<body[^>]*>/i, (m: string) => `${m}\n${sharedNavHtml}`);
  const zipFiles: {name:string;content:string}[] = [
    { name: "index.html", content: syncedHomeHtml },
  ];

  for (const page of pages) {
    const pageJSON = (copy as any)[page] as PageJSON;
    zipFiles.push({
      name:    `${page}.html`,
      content: assemblePage(page, pageJSON, copy, brand, `${page}.html`),
    });
  }

  // Shared tokens CSS
  const niche = makeNiche(brand);
  zipFiles.push({ name: "assets/shared.css", content: buildRootTokens(niche) });
  zipFiles.push({
    name: "README.txt",
    content: `KRYPTON AI — ${brand.brandName} Multi-page Website
Generated: ${new Date().toLocaleDateString()}
Prompt: ${prompt}

FILES:
${zipFiles.filter(f=>f.name.endsWith('.html')).map(f=>`  ${f.name}`).join('\n')}
  assets/shared.css

DEPLOY:
  Netlify Drop: drag folder to app.netlify.com/drop
  GitHub Pages: push to repo → enable Pages
  Any host: upload all files to same folder
`,
  });

  const zip = buildZip(zipFiles);

  // Deduct credits
  await supabase.from("profiles")
    .update({ used_credits: (profile?.used_credits||0)+2 }).eq("id", uid);
  try {
    await supabase.from("credit_transactions")
      .insert({ user_id:uid, type:"debit", amount:2, description:`Multi-page (${pages.length+1}p)` });
  } catch {}

  const slug = prompt.slice(0,30).replace(/[^a-z0-9]/gi,"-").toLowerCase();
  return new NextResponse(new Uint8Array(zip), {
    status: 200,
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="krypton-${slug}-multipage.zip"`,
      "Content-Length":      zip.length.toString(),
    },
  });
}
