// lib/rendering-engine/content-generation.ts
// Shared component-content generation and assembly — AI writes structured
// JSON content only; renderComponent() (Component Library) turns it into
// real HTML. Imported by BOTH orchestrate and generate routes so there is
// exactly one HTML-rendering pipeline in the repository.

import type { NicheProfile } from "./types";
import type { DomainBlueprint, DomainKnowledge } from "./domain-knowledge";
import { getSectionVariants } from "./domain-knowledge";
import { kryptonGenerate } from "@/lib/ai-providers";
import { renderComponent, listVariants, buildComponentContext, type ComponentCategory } from "@/lib/component-library";
import { pickComponentVariant } from "@/lib/design-engine";

export function buildGenericComponentContent(niche: NicheProfile): Record<string, any> {
  const industry = niche.industry || "Business";
  return {
    variants: {},
    navbar: { logoText: industry, links: [{label:"Home",href:"#hero"},{label:"Features",href:"#features"},{label:"Pricing",href:"#pricing"}], cta: { text:"Get Started", href:"#cta" } },
    hero: { badge: industry, headline: `Built for ${industry}`, subheadline: `A modern solution designed for ${industry.toLowerCase()} businesses.`, ctaPrimary: { text:"Get Started", href:"#cta" }, benefits: [{text:"Fast setup"},{text:"Reliable results"},{text:"Built to scale"}] },
    features: { eyebrow:"Why Us", headline:"Why Choose Us", items: [
      { icon:"⚡", title:"Fast", desc:`Built specifically for ${industry.toLowerCase()} needs.` },
      { icon:"🛡️", title:"Reliable", desc:"Consistent, dependable results every time." },
      { icon:"📈", title:"Scalable", desc:"Grows with your business." },
    ]},
    pricing: { eyebrow:"Pricing", headline:"Simple Pricing", tiers: [
      { name:"Starter", price:"$0", period:"month", features:["Core features","Community support"], cta:{text:"Start Free",href:"#"}, highlighted:false },
      { name:"Pro", price:"$29", period:"month", features:["Everything in Starter","Priority support","Advanced features"], cta:{text:"Get Pro",href:"#"}, highlighted:true },
    ]},
    cta: { headline:"Ready to get started?", subheadline:`Join other ${industry.toLowerCase()} businesses today.`, ctaPrimary:{text:"Get Started Free",href:"#"} },
    footer: { logoText: industry, tagline: `Built for ${industry.toLowerCase()}.`, columns: [
      { title:"Product", links:[{label:"Features",href:"#features"},{label:"Pricing",href:"#pricing"}] },
      { title:"Company", links:[{label:"About",href:"#"},{label:"Contact",href:"#"}] },
    ], socialLinks: [], copyrightName: industry },
  };
}


export async function generateComponentContent(
  niche: NicheProfile, blueprint: string, userPrompt: string, projectType: string,
  domainPlan?: DomainBlueprint | null
): Promise<Record<string, any> | null> {
  const tone = niche.tone || "default";

  // ── Blueprint-driven category selection ─────────────────────────────
  // If domainPlan exists, use its sectionOrder to pick components.
  // Map section names to component categories that actually exist.
  const SECTION_TO_CATEGORY: Record<string, ComponentCategory> = {
    hero:"hero", navbar:"navbar", footer:"footer",
    features:"features", benefits:"features", "why-us":"features",
    pricing:"pricing", membership:"pricing", plans:"pricing", tiers:"pricing",
    testimonials:"testimonials", reviews:"testimonials",
    faq:"faq", faqs:"faq",
    cta:"cta", contact:"cta",
    // Domain-specific → map to nearest component
    fleet:"features", showcase:"features", services:"features",
    gallery:"features", portfolio:"features",
    experience:"testimonials", results:"testimonials",
    about:"features", team:"features", stats:"features",
    booking:"cta", "book-now":"cta", "get-started":"cta",
    ecommerce:"ecommerce", products:"ecommerce", shop:"ecommerce",
    dashboard:"dashboard",
  };

  // ── Section variant lookup (from DomainKnowledge — exact variants) ──
  // When a static DomainKnowledge blueprint was used, sectionVariantHints
  // contains the exact variant (e.g. fleet→features/alternating) per section.
  // This eliminates the "always gets icon-grid for everything" problem.
  const sectionVariantHints: Record<string, { category: string; variant: string }> = {};
  if (domainPlan && (domainPlan as any).__domainKnowledge) {
    const dk = (domainPlan as any).__domainKnowledge as DomainKnowledge;
    Object.assign(sectionVariantHints, getSectionVariants(dk));
  }

  let categories: ComponentCategory[];
  if (domainPlan?.sectionOrder && domainPlan.sectionOrder.length > 0) {
    // Use AI architect's section order — always includes navbar + footer
    const mapped = domainPlan.sectionOrder
      .map(s => SECTION_TO_CATEGORY[s.toLowerCase()] as ComponentCategory)
      .filter(Boolean);
    // Deduplicate while preserving order
    const seen = new Set<string>();
    categories = (["navbar", ...mapped, "footer"] as ComponentCategory[])
      ;
  } else if (projectType === "dashboard") {
    categories = ["navbar", "dashboard", "footer"];
  } else if (projectType === "ecommerce" || projectType === "store") {
    categories = ["navbar", "hero", "ecommerce", "testimonials", "cta", "footer"];
  } else if (projectType === "portfolio") {
    categories = ["navbar", "hero", "portfolio", "testimonials", "cta", "footer"];
  } else {
    categories = ["navbar", "hero", "features", "testimonials", "pricing", "faq", "cta", "footer"];
  }

  // Build variant options with RECOMMENDED hints from DomainKnowledge
  const variantOptions = categories.map(c => {
    const allVariants = listVariants(c);
    // Find if any section in this category has a specific variant hint
    const hinted = Object.entries(sectionVariantHints)
      .find(([, v]) => v.category === c);
    if (hinted) {
      return `${c}: [${allVariants.map((v: string) => v === hinted[1].variant ? `${v} ★RECOMMENDED` : v).join(", ")}]`;
    }
    return `${c}: [${allVariants.join(", ")}]`;
  }).join("\n");

  // ── Blueprint-enriched system prompt ─────────────────────────────────
  const blueprintContext = domainPlan ? `
DOMAIN BLUEPRINT (follow this precisely):
Business: ${domainPlan.projectName} — ${domainPlan.tagline}
Goal: ${domainPlan.businessGoal}
Audience: ${domainPlan.targetAudience}
Primary CTA: "${domainPlan.primaryCTA}"
Secondary CTA: "${domainPlan.secondaryCTA}"
Copy Tone: ${domainPlan.copyTone}
Key Benefits: ${domainPlan.keyBenefits?.join(" | ")}
Design: ${domainPlan.designDirectives?.colorMood}
Imagery: ${domainPlan.designDirectives?.imagingStyle}
Asset Theme: ${domainPlan.assetTheme}
AVOID: ${domainPlan.avoidMistakes?.join("; ")}
Section Purposes: ${Object.entries(domainPlan.sectionPurpose||{}).map(([k,v])=>`${k}: ${v}`).join(" | ")}
Domain-specific sections: ${(domainPlan.sectionOrder||[]).join(" → ")}
Exact CTA to use: "${domainPlan.primaryCTA}" — never substitute a generic CTA
Imagery rule: ${domainPlan.assetTheme}` : "";

  const system = `You are Krypton AI's content specialist. Output ONLY valid JSON — no markdown fences, no preamble. Write real, specific copy for the user's niche.

CRITICAL RULES:
1. Headlines must be specific to THIS business — never generic
2. CTAs must use the exact primaryCTA from the blueprint
3. Benefits must be real differentiators for this industry
4. Never use stock phrases like "Get Started", "Learn More", "Our Features"
5. Image keywords must match the EXACT business (car club → luxury cars, NOT perfume)`;

  const user = `Build content for: "${userPrompt}"
Niche: ${niche.industry} (${niche.marketLevel} tier, ${tone} tone)
${blueprintContext}
Blueprint context: ${blueprint.slice(0, 400)}

Choose ONE variant per section from these options:
${variantOptions}

Return JSON only (no \`\`\`json):
{"variants":{"navbar":"...","hero":"...","features":"...","pricing":"...","cta":"...","footer":"..."},"navbar":{"logoText":"Brand","links":[{"label":"Home","href":"#hero"},{"label":"Features","href":"#features"},{"label":"Pricing","href":"#pricing"}],"cta":{"text":"Get Started","href":"#cta"}},"hero":{"badge":"Tagline","headline":"Specific headline for ${niche.industry}","subheadline":"2-sentence value prop","ctaPrimary":{"text":"Start Free","href":"#cta"},"benefits":[{"text":"Key benefit 1"},{"text":"Key benefit 2"},{"text":"Key benefit 3"}]},"features":{"eyebrow":"Why Us","headline":"Why Choose Us","items":[{"icon":"⚡","title":"Feature 1","desc":"Specific description","stat":"stat"}]},"pricing":{"eyebrow":"Pricing","headline":"Simple Pricing","tiers":[{"name":"Starter","price":"$0","period":"month","features":["Feature A","Feature B"],"cta":{"text":"Start Free","href":"#"},"highlighted":false},{"name":"Pro","price":"$29","period":"month","features":["Everything in Starter","Feature C","Feature D"],"cta":{"text":"Get Pro","href":"#"},"highlighted":true}]},"cta":{"headline":"Ready to start?","subheadline":"Join thousands of users","ctaPrimary":{"text":"Get Started Free","href":"#"}},"footer":{"logoText":"Brand","tagline":"Tagline","columns":[{"title":"Product","links":[{"label":"Features","href":"#"},{"label":"Pricing","href":"#"}]},{"title":"Company","links":[{"label":"About","href":"#"},{"label":"Contact","href":"#"}]}],"socialLinks":[{"label":"Twitter","href":"#"}],"copyrightName":"Brand"}}

Make ALL copy specific to ${niche.industry} — real headlines, real benefits, real feature names.`;

  try {
    const { text } = await kryptonGenerate(system, user);
    const cleaned = text.replace(/\`\`\`json|\`\`\`/g, "").trim();
    // Try direct parse first
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed.variants && parsed.hero) return parsed;
    } catch {}
    // Try extracting JSON from response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.variants && parsed.hero) return parsed;
    }
    return null;
  } catch {
    return null; // caller falls back to raw HTML generation
  }
}


export function assembleFromComponentLibrary(
  niche: NicheProfile, content: Record<string, any>, realImages: string[], seed: number = 0
): string {
  const ctx = buildComponentContext(niche.palette.primary);
  const v = content.variants || {};
  let html = "";
  let imgIdx = 0;
  const nextImg = () => realImages[imgIdx++ % Math.max(realImages.length, 1)] || "";

  if (content.navbar) html += renderComponent("navbar", v.navbar || pickComponentVariant("navbar", seed), ctx, content.navbar);
  if (content.hero) {
    const heroContent = { ...content.hero, imageUrl: content.hero.imageUrl || nextImg() };
    html += renderComponent("hero", v.hero || pickComponentVariant("hero", seed), ctx, heroContent);
  }
  if (content.dashboard) html += renderComponent("dashboard", v.dashboard || pickComponentVariant("dashboard", seed), ctx, content.dashboard);
  if (content.features) {
    const items = (content.features.items || []).map((it: any) => ({ ...it, imageUrl: it.imageUrl || nextImg() }));
    html += renderComponent("features", v.features || pickComponentVariant("features", seed), ctx, { ...content.features, items });
  }
  if (content.testimonials) html += renderComponent("testimonials", v.testimonials || pickComponentVariant("testimonials", seed), ctx, content.testimonials);
  if (content.pricing) html += renderComponent("pricing", v.pricing || pickComponentVariant("pricing", seed), ctx, content.pricing);
  if (content.faq) html += renderComponent("faq", v.faq || pickComponentVariant("faq", seed), ctx, content.faq);
  if (content.portfolio) html += renderComponent("portfolio", v.portfolio || pickComponentVariant("portfolio", seed), ctx, content.portfolio);
  if (content.ecommerce) html += renderComponent("ecommerce", v.ecommerce || pickComponentVariant("ecommerce", seed), ctx, content.ecommerce);
  if (content.cta) html += renderComponent("cta", v.cta || pickComponentVariant("cta", seed), ctx, content.cta);
  if (content.footer) html += renderComponent("footer", v.footer || pickComponentVariant("footer", seed), ctx, content.footer);

  return html;
}
  
