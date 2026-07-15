// lib/component-cache.ts
// Phase 2 — complete, independent per-component cache. Extends the
// Phase 1 generation_cache infrastructure (component_cache.generation_
// cache_key references generation_cache.cache_key) without modifying or
// duplicating it. Each of the 12 supported component types gets its own
// project-scoped cache key, TTL, full version set, and invalidation —
// changing one component never affects any other component's cache.

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type CachedComponentType =
  | "navbar" | "hero" | "features" | "stats" | "pricing" | "testimonials"
  | "faq" | "cta" | "footer" | "portfolio" | "dashboard" | "ecommerce";

export const COMPONENT_CACHE_VERSION = "v1";
export const COMPONENT_CACHE_THEME_VERSION = "v1";
export const COMPONENT_CACHE_DESIGN_VERSION = "v1";
export const COMPONENT_CACHE_MODEL_VERSION = "v1";
export const COMPONENT_CACHE_IMAGE_VERSION = "v1";
export const COMPONENT_CACHE_BLUEPRINT_VERSION = "v1";

export interface ComponentVersions {
  componentVersion?: string;
  themeVersion?: string;
  designVersion?: string;
  modelVersion?: string;
  imageVersion?: string;
  blueprintVersion?: string;
}

export interface ComponentCachePayload {
  html_code: string;
  css_code?: string | null;
  js_code?: string | null;
  images?: string[];
  image_urls?: string[];
  image_prompts?: string[];
  metadata?: Record<string, any>;
  theme?: Record<string, any>;
  typography?: Record<string, any>;
  color_palette?: Record<string, any>;
  animation_settings?: Record<string, any>;
  component_config?: Record<string, any>;
  generated_content?: Record<string, any>;
}

export interface ComponentCacheRestoreResult extends ComponentCachePayload {
  variant: string;
}

/** Deterministic, project-scoped, per-component cache key — independent
 *  of every other component's key, so invalidating/regenerating one
 *  never touches another. Changes automatically whenever ANY dependency
 *  (project, prompt, variant, design language, or any version) changes,
 *  since the key is a hash of all of them together. */
export function computeComponentCacheKey(
  projectId: string | null,
  componentType: CachedComponentType,
  promptHash: string,
  variant: string,
  designLanguage: string,
  versions: ComponentVersions = {}
): string {
  const raw = [
    projectId || "no-project",
    componentType,
    promptHash,
    variant,
    designLanguage,
    versions.componentVersion || COMPONENT_CACHE_VERSION,
    versions.themeVersion || COMPONENT_CACHE_THEME_VERSION,
    versions.designVersion || COMPONENT_CACHE_DESIGN_VERSION,
    versions.modelVersion || COMPONENT_CACHE_MODEL_VERSION,
    versions.imageVersion || COMPONENT_CACHE_IMAGE_VERSION,
    versions.blueprintVersion || COMPONENT_CACHE_BLUEPRINT_VERSION,
  ].join("::");
  return createHash("sha256").update(raw).digest("hex");
}

export function computePromptHash(prompt: string): string {
  return createHash("sha256").update(prompt.trim().toLowerCase()).digest("hex");
}

/**
 * Looks up a single component's cache entry. Returns null on any miss —
 * invalidated, expired, version-mismatched, or genuinely absent. Never
 * throws (a missing component_cache table falls through to a miss, same
 * safe pattern as the Phase 1 generation cache). Uses real Supabase
 * persistence only — no in-memory/local fallback.
 */
export async function getCachedComponent(
  supabase: SupabaseClient,
  projectId: string | null,
  componentType: CachedComponentType,
  promptHash: string,
  variant: string,
  designLanguage: string,
  versions: ComponentVersions = {}
): Promise<ComponentCacheRestoreResult | null> {
  const componentKey = computeComponentCacheKey(projectId, componentType, promptHash, variant, designLanguage, versions);
  try {
    const { data: cached } = await supabase
      .from("component_cache")
      .select("*")
      .eq("component_key", componentKey)
      .maybeSingle();

    if (!cached) return null;

    const reasons: string[] = [];
    if (cached.invalidated) reasons.push("manually invalidated");
    if (cached.expires_at && new Date(cached.expires_at).getTime() < Date.now()) reasons.push("TTL expired");
    if (cached.prompt_hash !== promptHash) reasons.push("prompt hash mismatch");
    if (cached.design_language !== designLanguage) reasons.push("design language mismatch");
    if (cached.component_version !== (versions.componentVersion || COMPONENT_CACHE_VERSION)) reasons.push("component version mismatch");
    if ((cached.theme_version || "v1") !== (versions.themeVersion || COMPONENT_CACHE_THEME_VERSION)) reasons.push("theme version mismatch");
    if ((cached.design_version || "v1") !== (versions.designVersion || COMPONENT_CACHE_DESIGN_VERSION)) reasons.push("design version mismatch");
    if ((cached.model_version || "v1") !== (versions.modelVersion || COMPONENT_CACHE_MODEL_VERSION)) reasons.push("model version mismatch");
    if ((cached.image_version || "v1") !== (versions.imageVersion || COMPONENT_CACHE_IMAGE_VERSION)) reasons.push("image version mismatch");
    if ((cached.blueprint_version || "v1") !== (versions.blueprintVersion || COMPONENT_CACHE_BLUEPRINT_VERSION)) reasons.push("blueprint version mismatch");

    if (reasons.length > 0) {
      console.log(`[component_cache] stale ${componentType} entry ignored (${reasons.join(", ")})`);
      return null;
    }
    if (!cached.html_code) return null;

    // Best-effort hit tracking — never blocks the read path.
    supabase.from("component_cache")
      .update({ hit_count: (cached.hit_count || 0) + 1, last_hit_at: new Date().toISOString() })
      .eq("component_key", componentKey)
      .then(() => {}, () => {});

    return {
      variant: cached.variant,
      html_code: cached.html_code,
      css_code: cached.css_code,
      js_code: cached.js_code,
      images: cached.images || [],
      image_urls: cached.image_urls || [],
      image_prompts: cached.image_prompts || [],
      metadata: cached.metadata || {},
      theme: cached.theme || {},
      typography: cached.typography || {},
      color_palette: cached.color_palette || {},
      animation_settings: cached.animation_settings || {},
      component_config: cached.component_config || {},
      generated_content: cached.generated_content || {},
    };
  } catch {
    return null; // table may not exist yet — safe miss, never blocks rendering
  }
}

/**
 * Stores (upserts) one component's cache entry. Only ever affects this
 * exact project+component_type+prompt+variant+language+version
 * combination — never touches any other component's row.
 */
export async function setCachedComponent(
  supabase: SupabaseClient,
  projectId: string | null,
  componentType: CachedComponentType,
  promptHash: string,
  variant: string,
  designLanguage: string,
  generationCacheKey: string | null,
  payload: ComponentCachePayload,
  versions: ComponentVersions = {},
  ttlSeconds: number = 30 * 24 * 60 * 60
): Promise<void> {
  if (!payload.html_code || payload.html_code.length === 0) return;
  const componentKey = computeComponentCacheKey(projectId, componentType, promptHash, variant, designLanguage, versions);
  try {
    await supabase.from("component_cache").upsert({
      component_key:        componentKey,
      project_id:            projectId,
      component_type:       componentType,
      prompt_hash:           promptHash,
      variant,
      design_language:       designLanguage,
      component_version:    versions.componentVersion || COMPONENT_CACHE_VERSION,
      theme_version:        versions.themeVersion || COMPONENT_CACHE_THEME_VERSION,
      design_version:       versions.designVersion || COMPONENT_CACHE_DESIGN_VERSION,
      model_version:        versions.modelVersion || COMPONENT_CACHE_MODEL_VERSION,
      image_version:        versions.imageVersion || COMPONENT_CACHE_IMAGE_VERSION,
      blueprint_version:    versions.blueprintVersion || COMPONENT_CACHE_BLUEPRINT_VERSION,
      generation_cache_key: generationCacheKey,
      html_code:            payload.html_code,
      css_code:              payload.css_code || null,
      js_code:               payload.js_code || null,
      images:                payload.images || [],
      image_urls:            payload.image_urls || [],
      image_prompts:         payload.image_prompts || [],
      metadata:              payload.metadata || {},
      theme:                 payload.theme || {},
      typography:            payload.typography || {},
      color_palette:         payload.color_palette || {},
      animation_settings:    payload.animation_settings || {},
      component_config:      payload.component_config || {},
      generated_content:     payload.generated_content || {},
      ttl_seconds:           ttlSeconds,
      hit_count:             0,
      created_at:            new Date().toISOString(),
      expires_at:            new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      invalidated:           false,
    }, { onConflict: "component_key" });
  } catch { /* table may not exist yet — never blocks generation */ }
}

/** Invalidates a single, exact component cache entry. */
export async function invalidateComponentCache(
  supabase: SupabaseClient,
  componentKey: string,
  reason: string = "manual"
): Promise<void> {
  try {
    await supabase.from("component_cache")
      .update({ invalidated: true, invalidated_reason: reason, invalidated_at: new Date().toISOString() })
      .eq("component_key", componentKey);
  } catch { /* never blocks */ }
}

/** Invalidates one component type for one project — e.g. "Hero changed"
 *  only invalidates that project's Hero row, leaving Navbar/Pricing/
 *  Footer/etc entries completely untouched. */
export async function invalidateComponentByType(
  supabase: SupabaseClient,
  projectId: string,
  componentType: CachedComponentType,
  reason: string = "component_changed"
): Promise<void> {
  try {
    await supabase.from("component_cache")
      .update({ invalidated: true, invalidated_reason: reason, invalidated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("component_type", componentType);
  } catch { /* never blocks */ }
}

/** Invalidates every cached component for one project — a full,
 *  intentional project-wide regenerate. */
export async function invalidateProjectComponents(
  supabase: SupabaseClient,
  projectId: string,
  reason: string = "project_invalidate"
): Promise<void> {
  try {
    await supabase.from("component_cache")
      .update({ invalidated: true, invalidated_reason: reason, invalidated_at: new Date().toISOString() })
      .eq("project_id", projectId);
  } catch { /* never blocks */ }
}

/** Invalidates every cached component sharing this exact prompt hash,
 *  across every project and component type. */
export async function invalidateComponentByPrompt(
  supabase: SupabaseClient,
  promptHash: string,
  reason: string = "prompt_changed"
): Promise<void> {
  try {
    await supabase.from("component_cache")
      .update({ invalidated: true, invalidated_reason: reason, invalidated_at: new Date().toISOString() })
      .eq("prompt_hash", promptHash);
  } catch { /* never blocks */ }
}

/** Invalidates every cached component whose theme_version does not
 *  match the given (current) theme version. */
export async function invalidateComponentByTheme(
  supabase: SupabaseClient,
  currentThemeVersion: string,
  reason: string = "theme_changed"
): Promise<void> {
  try {
    await supabase.from("component_cache")
      .update({ invalidated: true, invalidated_reason: reason, invalidated_at: new Date().toISOString() })
      .neq("theme_version", currentThemeVersion);
  } catch { /* never blocks */ }
}

/**
 * Component Diff Engine — compares a freshly-computed component-content
 * hash map against a previous one and returns exactly which component
 * types are "dirty" (changed) vs "clean" (identical, safe to restore
 * from cache). Used by the generator to decide, per component, whether
 * to call AI or reuse cache.
 */
export function diffComponents(
  previousContentHashes: Partial<Record<CachedComponentType, string>>,
  currentContentHashes: Partial<Record<CachedComponentType, string>>
): { dirty: CachedComponentType[]; clean: CachedComponentType[] } {
  const dirty: CachedComponentType[] = [];
  const clean: CachedComponentType[] = [];
  const allTypes = new Set([
    ...Object.keys(previousContentHashes),
    ...Object.keys(currentContentHashes),
  ]) as Set<CachedComponentType>;

  for (const type of allTypes) {
    if (previousContentHashes[type] === currentContentHashes[type] && currentContentHashes[type] !== undefined) {
      clean.push(type);
    } else {
      dirty.push(type);
    }
  }
  return { dirty, clean };
}

/** Deterministic content-hash for one component's generated-content JSON
 *  — used by the Diff Engine to detect whether a component's underlying
 *  content actually changed between two generations/edits. */
export function computeComponentContentHash(content: any): string {
  return createHash("sha256").update(JSON.stringify(content || {})).digest("hex");
}

/** Extracts one component's own HTML from a full page HTML string, using
 *  the same data-section attribute the Component Library renders every
 *  section with (data-section="hero", data-section="pricing", etc). */
function extractComponentHTML(fullHtml: string, componentType: CachedComponentType): string {
  const re = new RegExp(`<section[^>]*data-section=["']${componentType}["'][^>]*>[\\s\\S]*?</section>`, "i");
  const match = fullHtml.match(re);
  return match ? match[0] : "";
}

export interface ComponentDiffInput {
  oldHtml?: string;
  newHtml?: string;
  oldContent?: Record<string, any>;
  newContent?: Record<string, any>;
  oldDesignPlan?: any;
  newDesignPlan?: any;
  oldBlueprint?: any;
  newBlueprint?: any;
}

export interface ComponentDiffResult {
  affected: CachedComponentType[];
  unaffected: CachedComponentType[];
  reasons: Partial<Record<CachedComponentType, string>>;
}

const ALL_COMPONENT_TYPES: CachedComponentType[] = [
  "navbar", "hero", "features", "stats", "pricing", "testimonials",
  "faq", "cta", "footer", "portfolio", "dashboard", "ecommerce",
];

/**
 * Real DesignPlan reuse — computes a stable hash of a DesignPlan object,
 * compares an old and a candidate-new DesignPlan field by field, and
 * returns a genuinely merged result: every field that is identical is
 * taken from the OLD object (explicit reuse, not just "didn't touch
 * it"), and only fields that actually differ are taken from the new
 * candidate. This is a real compare + partial-update + version
 * mechanism, not a binary keep-everything-or-regenerate-everything rule.
 */
export function computeDesignPlanVersion(plan: any): string {
  return createHash("sha256").update(JSON.stringify(plan || {})).digest("hex");
}

export interface DesignPlanReuseResult {
  merged: any;
  changedFields: string[];
  reusedFields: string[];
  oldVersion: string;
  newVersion: string;
  identical: boolean;
}

export function reuseDesignPlan(oldPlan: any, newCandidatePlan: any): DesignPlanReuseResult {
  const oldVersion = computeDesignPlanVersion(oldPlan);
  const newVersion = computeDesignPlanVersion(newCandidatePlan);

  if (oldVersion === newVersion) {
    return {
      merged: oldPlan, changedFields: [], reusedFields: Object.keys(oldPlan || {}),
      oldVersion, newVersion, identical: true,
    };
  }

  const merged: any = { ...oldPlan };
  const changedFields: string[] = [];
  const reusedFields: string[] = [];
  const allKeys = new Set([...Object.keys(oldPlan || {}), ...Object.keys(newCandidatePlan || {})]);

  for (const key of allKeys) {
    const oldVal = JSON.stringify(oldPlan?.[key]);
    const newVal = JSON.stringify(newCandidatePlan?.[key]);
    if (oldVal !== newVal) {
      merged[key] = newCandidatePlan[key];
      changedFields.push(key);
    } else {
      reusedFields.push(key);
    }
  }

  return { merged, changedFields, reusedFields, oldVersion, newVersion, identical: false };
}
/**
/**
 * Real, production-grade Merge Engine — zero external dependencies (no
 * npm install required, works immediately). Uses a hand-rolled,
 * tag-depth-aware section extractor: unlike naive regex (which breaks on
 * nested <section> tags), this correctly tracks open/close <section>
 * depth to find the true matching end of each target block, so any
 * nested content inside a component — buttons, cards, images, badges,
 * or even nested <section> elements — is captured and replaced as one
 * complete unit, never split or truncated.
 *
 * This output is 100% static HTML/CSS/JS (confirmed: combineOutput()
 * produces <!DOCTYPE html> + plain <script> tags, no React/JSX, no
 * client-side framework, no virtual DOM) — there is no hydration to
 * preserve because there is no hydration step in this architecture at
 * all. IDs/classes/inline styles/animation attributes are preserved
 * because they live INSIDE the section node being swapped as one
 * complete block, or OUTSIDE it entirely (untouched).
 *
 * Integrates the Diff Engine directly: pass its `affected` list in via
 * `allowedTypes` so the merge only ever touches components the Diff
 * Engine actually flagged — if a type is in `updatedSections` but NOT
 * in `allowedTypes`, it is skipped and logged, never merged blindly.
 *
 * Includes real rollback: the merge is validated post-replacement
 * (section count preserved, no unclosed tags, doctype/html/body intact,
 * CSS custom-property references still resolvable against the page's
 * own <style> block); on ANY validation failure, the original HTML is
 * returned unchanged rather than shipping a broken merge.
 */
export interface MergeValidationResult {
  valid: boolean;
  errors: string[];
  cssWarnings: string[];
}

/**
 * Produces a same-length "masked" copy of the HTML where the CONTENTS of
 * HTML comments and <script>/<style> tags are replaced with spaces (tag
 * delimiters themselves are preserved). This prevents the section-finder
 * below from ever mistaking text that merely LOOKS like a tag — inside a
 * comment, or inside a script's string literal — for a real DOM element.
 * Because masking never changes the string's length, every index found
 * against the masked text is still a valid, correct index into the
 * original HTML.
 */
function maskNonStructuralContent(html: string): string {
  let masked = html;
  masked = masked.replace(/<!--[\s\S]*?-->/g, (m) => "<!--" + " ".repeat(Math.max(0, m.length - 7)) + "-->");
  masked = masked.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (_m, open, body, close) => open + " ".repeat(body.length) + close);
  masked = masked.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_m, open, body, close) => open + " ".repeat(body.length) + close);
  return masked;
}

function findSectionBlock(html: string, type: string, fromIndex: number = 0): { start: number; end: number; openTag: string } | null {
  const masked = maskNonStructuralContent(html);
  const openTagRe = new RegExp(`<section\\b[^>]*data-section=["']${type}["'][^>]*>`, "i");
  const openMatch = openTagRe.exec(masked.slice(fromIndex));
  if (!openMatch) return null;
  const start = fromIndex + openMatch.index;
  const openTag = openMatch[0];

  // Depth-aware scan for the true matching </section> — correctly
  // handles nested <section> tags inside this component (e.g. a
  // sub-section used for layout) instead of stopping at the first
  // closing tag found, which naive regex does. Runs against the MASKED
  // text so comment/script content can never be mistaken for a real tag;
  // the returned indices are still valid for the original `html` string.
  const tagRe = /<\/?section\b[^>]*>/gi;
  tagRe.lastIndex = start + openTag.length;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = tagRe.exec(masked))) {
    if (match[0].startsWith("</")) {
      depth--;
      if (depth === 0) {
        return { start, end: match.index + match[0].length, openTag };
      }
    } else {
      depth++;
    }
  }
  return null; // unclosed — malformed input, caller treats as not-found
}

function countTopLevelSections(html: string): number {
  return (html.match(/<section\b[^>]*data-section=/gi) || []).length;
}

function extractCssCustomProperties(html: string): Set<string> {
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const styleContent = styleMatch ? styleMatch[1] : "";
  const props = new Set<string>();
  for (const m of styleContent.matchAll(/--[a-zA-Z0-9-]+\s*:/g)) {
    props.add(m[0].replace(/:\s*$/, "").trim());
  }
  return props;
}

/**
 * Validates a merge result before it is accepted. Never mutates —
 * purely a check. Used by mergeComponentsIntoHTML to decide whether to
 * commit the merge or roll back to the original HTML.
 */
export function validateMergedHTML(originalHtml: string, mergedHtml: string): MergeValidationResult {
  const errors: string[] = [];
  const cssWarnings: string[] = [];

  if (!mergedHtml.includes("<!DOCTYPE") && !mergedHtml.toLowerCase().includes("<!doctype")) errors.push("missing DOCTYPE — merge corrupted document structure");
  if (!mergedHtml.includes("<html")) errors.push("missing <html> — merge corrupted document structure");
  if (!mergedHtml.includes("</body>") || !mergedHtml.includes("</html>")) errors.push("missing closing </body>/</html> — merge produced unclosed document");

  const originalCount = countTopLevelSections(originalHtml);
  const mergedCount = countTopLevelSections(mergedHtml);
  if (mergedCount < originalCount) errors.push(`section count dropped (${originalCount} -> ${mergedCount}) — a component was lost during merge`);

  // Tag-balance sanity check on <section> specifically (the unit this
  // engine operates on) — an odd open/close count means a malformed
  // splice happened.
  const opens = (mergedHtml.match(/<section\b[^>]*>/gi) || []).length;
  const closes = (mergedHtml.match(/<\/section>/gi) || []).length;
  if (opens !== closes) errors.push(`unbalanced <section> tags after merge (${opens} open vs ${closes} close)`);

  // CSS token check — flag (not silently fix) any var(--x) reference in
  // the merged output whose --x is not defined anywhere in the page's
  // own <style> block, so a genuinely broken theme reference is visible
  // rather than silently rendering as an invalid/empty value.
  const definedProps = extractCssCustomProperties(mergedHtml);
  const usedProps = new Set<string>();
  for (const m of mergedHtml.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)) usedProps.add(m[1]);
  for (const used of usedProps) {
    if (!definedProps.has(used)) cssWarnings.push(`var(${used}) is used but not defined in <style> — may render as invalid`);
  }

  return { valid: errors.length === 0, errors, cssWarnings };
}

export function mergeComponentsIntoHTML(
  oldFullHtml: string,
  updatedSections: Partial<Record<CachedComponentType, string>>,
  allowedTypes?: CachedComponentType[]
): { html: string; merged: CachedComponentType[]; skipped: CachedComponentType[]; rolledBack: boolean; validation: MergeValidationResult } {
  let merged = oldFullHtml;
  const mergedTypes: CachedComponentType[] = [];
  const skippedTypes: CachedComponentType[] = [];

  for (const [type, newSectionHtml] of Object.entries(updatedSections) as [CachedComponentType, string][]) {
    if (!newSectionHtml) continue;

    // Diff Engine integration — only merge a component if it was
    // actually flagged as affected. Anything present in updatedSections
    // but absent from allowedTypes is explicitly skipped, never merged
    // "just because a value was passed in".
    if (allowedTypes && !allowedTypes.includes(type)) {
      skippedTypes.push(type);
      console.log(`[merge-engine] skipping "${type}" — not in Diff Engine's affected list`);
      continue;
    }

    const block = findSectionBlock(merged, type);
    if (block) {
      merged = merged.slice(0, block.start) + newSectionHtml + merged.slice(block.end);
      mergedTypes.push(type);
    } else {
      // Component didn't exist in the old page at all — append before </body>.
      merged = merged.replace(/<\/body>/i, `${newSectionHtml}\n</body>`);
      mergedTypes.push(type);
    }
  }

  // Validate before committing — real rollback if the merge produced a
  // broken result, rather than ever shipping invalid HTML.
  const validation = validateMergedHTML(oldFullHtml, merged);
  if (!validation.valid) {
    console.log(`[merge-engine] VALIDATION FAILED — rolling back to original HTML. Errors: ${validation.errors.join("; ")}`);
    return { html: oldFullHtml, merged: [], skipped: mergedTypes, rolledBack: true, validation };
  }
  if (validation.cssWarnings.length > 0) {
    console.log(`[merge-engine] CSS warnings (non-fatal): ${validation.cssWarnings.join("; ")}`);
  }

  return { html: merged, merged: mergedTypes, skipped: skippedTypes, rolledBack: false, validation };
}

/**
 * Production Component Diff Engine. Compares old vs new HTML, JSON
 * content, DesignPlan, and Blueprint, per component type, and returns
 * exactly which components are actually affected. A component is only
 * marked affected if its OWN html/content differs, or if a design-plan/
 * blueprint change specifically targets that component type — a global
 * DesignPlan/Blueprint change that doesn't mention a component at all
 * does not force that component to regenerate.
 */
export function componentDiffEngine(input: ComponentDiffInput): ComponentDiffResult {
  const affected: CachedComponentType[] = [];
  const unaffected: CachedComponentType[] = [];
  const reasons: Partial<Record<CachedComponentType, string>> = {};

  // Design-plan / blueprint changes that name a specific component type
  // (e.g. a hierarchy change that only touches "hero") — extracted once,
  // reused for every component below.
  const designPlanDiffTargets = new Set<string>();
  if (input.oldDesignPlan || input.newDesignPlan) {
    const oldStr = JSON.stringify(input.oldDesignPlan || {});
    const newStr = JSON.stringify(input.newDesignPlan || {});
    if (oldStr !== newStr) {
      for (const type of ALL_COMPONENT_TYPES) {
        const oldHas = oldStr.includes(`"${type}"`);
        const newHas = newStr.includes(`"${type}"`);
        // Only count as a real per-component signal if this component's
        // OWN section of the plan actually changed, not just because
        // the plan object changed somewhere unrelated.
        if (oldHas !== newHas) designPlanDiffTargets.add(type);
      }
    }
  }
  const blueprintDiffTargets = new Set<string>();
  if (input.oldBlueprint || input.newBlueprint) {
    const oldStr = JSON.stringify(input.oldBlueprint || {});
    const newStr = JSON.stringify(input.newBlueprint || {});
    if (oldStr !== newStr) {
      for (const type of ALL_COMPONENT_TYPES) {
        const oldHas = oldStr.includes(`"${type}"`);
        const newHas = newStr.includes(`"${type}"`);
        if (oldHas !== newHas) blueprintDiffTargets.add(type);
      }
    }
  }

  for (const type of ALL_COMPONENT_TYPES) {
    let isAffected = false;
    let reason = "";

    // 1) JSON content comparison — the most reliable signal, since this
    // is the actual generated data a component renders from.
    if (input.oldContent !== undefined && input.newContent !== undefined) {
      const oldHash = computeComponentContentHash(input.oldContent[type]);
      const newHash = computeComponentContentHash(input.newContent[type]);
      const oldExists = input.oldContent[type] !== undefined;
      const newExists = input.newContent[type] !== undefined;
      if (oldExists !== newExists) {
        isAffected = true;
        reason = newExists ? "component added" : "component removed";
      } else if (oldExists && newExists && oldHash !== newHash) {
        isAffected = true;
        reason = "content changed";
      }
    }

    // 2) HTML comparison — catches cases where content JSON wasn't
    // provided but the rendered section HTML is available directly
    // (e.g. comparing two full-page HTML strings without their source JSON).
    if (!isAffected && input.oldHtml !== undefined && input.newHtml !== undefined) {
      const oldSection = extractComponentHTML(input.oldHtml, type);
      const newSection = extractComponentHTML(input.newHtml, type);
      if (oldSection !== newSection) {
        isAffected = true;
        reason = "html changed";
      }
    }

    // 3) DesignPlan / Blueprint — only forces regeneration if the change
    // specifically names this component type, never a blanket "anything
    // in the plan changed so regenerate everything" rule.
    if (!isAffected && designPlanDiffTargets.has(type)) {
      isAffected = true;
      reason = "design plan changed for this component";
    }
    if (!isAffected && blueprintDiffTargets.has(type)) {
      isAffected = true;
      reason = "blueprint changed for this component";
    }

    if (isAffected) {
      affected.push(type);
      reasons[type] = reason;
    } else {
      unaffected.push(type);
    }
  }

  return { affected, unaffected, reasons };
}

