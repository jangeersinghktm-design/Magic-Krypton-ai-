/**
 * KRYPTON AI — Completion Engine: Website Quality Checklist
 *
 * Mirrors lib/game-builder/quality-audit.ts but for website categories
 * returned by orchestrate's detectProjectType(): game, ecommerce,
 * dashboard, app, landing, portfolio, blog, website.
 *
 * ("game" is excluded here — games use lib/game-builder/quality-audit.ts)
 */

export interface FeatureCheck {
  id:     string;
  label:  string;
  weight: number; // sums to 100 per category (30 base + 70 type-specific)
  test:   (html: string) => boolean;
}

export interface AuditResult {
  score:  number;
  passed: { id: string; label: string; weight: number }[];
  failed: { id: string; label: string; weight: number }[];
  total:  number;
}

const re = (pattern: string, flags = "i") => {
  const r = new RegExp(pattern, flags);
  return (html: string) => r.test(html);
};
const all = (...fns: ((h: string) => boolean)[]) => (h: string) => fns.every(f => f(h));

// ── BASE — universal website checks (sums to 30) ────────────────
const BASE_ITEMS: FeatureCheck[] = [
  { id:"viewport",   label:"Mobile viewport meta tag",            weight:4, test: re('<meta[^>]*name=["\']viewport') },
  { id:"nav",        label:"Navigation with links",               weight:5, test: all(re("<nav"), re("<a\\s")) },
  { id:"hero",       label:"Hero / header section with heading",  weight:4, test: re("<h1") },
  { id:"footer",     label:"Footer section",                      weight:4, test: re("<footer") },
  { id:"noPlaceholder", label:"No placeholder/lorem content",     weight:5, test: (h) => !/lorem ipsum|coming soon|\[insert|placeholder\.(png|jpg)/i.test(h) },
  { id:"workingLinks", label:"Links/buttons have real targets",   weight:4, test: (h) => !/href=["']#["'][^>]*>(?!<\/a>)/i.test(h) || /onclick=/i.test(h) },
  { id:"responsive", label:"Responsive layout (media queries/flex/grid)", weight:4, test: (h) => /@media/i.test(h) || /display:\s*(flex|grid)/i.test(h) },
];

// ── TYPE-SPECIFIC checklists (each sums to 70) ───────────────────
const TYPE_ITEMS: Record<string, FeatureCheck[]> = {

  landing: [
    { id:"valueProp",   label:"Clear value proposition headline", weight:10, test: re("<h1") },
    { id:"cta",         label:"Call-to-action button(s)",         weight:12, test: re("get started|sign up|try.*free|book.*demo|contact.*us|cta") },
    { id:"features",    label:"Features / benefits section",      weight:12, test: re("feature|benefit") },
    { id:"socialProof", label:"Social proof (testimonials/stats)",weight:10, test: re("testimonial|review|trusted by|customers|⭐") },
    { id:"pricingOrForm", label:"Pricing or signup form",         weight:10, test: re("pricing|<form|input.*email") },
    { id:"faq",         label:"FAQ section",                      weight:8,  test: re("faq|frequently asked") },
    { id:"legalFooter", label:"Footer with privacy/terms links",  weight:8,  test: re("privacy|terms") },
  ],

  saas: [
    { id:"pricingTiers", label:"Pricing tiers / plans",            weight:14, test: re("pricing|plan|tier|/month|/mo\\b") },
    { id:"featureList",  label:"Feature list / comparison",        weight:12, test: re("feature") },
    { id:"authButtons",  label:"Sign up / Log in buttons",         weight:12, test: re("sign up|log in|sign in|get started") },
    { id:"productPreview", label:"Product/dashboard preview",      weight:10, test: re("dashboard|preview|screenshot|<img|<canvas|<svg") },
    { id:"testimonials", label:"Testimonials",                     weight:10, test: re("testimonial|review|customer") },
    { id:"faq",          label:"FAQ section",                      weight:8,  test: re("faq|frequently asked") },
    { id:"trustBadges",  label:"Trust badges / integrations",      weight:4,  test: re("trusted|integrat|partner") },
  ],

  dashboard: [
    { id:"sidebar",   label:"Sidebar navigation",                  weight:14, test: re("sidebar|side-nav|<nav") },
    { id:"charts",    label:"Data visualization (chart/graph)",    weight:14, test: re("chart|graph|<canvas|<svg") },
    { id:"statCards", label:"Stat / KPI cards",                     weight:12, test: re("stat|kpi|metric|card") },
    { id:"dataTable", label:"Data table or list",                  weight:12, test: re("<table|<ul.*list|data-row|table-row") },
    { id:"filters",   label:"Filters / search",                    weight:8,  test: re("filter|search|<input") },
    { id:"profile",   label:"User profile / avatar area",          weight:6,  test: re("profile|avatar|user-menu") },
    { id:"gridLayout",label:"Responsive grid layout",              weight:4,  test: re("display:\\s*grid|grid-template") },
  ],

  ecommerce: [
    { id:"productGrid", label:"Product grid / listing",            weight:14, test: re("product|<div[^>]*class=[\"'][^\"']*(card|item|grid)") },
    { id:"productCards", label:"Product cards with price",         weight:12, test: re("price|\\$\\d|₹\\d") },
    { id:"addToCart",   label:"Add to cart button",                weight:12, test: re("add to cart|buy now|add.*basket") },
    { id:"cartUI",      label:"Shopping cart UI",                  weight:10, test: re("cart|basket") },
    { id:"searchFilter",label:"Search / category filter",          weight:8,  test: re("search|filter|category") },
    { id:"checkout",    label:"Checkout flow elements",            weight:8,  test: re("checkout|payment|order") },
    { id:"categoryNav", label:"Category navigation",               weight:6,  test: re("categor") },
  ],

  app: [
    { id:"coreLogic",   label:"Core interactive tool/logic",       weight:16, test: re("function\\s+\\w+\\(|addEventListener") },
    { id:"inputFields", label:"Input fields with validation",      weight:12, test: re("<input|required|pattern=") },
    { id:"output",      label:"Results / output display area",    weight:12, test: re("result|output|<output") },
    { id:"saveReset",   label:"Save / reset functionality",        weight:10, test: re("save|reset|clear") },
    { id:"responsive",  label:"Responsive layout",                 weight:8,  test: re("@media|flex|grid") },
    { id:"labels",      label:"Clear labels / instructions",       weight:6,  test: re("<label|placeholder=") },
    { id:"emptyStates", label:"Error / empty state handling",      weight:6,  test: re("empty|no results|error") },
  ],

  portfolio: [
    { id:"about",     label:"About / intro section",               weight:12, test: re("about|intro") },
    { id:"projects",  label:"Projects / work gallery",             weight:16, test: re("project|portfolio|work|gallery") },
    { id:"skills",    label:"Skills section",                      weight:10, test: re("skill") },
    { id:"contact",   label:"Contact section / form",              weight:12, test: re("contact|<form") },
    { id:"socialLinks", label:"Social media links",                weight:8,  test: re("github|linkedin|twitter|instagram") },
    { id:"resume",    label:"Resume / CV link",                     weight:6,  test: re("resume|cv\\b|download") },
    { id:"anchorNav", label:"Smooth anchor navigation",             weight:6,  test: re('href=["\']#') },
  ],

  blog: [
    { id:"articleList", label:"Article list / cards",              weight:16, test: re("article|post|<article") },
    { id:"featured",    label:"Featured / hero article",           weight:10, test: re("featured|hero") },
    { id:"categories",  label:"Categories / tags",                 weight:10, test: re("categor|tag") },
    { id:"author",      label:"Author info",                       weight:8,  test: re("author|by\\s") },
    { id:"readMore",    label:"\"Read more\" links",               weight:8,  test: re("read more|continue reading") },
    { id:"sidebar",     label:"Sidebar (recent posts/search)",     weight:10, test: re("sidebar|recent post|search") },
    { id:"pagination",  label:"Pagination",                         weight:8,  test: re("pagination|next page|page \\d") },
  ],

  website: [
    { id:"sections",   label:"Multiple distinct content sections", weight:16, test: (h) => (h.match(/<section/gi) || []).length >= 2 },
    { id:"about",      label:"About / services section",           weight:14, test: re("about|service") },
    { id:"contact",    label:"Contact info / section",             weight:12, test: re("contact") },
    { id:"showcase",   label:"Gallery or content showcase",        weight:10, test: re("gallery|showcase|portfolio|<img") },
    { id:"testimonials", label:"Testimonials / reviews",           weight:8,  test: re("testimonial|review") },
    { id:"footerLinks", label:"Footer with links",                 weight:6,  test: all(re("<footer"), re("<a\\s")) },
    { id:"navLinks",   label:"Clear navigation links",             weight:4,  test: re("<nav") },
  ],
};

export function getRequiredFeatures(projectType: string): FeatureCheck[] {
  const specific = TYPE_ITEMS[projectType] || TYPE_ITEMS["website"];
  return [...BASE_ITEMS, ...specific];
}

export function auditWebsiteHTML(html: string, projectType: string): AuditResult {
  const checklist = getRequiredFeatures(projectType);
  const passed: AuditResult["passed"] = [];
  const failed: AuditResult["failed"] = [];

  for (const f of checklist) {
    let ok = false;
    try { ok = f.test(html); } catch { ok = false; }
    if (ok) passed.push({ id: f.id, label: f.label, weight: f.weight });
    else    failed.push({ id: f.id, label: f.label, weight: f.weight });
  }

  const score = passed.reduce((s, p) => s + p.weight, 0);
  return { score, passed, failed, total: checklist.length };
}

export function buildWebsiteChecklistPrompt(projectType: string): string {
  const checklist = getRequiredFeatures(projectType);
  const lines = checklist
    .sort((a, b) => b.weight - a.weight)
    .map((f, i) => `${i + 1}. ${f.label}`);

  return `REQUIRED FEATURE CHECKLIST — your output will be AUTOMATICALLY AUDITED against this list.
Every item below must be implemented and detectable in your code. Aim for a score of 95/100 or higher.

${lines.join("\n")}

If running low on token budget, prioritize the highest-weight items — but the file MUST still end with a valid </html>.`;
}

