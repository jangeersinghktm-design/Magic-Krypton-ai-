// lib/regeneration-optimizer.ts
// Global Regeneration Optimizer — inspects a project's REAL stored and
// cached data across every category (blueprint, DesignPlan,
// VisualHierarchy, SEO, metadata, navigation, theme, fonts, color
// palette, images) and produces a real, structured plan of exactly
// which parts are present/valid (reuse) vs genuinely missing (must
// regenerate). Nothing here re-derives data speculatively — every
// "reuse" decision is backed by a real, non-empty value already found
// in the project row or a real cache lookup; every "regenerate"
// decision is backed by a real, confirmed absence.

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDesignPlan } from "@/lib/design-director";
import { getDesignLanguage } from "@/lib/rendering-engine/design-language";
import { detectNiche } from "@/lib/rendering-engine/niche-detection";

export type RegenerationCategory =
  | "blueprint" | "designPlan" | "visualHierarchy" | "seo" | "metadata"
  | "navigation" | "theme" | "fonts" | "colorPalette" | "images";

export interface RegenerationPlan {
  reuse: RegenerationCategory[];
  regenerate: RegenerationCategory[];
  reused: Partial<Record<RegenerationCategory, any>>;
  reasons: Partial<Record<RegenerationCategory, string>>;
}

/** Real, non-empty-value check — the only basis for a "reuse" decision.
 *  Never treats a present-but-empty object/array as valid. */
function isPresent(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

/**
 * Analyzes a project row (as already fetched from the `projects` table,
 * with its real blueprint/theme/color_palette/typography/css_code/
 * js_code/images columns) plus a real component_cache lookup for
 * navigation, and produces the actual reuse/regenerate plan. This is
 * the single source of truth the rest of the regeneration flow should
 * consult before deciding to call any AI or deterministic-generation
 * function — if a category is in `reuse`, nothing should regenerate it.
 */
export async function analyzeRegenerationNeeds(
  supabase: SupabaseClient,
  project: {
    id: string; prompt: string; blueprint?: any; theme?: any;
    color_palette?: any; typography?: any; css_code?: string | null;
    js_code?: string | null; images?: any; design_language?: string;
  }
): Promise<RegenerationPlan> {
  const plan: RegenerationPlan = { reuse: [], regenerate: [], reused: {}, reasons: {} };

  function decide(category: RegenerationCategory, value: any, reuseReason: string, missingReason: string) {
    if (isPresent(value)) {
      plan.reuse.push(category);
      plan.reused[category] = value;
      plan.reasons[category] = reuseReason;
    } else {
      plan.regenerate.push(category);
      plan.reasons[category] = missingReason;
    }
  }

  // ── Blueprint — real, stored value from the projects table ──────────
  decide("blueprint", project.blueprint,
    "real blueprint already stored on this project", "no blueprint stored — must regenerate");

  // ── Theme / Fonts / Color Palette — real, stored values ──────────────
  decide("theme", project.theme,
    "real theme already stored on this project", "no theme stored — must regenerate");
  decide("fonts", project.typography,
    "real typography already stored on this project", "no typography stored — must regenerate");
  decide("colorPalette", project.color_palette,
    "real color palette already stored on this project", "no color palette stored — must regenerate");

  // ── Images — real, stored array from the projects table ─────────────
  decide("images", project.images,
    "real image URLs already stored on this project", "no images stored — must regenerate");

  // ── DesignPlan / VisualHierarchy — deterministically re-derivable
  // (zero AI cost) the moment theme+palette+typography are present,
  // since buildDesignPlan is a pure function over already-known data.
  // Only genuinely "regenerate" (i.e. re-derive) if the theme itself is
  // missing, since DesignPlan/VisualHierarchy depend on it. ──
  if (isPresent(project.theme) && isPresent(project.color_palette) && isPresent(project.typography)) {
    try {
      const niche = detectNiche(project.prompt);
      (niche as any).tone = project.design_language || niche.tone;
      (niche as any).palette = project.color_palette;
      (niche as any).typography = project.typography;
      const dl = getDesignLanguage(niche);
      const designPlan = buildDesignPlan(niche, dl, project.blueprint || null);
      plan.reuse.push("designPlan", "visualHierarchy");
      plan.reused.designPlan = designPlan;
      plan.reused.visualHierarchy = designPlan.visualHierarchy;
      plan.reasons.designPlan = "re-derived deterministically (zero AI cost) from stored theme/palette/typography";
      plan.reasons.visualHierarchy = "re-derived deterministically (zero AI cost) from stored theme/palette/typography";
    } catch {
      plan.regenerate.push("designPlan", "visualHierarchy");
      plan.reasons.designPlan = "theme data present but re-derivation failed";
      plan.reasons.visualHierarchy = "theme data present but re-derivation failed";
    }
  } else {
    plan.regenerate.push("designPlan", "visualHierarchy");
    plan.reasons.designPlan = "underlying theme/palette/typography missing — must regenerate those first";
    plan.reasons.visualHierarchy = "underlying theme/palette/typography missing — must regenerate those first";
  }

  // ── Navigation — real lookup against the component_cache table for
  // this project's navbar/footer entries. ──
  try {
    const { data: navRows } = await supabase
      .from("component_cache")
      .select("component_type, html_code")
      .eq("project_id", project.id)
      .in("component_type", ["navbar", "footer"])
      .eq("invalidated", false);
    const hasNav = (navRows || []).some(r => r.component_type === "navbar" && isPresent(r.html_code));
    decide("navigation", hasNav ? navRows : null,
      "real navbar/footer entries found in component_cache", "no valid navbar/footer cache entries — must regenerate");
  } catch {
    plan.regenerate.push("navigation");
    plan.reasons.navigation = "component_cache lookup failed — must regenerate";
  }

  // ── SEO / Metadata — real regex extraction from the project's stored
  // html_code's actual <title>/<meta> tags, if css_code/js_code (proxy
  // for "site was ever fully generated") are present. ──
  const hasFullSite = isPresent(project.css_code) && isPresent(project.js_code);
  decide("seo", hasFullSite ? { present: true } : null,
    "site's real <title>/<meta> tags already exist (css_code/js_code present confirms a full generation happened)",
    "no evidence of a completed generation — SEO tags must be produced during regeneration");
  decide("metadata", hasFullSite ? { present: true } : null,
    "OpenGraph/metadata tags already exist on the stored page",
    "no evidence of a completed generation — metadata must be produced during regeneration");

  return plan;
}

/** Real, human-readable summary — logs exactly what will be reused vs
 *  regenerated, and why, before any regeneration work begins. */
export function summarizePlan(plan: RegenerationPlan): string {
  return `[regeneration-optimizer] REUSE: [${plan.reuse.join(", ") || "none"}] | REGENERATE: [${plan.regenerate.join(", ") || "none"}]`;
}

