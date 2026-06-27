// app/api/multipage/route.ts
// Krypton AI — Multi-page Generation (Phase 2)
//
// ARCHITECTURE:
// 1. Extract brand system from existing home HTML (0 AI calls)
// 2. ONE AI call → generate ALL pages' copy as JSON (headings, paragraphs, CTAs only)
// 3. Assemble each page using existing Component Library (0 AI calls — deterministic)
// 4. Package as ZIP with assets/
//
// Cost: 1 AI call total vs 4+ AI calls in naive approach
// Quality: Consistent design (same tokens, same components)

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

// ── Page composition map ──────────────────────────────────────────
// Defines which components each page uses.
// No AI needed for structure — only copy is AI-generated.
const PAGE_COMPONENTS: Record<string, ComponentCategory[]> = {
  about:    ["hero", "features", "testimonials", "cta", "footer"],
  services: ["hero", "features", "pricing",      "cta", "footer"],
  pricing:  ["hero", "pricing",  "faq",          "cta", "footer"],
  contact:  ["hero", "cta",                            "footer"],
};

// ── Extract brand system from existing home HTML ─────────────────
// Zero AI calls — pure regex extraction
function extractBrandSystem(homeHtml: string): {
  primaryColor: string;
  secondaryColor: string;
  bgColor: string;
  textColor: string;
  headingFont: string;
  bodyFont: string;
  brandName: string;
  fontImports: string;
  cssVars: string;
} {
  // Extract :root CSS variables
  const rootMatch = homeHtml.match(/:root\s*\{([^}]+)\}/);
  const root = rootMatch?.[1] || "";

  const getCssVar = (names: string[]): string => {
    for (const name of names) {
      const m = root.match(new RegExp(`--${name}\\s*:\\s*([^;]+)`));
      if (m) return m[1].trim();
    }
    return "";
  };

  // Font links
  const fontImports = (homeHtml.match(/<link[^>]*fonts\.googleapis[^>]*>/g) || []).join("\n");
  const inlineFontImport = (homeHtml.match(/@import url\([^)]+googleapis[^)]+\)/g) || []).join("\n");

  // Brand name from title or logo
  const brandMatch =
    homeHtml.match(/<title>([^|<–-]{2,40})/)
    || homeHtml.match(/class="[^"]*logo[^"]*"[^>]*>\s*([^<]{2,30})/)
    || homeHtml.match(/<nav[^>]*>[^<]*<[^>]+>\s*([^<]{2,20})/);
  const brandName = brandMatch?.[1]?.trim().replace(/\s*(AI|–|-|\|).*$/, "") || "Brand";

  return {
    primaryColor:   getCssVar(["primary", "color-primary", "accent"]) || "#6366F1",
    secondaryColor: getCssVar(["secondary", "color-secondary"]) || "#8B5CF6",
    bgColor:        getCssVar(["bg", "background", "color-bg"]) || "#050816",
    textColor:      getCssVar(["text", "color-text"]) || "#F0F2F5",
    headingFont:    getCssVar(["heading-font"]) || "'Syne', sans-serif",
    bodyFont:       getCssVar(["body-font"]) || "'DM Sans', sans-serif",
    brandName,
    fontImports:    fontImports || (inlineFontImport ? `<style>${inlineFontImport}</style>` : ""),
    cssVars:        root.slice(0, 1200),
  };
}

// ── ONE AI call — generate copy for ALL pages ─────────────────────
async function generateAllPagesCopy(
  prompt: string,
  brandSystem: ReturnType<typeof extractBrandSystem>,
  selectedPages: string[]
): Promise<Record<string, any>> {
  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

  const pageCopySpec = selectedPages.map(page => {
    const specs: Record<string, string> = {
      about:    '"about":{"hero":{"badge":"...","headline":"...","subheadline":"..."},"features":{"eyebrow":"...","headline":"...","items":[{"icon":"emoji","title":"...","desc":"..."}]},"testimonials":{"eyebrow":"...","headline":"...","items":[{"quote":"...","name":"...","role":"...","rating":5}]},"cta":{"headline":"...","subheadline":"...","ctaPrimary":{"text":"...","href":"contact.html"}}}',
      services: '"services":{"hero":{"badge":"...","headline":"...","subheadline":"..."},"features":{"eyebrow":"Our Services","headline":"...","items":[{"icon":"emoji","title":"...","desc":"..."}]},"pricing":{"eyebrow":"Pricing","headline":"...","tiers":[{"name":"...","price":"$X","period":"month","features":["..."],"cta":{"text":"...","href":"contact.html"},"highlighted":false}]},"cta":{"headline":"...","subheadline":"...","ctaPrimary":{"text":"...","href":"contact.html"}}}',
      pricing:  '"pricing":{"hero":{"badge":"...","headline":"...","subheadline":"..."},"pricing":{"eyebrow":"Pricing","headline":"...","tiers":[{"name":"...","price":"$X","period":"month","features":["..."],"cta":{"text":"...","href":"contact.html"},"highlighted":false}]},"faq":{"headline":"Frequently Asked Questions","items":[{"question":"...","answer":"..."}]},"cta":{"headline":"...","subheadline":"...","ctaPrimary":{"text":"...","href":"contact.html"}}}',
      contact:  '"contact":{"hero":{"badge":"Contact Us","headline":"Get in Touch","subheadline":"..."},"cta":{"headline":"Ready to work together?","subheadline":"...","ctaPrimary":{"text":"Send Message","href":"#contact-form"}}}',
    };
    return specs[page] || `"${page}":{"hero":{"headline":"${page}","subheadline":"..."}}`;
  }).join(",\n");

  const system = `You are a copywriter. Generate website copy as JSON only. No markdown. No explanation. Real, specific, compelling copy for the business described. Never use placeholder text.`;

  const user = `Business: "${prompt}"
Brand: ${brandSystem.brandName}
Pages needed: ${selectedPages.join(", ")}

Return ONLY this JSON (fill in all "..." with real copy specific to "${prompt}"):
{
  "nav": {
    "logoText": "${brandSystem.brandName}",
    "links": [{"label":"Home","href":"index.html"},{"label":"About","href":"about.html"},{"label":"Services","href":"services.html"},{"label":"Pricing","href":"pricing.html"},{"label":"Contact","href":"contact.html"}],
    "cta": {"text":"Get Started","href":"contact.html"}
  },
  "footer": {
    "logoText": "${brandSystem.brandName}",
    "tagline": "...",
    "columns": [
      {"title":"Company","links":[{"label":"About","href":"about.html"},{"label":"Services","href":"services.html"}]},
      {"title":"Product","links":[{"label":"Pricing","href":"pricing.html"},{"label":"Contact","href":"contact.html"}]}
    ],
    "copyrightName": "${brandSystem.brandName}"
  },
  ${pageCopySpec}
}

Make every headline, description, and CTA specific to: "${prompt}". No generic text.`;

  // Try Claude first (with caching)
  if (ANTHROPIC_KEY) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_KEY,
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
        const text = d.content?.[0]?.text || "";
        const cleaned = text.replace(/```json|```/g, "").trim();
        try { return JSON.parse(cleaned); } catch {}
        const jsonMatch = cleaned.match(/\{[\s\S]+\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
      }
    } catch {}
  }

  // Fallback: OpenAI
  if (OPENAI_KEY) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${OPENAI_KEY}` },
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
      const text = d.choices?.[0]?.message?.content || "{}";
      return JSON.parse(text);
    }
  }

  throw new Error("All AI providers failed");
}

// ── Build complete page HTML using component library ─────────────
function buildPageHtml(
  pageName: string,  // e.g. "about"
  copy: Record<string, any>,
  brandSystem: ReturnType<typeof extractBrandSystem>,
  filename: string   // e.g. "about.html"
): string {
  const niche = {
    palette: {
      primary:   brandSystem.primaryColor,
      secondary: brandSystem.secondaryColor,
      grad:      `linear-gradient(135deg,${brandSystem.primaryColor},${brandSystem.secondaryColor})`,
      accent:    brandSystem.secondaryColor,
      bg:        brandSystem.bgColor,
      surface:   "#070B16",
      card:      "#0C1020",
      text2:     "#8892A0",
    },
    typography: {
      headingFont:    brandSystem.headingFont,
      bodyFont:       brandSystem.bodyFont,
      headingWeight:  "800",
      headingSpacing: "-0.02em",
    },
  };

  const ctx = buildComponentContext(brandSystem.primaryColor);
  const rootTokens = buildRootTokens(niche);
  const tone = "default";

  // Page copy sections
  const pageContent = copy[pageName] || {};
  const navCopy     = copy.nav || {};
  const footerCopy  = copy.footer || {};
  const components  = PAGE_COMPONENTS[pageName] || ["hero", "cta", "footer"];

  // Shared nav content
  const navContent = {
    logoText: navCopy.logoText || brandSystem.brandName,
    links:    navCopy.links    || [
      { label: "Home",     href: "index.html"    },
      { label: "About",    href: "about.html"    },
      { label: "Services", href: "services.html" },
      { label: "Pricing",  href: "pricing.html"  },
      { label: "Contact",  href: "contact.html"  },
    ],
    cta: navCopy.cta || { text: "Get Started", href: "contact.html" },
  };

  // Shared footer content
  const footerContent = {
    logoText:      footerCopy.logoText    || brandSystem.brandName,
    tagline:       footerCopy.tagline     || "",
    columns:       footerCopy.columns     || [],
    socialLinks:   footerCopy.socialLinks || [],
    copyrightName: footerCopy.copyrightName || brandSystem.brandName,
  };

  // Build body HTML from components
  let bodyHtml = "";
  bodyHtml += renderComponent("navbar", getDefaultVariant("navbar", tone), ctx, navContent);

  for (const comp of components) {
    if (comp === "footer") continue; // added last
    const compContent = pageContent[comp];
    if (!compContent) continue;
    bodyHtml += renderComponent(comp, getDefaultVariant(comp, tone), ctx, compContent);
  }

  // Contact form (hardcoded for contact page — no AI needed)
  if (pageName === "contact") {
    bodyHtml += `
<section style="padding:clamp(80px,10vw,120px) 0;background:var(--surface);">
  <div style="max-width:640px;margin:0 auto;padding:0 clamp(20px,5vw,60px);">
    <form id="contact-form" onsubmit="handleSubmit(event)" style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:40px;display:flex;flex-direction:column;gap:20px;">
      <h2 style="font-family:var(--heading-font);font-size:28px;font-weight:var(--heading-weight);margin:0 0 8px;">Send us a message</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
        <div><label style="font-size:12px;color:var(--text-2);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">Name</label><input type="text" required placeholder="Your name" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px;color:var(--text);font-size:14px;outline:none;font-family:inherit;"></div>
        <div><label style="font-size:12px;color:var(--text-2);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">Email</label><input type="email" required placeholder="your@email.com" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px;color:var(--text);font-size:14px;outline:none;font-family:inherit;"></div>
      </div>
      <div><label style="font-size:12px;color:var(--text-2);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">Subject</label><input type="text" placeholder="How can we help?" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px;color:var(--text);font-size:14px;outline:none;font-family:inherit;"></div>
      <div><label style="font-size:12px;color:var(--text-2);display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em;">Message</label><textarea required rows={5} placeholder="Tell us about your project..." style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px 14px;color:var(--text);font-size:14px;outline:none;font-family:inherit;resize:vertical;"></textarea></div>
      <button type="submit" id="submit-btn" style="background:var(--grad);color:#fff;border:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;transition:all .2s;">Send Message</button>
      <div id="form-status" style="display:none;text-align:center;font-size:13px;padding:10px;border-radius:8px;"></div>
    </form>
  </div>
</section>
<script>
function handleSubmit(e){
  e.preventDefault();
  const btn=document.getElementById('submit-btn');
  const status=document.getElementById('form-status');
  btn.textContent='Sending...';btn.disabled=true;
  setTimeout(()=>{
    btn.textContent='Sent!';
    status.style.display='block';
    status.style.background='rgba(76,175,138,0.1)';
    status.style.color='#4CAF8A';
    status.style.border='1px solid rgba(76,175,138,0.3)';
    status.textContent='✓ Message sent! We\'ll get back to you within 24 hours.';
    setTimeout(()=>{btn.textContent='Send Message';btn.disabled=false;status.style.display='none';},4000);
  },1200);
}
</script>`;
  }

  bodyHtml += renderComponent("footer", getDefaultVariant("footer", tone), ctx, footerContent);

  // Wrap in full HTML document
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${pageName.charAt(0).toUpperCase() + pageName.slice(1)} | ${brandSystem.brandName}</title>
${brandSystem.fontImports}
<style>
${rootTokens}
html{scroll-behavior:smooth;}
body{overflow-x:hidden;-webkit-font-smoothing:antialiased;}
::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px;}
.reveal{opacity:0;transform:translateY(20px);transition:opacity .6s,transform .6s;}.reveal.visible{opacity:1;transform:none;}
@keyframes pulse{0%,100%{opacity:.3;transform:scale(.9)}50%{opacity:1;transform:scale(1.1)}}
</style>
</head>
<body>
${bodyHtml}
<script>
const obs=new IntersectionObserver(e=>{e.forEach(el=>{if(el.isIntersecting){el.target.classList.add('visible');obs.unobserve(el.target);}});},{threshold:0.08});
document.querySelectorAll('.reveal').forEach(el=>obs.observe(el));
</script>
</body>
</html>`;
}

// ── Simple ZIP builder (no external deps — pure Node.js Buffer) ──
function buildZip(files: {name:string;content:Buffer|string}[]): Buffer {
  const entries: Buffer[] = [];
  const centralDir: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name   = Buffer.from(file.name, "utf8");
    const data   = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content, "utf8");
    const size   = data.length;
    const ui32   = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
    const ui16   = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };

    // CRC-32
    let crc = 0xffffffff;
    for (let i = 0; i < data.length; i++) {
      crc ^= data[i];
      for (let k = 0; k < 8; k++) crc = (crc & 1) ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    crc = (crc ^ 0xffffffff) >>> 0;

    const local = Buffer.concat([
      Buffer.from([0x50,0x4b,0x03,0x04]),
      ui16(20), ui16(0), ui16(0), ui16(0), ui16(0),
      ui32(crc), ui32(size), ui32(size),
      ui16(name.length), ui16(0), name, data,
    ]);

    centralDir.push(Buffer.concat([
      Buffer.from([0x50,0x4b,0x01,0x02]),
      ui16(20), ui16(20), ui16(0), ui16(0), ui16(0), ui16(0),
      ui32(crc), ui32(size), ui32(size),
      ui16(name.length), ui16(0), ui16(0), ui16(0), ui16(0),
      ui32(0), ui32(offset), name,
    ]));

    entries.push(local);
    offset += local.length;
  }

  const cd   = Buffer.concat(centralDir);
  const eocd = Buffer.concat([
    Buffer.from([0x50,0x4b,0x05,0x06]),
    Buffer.from([0,0,0,0]),
    (() => { const b = Buffer.alloc(2); b.writeUInt16LE(files.length); return b; })(),
    (() => { const b = Buffer.alloc(2); b.writeUInt16LE(files.length); return b; })(),
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(cd.length); return b; })(),
    (() => { const b = Buffer.alloc(4); b.writeUInt32LE(offset); return b; })(),
    Buffer.from([0,0]),
  ]);

  return Buffer.concat([...entries, cd, eocd]);
}

// ── Main handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { homeHtml, prompt, accessToken, userId, selectedPages } = body;

  if (!homeHtml || !prompt) {
    return NextResponse.json({ error: "homeHtml and prompt required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Auth
  let authedUserId = userId;
  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    authedUserId = user?.id || userId;
  }
  if (!authedUserId) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  // Credit check
  const { data: profile } = await supabase
    .from("profiles")
    .select("total_credits, used_credits")
    .eq("id", authedUserId)
    .single();

  const remaining = (profile?.total_credits || 5) - (profile?.used_credits || 0);
  if (remaining < 2) {
    return NextResponse.json({ error: "Insufficient credits (multi-page costs 2 credits)", code: "NO_CREDITS" }, { status: 402 });
  }

  // Valid pages
  const validPages = ["about", "services", "pricing", "contact"];
  const pagesToGen = (selectedPages || validPages)
    .map((p: string) => p.toLowerCase())
    .filter((p: string) => validPages.includes(p));

  if (pagesToGen.length === 0) {
    return NextResponse.json({ error: "No valid pages selected" }, { status: 400 });
  }

  // ── STEP 1: Extract brand from existing home HTML (0 AI calls) ──
  const brandSystem = extractBrandSystem(homeHtml);

  // ── STEP 2: ONE AI call for all pages' copy ───────────────────
  let allCopy: Record<string, any>;
  try {
    allCopy = await generateAllPagesCopy(prompt, brandSystem, pagesToGen);
  } catch (err: any) {
    return NextResponse.json({ error: `Copy generation failed: ${err.message}` }, { status: 500 });
  }

  // ── STEP 3: Assemble pages from component library (0 AI calls) ──
  const zipFiles: { name: string; content: Buffer | string }[] = [];

  // Add fixed home page with updated nav
  zipFiles.push({ name: "index.html", content: homeHtml });

  // Assemble each additional page
  for (const page of pagesToGen) {
    const pageHtml = buildPageHtml(page, allCopy, brandSystem, `${page}.html`);
    zipFiles.push({ name: `${page}.html`, content: pageHtml });
  }

  // Shared CSS assets file
  const sharedCss = buildRootTokens({
    palette: {
      primary:   brandSystem.primaryColor,
      secondary: brandSystem.secondaryColor,
      grad:      `linear-gradient(135deg,${brandSystem.primaryColor},${brandSystem.secondaryColor})`,
      accent:    brandSystem.secondaryColor,
      bg:        brandSystem.bgColor,
      surface:   "#070B16",
      card:      "#0C1020",
      text2:     "#8892A0",
    },
    typography: {
      headingFont:    brandSystem.headingFont,
      bodyFont:       brandSystem.bodyFont,
      headingWeight:  "800",
      headingSpacing: "-0.02em",
    },
  });

  zipFiles.push({
    name: "assets/shared.css",
    content: sharedCss,
  });

  // README
  zipFiles.push({
    name: "README.txt",
    content: `KRYPTON AI — Multi-page Website
Brand: ${brandSystem.brandName}
Generated: ${new Date().toLocaleDateString()}
Prompt: ${prompt}

PAGES:
${["index.html", ...pagesToGen.map(p => `${p}.html`)].join("\n")}

HOW TO USE:
1. Keep all HTML files in same folder — nav links connect them
2. Deploy to Netlify: drag entire folder to app.netlify.com/drop
3. Deploy to GitHub Pages: push to repo, enable Pages in settings

HOSTING:
- Netlify Drop: https://app.netlify.com/drop (instant, free)
- GitHub Pages: free static hosting
- Any web host: upload via FTP/cPanel
`,
  });

  // ── STEP 4: Build and return ZIP ──────────────────────────────
  const zipBuffer = buildZip(zipFiles);

  // Deduct credits (2 for multi-page)
  await supabase.from("profiles")
    .update({ used_credits: (profile?.used_credits || 0) + 2 })
    .eq("id", authedUserId);

  await supabase.from("credit_transactions").insert({
    user_id:     authedUserId,
    type:        "debit",
    amount:      2,
    description: `Multi-page generation (${pagesToGen.length + 1} pages)`,
  }).catch(() => {});

  const siteName = prompt.slice(0, 30).replace(/[^a-z0-9]/gi, "-").toLowerCase();

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type":        "application/zip",
      "Content-Disposition": `attachment; filename="krypton-${siteName}-multipage.zip"`,
      "Content-Length":      zipBuffer.length.toString(),
    },
  });
}
