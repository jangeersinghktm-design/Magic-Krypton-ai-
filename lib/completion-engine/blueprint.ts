/**
 * KRYPTON AI — Completion Engine: Blueprint Generator
 *
 * Generates a structured "project blueprint" BEFORE generation —
 * the AI extends this blueprint rather than starting from an empty
 * prompt (Phase 1+2+3 of the requested architecture).
 *
 * IMPORTANT: Krypton outputs a SINGLE HTML file (no backend, no
 * multi-file project). So:
 *   - `pages`      = sections/screens within that one file
 *   - `components` = reusable UI patterns within that one file
 *   - `databaseTables` / `apiEndpoints` = ADVISORY ONLY — suggestions
 *     for what a future backend would need if this were extended.
 *     Nothing in Krypton currently provisions these.
 *   - `fileStructure` = the logical breakdown of the single HTML file
 *     (<head>, <nav>, <section>...</section>, <script>) — accurate to
 *     what is actually produced.
 *
 * Derived deterministically (no extra AI call, no added latency) from
 * the templates/checklists already built in lib/completion-engine.
 */

import { getRequiredFeatures as getGameFeatures } from "@/lib/game-builder/quality-audit";
import { getRequiredFeatures as getWebsiteFeatures } from "./website-checklist";
import { getGameTemplate, getWebsiteTemplate } from "./templates";

export interface DesignSystem {
  colors: { primary: string; background: string; text: string; accent: string };
  fonts:  { heading: string; body: string };
  spacing: string;
  style:   string;
}

export interface ProjectBlueprint {
  projectType:    string;
  features:       string[];
  pages:          string[];
  components:     string[];
  databaseTables: string[]; // advisory — Krypton has no backend
  apiEndpoints:   string[]; // advisory — Krypton has no backend
  designSystem:   DesignSystem;
  fileStructure:  string[]; // sections within the single generated HTML file
}

// ── Advisory backend suggestions per category (documentation only) ──
const BACKEND_SUGGESTIONS: Record<string, { tables: string[]; endpoints: string[] }> = {
  ecommerce: {
    tables: ["products(id, name, price, image, category, stock)", "orders(id, user_id, items, total, status)", "users(id, email, name)"],
    endpoints: ["GET /api/products", "POST /api/cart", "POST /api/checkout"],
  },
  saas: {
    tables: ["users(id, email, plan)", "subscriptions(id, user_id, plan, status, renews_at)", "usage(id, user_id, metric, value)"],
    endpoints: ["POST /api/signup", "POST /api/subscribe", "GET /api/usage"],
  },
  dashboard: {
    tables: ["users(id, email, role)", "metrics(id, name, value, recorded_at)", "events(id, type, payload, created_at)"],
    endpoints: ["GET /api/metrics", "GET /api/events", "GET /api/users"],
  },
  blog: {
    tables: ["posts(id, title, body, author_id, published_at)", "authors(id, name, bio)", "tags(id, name)"],
    endpoints: ["GET /api/posts", "GET /api/posts/:id", "GET /api/tags"],
  },
  app: {
    tables: ["users(id, email)", "items(id, user_id, data, created_at)"],
    endpoints: ["GET /api/items", "POST /api/items", "DELETE /api/items/:id"],
  },
  portfolio: {
    tables: ["projects(id, title, description, link, image)", "messages(id, name, email, message)"],
    endpoints: ["GET /api/projects", "POST /api/contact"],
  },
  landing: {
    tables: ["leads(id, email, created_at)"],
    endpoints: ["POST /api/signup"],
  },
  website: {
    tables: ["pages(id, slug, content)", "messages(id, name, email, message)"],
    endpoints: ["POST /api/contact"],
  },
  game: {
    tables: ["high_scores(id, user_id, score, level, created_at)"],
    endpoints: ["GET /api/leaderboard", "POST /api/scores"],
  },
};

// ── Standard design system (matches BASE prompt design tokens) ──────
const DEFAULT_DESIGN_SYSTEM: DesignSystem = {
  colors: { primary: "#FFD700", background: "#050505", text: "#ffffff", accent: "#FF7A00" },
  fonts:  { heading: "Syne (800 weight)", body: "DM Sans (400-600 weight)" },
  spacing: "8px grid: 8/16/24/32/40/48/64/80/96px",
  style:   "Dark, premium, glassmorphism with gradient accents",
};

const GAME_DESIGN_SYSTEM: DesignSystem = {
  colors: { primary: "#00ff88", background: "#0a0a0a", text: "#00ff88", accent: "#ff0055" },
  fonts:  { heading: "Arial / system sans-serif", body: "Arial / system sans-serif" },
  spacing: "HUD padding 14-20px, overlay gap 20px",
  style:   "Neon-on-dark arcade aesthetic with glow text-shadows",
};

// ── Extract <section id="..."> ids from a template, in order ────────
function extractSectionIds(template: string | null): string[] {
  if (!template) return [];
  const ids: string[] = [];
  const re = /<(?:section|nav|footer)[^>]*\bid=["']([\w-]+)["']/gi;
  let m;
  while ((m = re.exec(template))) ids.push(m[1]);
  // nav/footer aren't really "pages" but are useful as structure anchors —
  // keep them, caller can filter if needed.
  return [...new Set(ids)];
}

// ── Website Blueprint ────────────────────────────────────────────
export function generateWebsiteBlueprint(projectType: string, prompt: string): ProjectBlueprint {
  const checklist = getWebsiteFeatures(projectType);
  const features = checklist
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map(f => f.label);

  const template = getWebsiteTemplate(projectType);
  const sectionIds = extractSectionIds(template);

  // "pages" — for a single-page site these are the scroll sections;
  // treat them as the site's "pages" since each is independently linkable via #anchor
  const pages = sectionIds.length > 0
    ? sectionIds.map(id => `#${id}`)
    : ["#hero", "#about", "#contact"]; // generic fallback

  // "components" — recurring UI patterns implied by the checklist
  const componentPool = [
    "Navbar", "Footer", "Hero Section", "Feature Card", "Pricing Card",
    "Testimonial Card", "FAQ Accordion Item", "CTA Button", "Stat Card",
    "Product Card", "Data Table Row", "Sidebar Nav Item",
  ];
  const components = componentPool.filter(c => {
    const key = c.toLowerCase();
    return checklist.some(f => key.includes(f.id.toLowerCase()) || f.label.toLowerCase().includes(key.split(" ")[0]));
  });
  // always include the universals
  for (const must of ["Navbar", "Footer", "CTA Button"]) {
    if (!components.includes(must)) components.unshift(must);
  }

  const backend = BACKEND_SUGGESTIONS[projectType] || BACKEND_SUGGESTIONS["website"];

  const fileStructure = [
    "index.html <head> — meta viewport, design tokens (CSS variables), Google Fonts import",
    "index.html <nav> — site navigation with anchor links to each section",
    ...sectionIds.filter(id => id !== "nav" && id !== "footer").map(id => `index.html <section id="${id}"> — ${id} content`),
    "index.html <footer> — links, copyright",
    "index.html <script> — interactivity: form handlers, accordions, animations, scroll reveal",
  ];

  return {
    projectType,
    features,
    pages,
    components,
    databaseTables: backend.tables,
    apiEndpoints: backend.endpoints,
    designSystem: DEFAULT_DESIGN_SYSTEM,
    fileStructure,
  };
}

// ── Game Blueprint ────────────────────────────────────────────────
export function generateGameBlueprint(gameType: string, theme: string, prompt: string): ProjectBlueprint {
  const checklist = getGameFeatures(gameType);
  const features = checklist
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10)
    .map(f => f.label);

  // "pages" for a game = the distinct screens/states
  const pages = ["Playing (main canvas)", "Pause Overlay", "Game Over Screen", "Win Screen"];

  const components = [
    "Canvas (#gameCanvas)", "HUD (score/level/lives)", "D-Pad (mobile)",
    "Action Buttons (mobile)", "Audio Engine (Web Audio beeps)", "Particle System",
  ];
  // add gameType-specific components based on checklist ids
  const idSet = new Set(checklist.map(f => f.id));
  if (idSet.has("enemies") || idSet.has("waves") || idSet.has("ghosts")) components.push("Enemy/AI Manager");
  if (idSet.has("coins") || idSet.has("powerups")) components.push("Collectibles Manager");
  if (idSet.has("towers")) components.push("Tower Placement Grid");
  if (idSet.has("inventory")) components.push("Inventory Panel");

  const backend = BACKEND_SUGGESTIONS["game"];

  const template = getGameTemplate(gameType);
  const fileStructure = [
    "index.html <head> — viewport meta, reset CSS, HUD/overlay/D-Pad styles",
    "index.html <body> — <canvas id=\"gameCanvas\">, #hud, overlay screens (#pauseScreen, #gameOverScreen, #winScreen), #dpad, #actions",
    "index.html <script> — canvas/resize setup, Web Audio init, input handling (keyboard+touch), state machine, " + (template ? "game-specific update()/render() logic" : "core game logic"),
    "index.html <script> — game loop (requestAnimationFrame) calling update() + render()",
  ];

  return {
    projectType: "game",
    features,
    pages,
    components,
    databaseTables: backend.tables,
    apiEndpoints: backend.endpoints,
    designSystem: GAME_DESIGN_SYSTEM,
    fileStructure,
  };
}

// ── Format blueprint as a prompt section ─────────────────────────
export function buildBlueprintPrompt(blueprint: ProjectBlueprint): string {
  return `PROJECT BLUEPRINT — build to this spec, do not start from a blank page:

Project Type: ${blueprint.projectType}

Pages/Screens (${blueprint.projectType === "game" ? "game states" : "anchor sections"}):
${blueprint.pages.map(p => `- ${p}`).join("\n")}

Reusable Components:
${blueprint.components.map(c => `- ${c}`).join("\n")}

Design System:
- Colors: primary ${blueprint.designSystem.colors.primary}, background ${blueprint.designSystem.colors.background}, text ${blueprint.designSystem.colors.text}, accent ${blueprint.designSystem.colors.accent}
- Fonts: ${blueprint.designSystem.fonts.heading} (headings), ${blueprint.designSystem.fonts.body} (body)
- Spacing: ${blueprint.designSystem.spacing}
- Style: ${blueprint.designSystem.style}

Top Priority Features:
${blueprint.features.slice(0, 8).map((f, i) => `${i + 1}. ${f}`).join("\n")}`;
}

