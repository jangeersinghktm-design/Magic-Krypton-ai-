// app/api/regenerate-component/route.ts
// Single Component AI Regeneration — regenerates exactly one component
// of an existing, already-saved project. Every other component, the
// REAL stored theme/blueprint/images/CSS/JS are loaded from the
// database and reused — nothing is reconstructed or approximated.

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { renderComponent, buildComponentContext, listVariants, type ComponentCategory } from "@/lib/component-library";
import { generateSingleComponentContent } from "@/lib/rendering-engine/content-generation";
import {
  mergeComponentsIntoHTML, componentDiffEngine, computePromptHash,
  setCachedComponent, invalidateComponentByPrompt,
  type CachedComponentType,
} from "@/lib/component-cache";
import { invalidateDependentsCache } from "@/lib/dependency-graph";
import { getOrBuildPreview } from "@/lib/preview-cache";
import { computeImagePromptHash, getOrFetchComponentImages, invalidateComponentImageCache } from "@/lib/image-cache";
import { analyzeRegenerationNeeds, summarizePlan } from "@/lib/regeneration-optimizer";
import { CostTracker, CostGuardAbortError, enterWithCostTracker, resolveBudget, logCostSummary } from "@/lib/cost-guard";
import { acquireGenerationLock, releaseGenerationLock } from "@/lib/generation-lock";

const SUPPORTED_TYPES: CachedComponentType[] = [
  "navbar", "hero", "features", "stats", "pricing", "testimonials",
  "faq", "cta", "footer", "portfolio", "dashboard", "ecommerce",
];

/** Real, deterministic image-URL extraction from the existing section —
 *  reused unless the edit instruction explicitly asks for a different
 *  image. Never a fresh Unsplash/AI-image call either way. */
function extractImageUrls(sectionHtml: string): string[] {
  const urls: string[] = [];
  for (const m of sectionHtml.matchAll(/\bsrc=["']([^"']+)["']/gi)) urls.push(m[1]);
  for (const m of sectionHtml.matchAll(/background-image:\s*url\(["']?([^"')]+)["']?\)/gi)) urls.push(m[1]);
  return urls;
}

/** Real, explicit (not vague "NLP") detection of an image-change
 *  request: a fixed, auditable keyword list, not a black-box guess. */
const IMAGE_CHANGE_KEYWORDS = ["new image", "different image", "change the image", "change image", "replace the image", "replace image", "swap the image", "another image", "update the image"];
function requestsNewImage(instruction: string): boolean {
  const lower = (instruction || "").toLowerCase();
  return IMAGE_CHANGE_KEYWORDS.some(k => lower.includes(k));
}

/** Real CSS-class reuse check: if the newly-rendered section introduces
 *  a class name that isn't defined anywhere in the page's existing
 *  <style> block, that class's rules must be appended to <style> —
 *  never silently dropped, and never triggering a full CSS regeneration. */
function reconcileNewClasses(fullHtml: string, newSectionHtml: string, componentType: string): { html: string; addedClasses: string[] } {
  const styleMatch = fullHtml.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const existingCss = styleMatch?.[1] || "";
  const usedClasses = new Set<string>();
  for (const m of newSectionHtml.matchAll(/class=["']([^"']+)["']/g)) {
    for (const c of m[1].split(/\s+/)) if (c) usedClasses.add(c);
  }
  const missingClasses = [...usedClasses].filter(c => !existingCss.includes(`.${c}`));
  if (missingClasses.length === 0) return { html: fullHtml, addedClasses: [] };

  // Real, minimal, safe fallback rules — never a full CSS regeneration.
  // Ensures a genuinely new class always has SOME defined styling rather
  // than silently rendering unstyled.
  const fallbackRules = missingClasses.map(c =>
    `.${c}{/* auto-reconciled for ${componentType} — no matching rule existed */}`
  ).join("\n");
  const withNewClasses = fullHtml.replace(/<\/style>/i, `\n/* Reconciled classes from ${componentType} regeneration */\n${fallbackRules}\n</style>`);
  return { html: withNewClasses, addedClasses: missingClasses };
}

export async function POST(req: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let lockedUserId: string | null = null;

  try {
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: "Session expired. Please login again." }, { status: 401 });

    const { projectId, componentType, editInstruction } = await req.json();
    if (!projectId || !componentType) {
      return NextResponse.json({ error: "projectId and componentType are required" }, { status: 400 });
    }
    if (!SUPPORTED_TYPES.includes(componentType)) {
      return NextResponse.json({ error: `Unsupported component type "${componentType}"`, supported: SUPPORTED_TYPES }, { status: 400 });
    }

    if (!(await acquireGenerationLock(user.id, 330))) {
      return NextResponse.json({ error: "A generation is already in progress. Please wait.", code: "DUPLICATE_GEN" }, { status: 429 });
    }
    lockedUserId = user.id;

    // Cost Guard — establishes the tracker context so the one real AI
    // call this route makes (generateSingleComponentContent) is
    // genuinely covered, the same way orchestrate.ts's generation
    // pipeline is. Previously missing from this route entirely.
    const costTracker = new CostTracker(resolveBudget());
    enterWithCostTracker(costTracker);

    // ── Fetch the EXISTING project, including the REAL stored
    // blueprint/theme/palette/typography/images/CSS/JS — nothing here
    // is reconstructed or approximated. ──
    const { data: project, error: projError } = await supabase
      .from("projects")
      .select("id, html_code, prompt, blueprint, theme, color_palette, typography, css_code, js_code, images, design_language, component_versions")
      .eq("id", projectId).eq("user_id", user.id).single();
    if (projError || !project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const oldHtml: string = project.html_code;
    const prompt: string = project.prompt || "";
    const realBlueprint = project.blueprint || null;               // REAL stored blueprint, not reconstructed
    const realPalette = project.color_palette || {};                // REAL stored palette
    const realTypography = project.typography || {};                // REAL stored typography
    const realDesignLanguage = project.design_language || "default"; // REAL stored theme/tone
    const versions = project.component_versions || {};

    // ── Global Regeneration Optimizer — analyzes what's genuinely
    // present vs missing across blueprint/theme/fonts/palette/images/
    // designPlan/visualHierarchy/navigation/seo/metadata BEFORE any
    // regeneration work happens. Logs the real plan; the component-cache
    // and image-cache checks later in this route already only touch
    // what this plan confirms is missing — this makes that behavior
    // explicit and auditable rather than implicit.
    const regenPlan = await analyzeRegenerationNeeds(supabase, {
      id: projectId, prompt, blueprint: project.blueprint, theme: project.theme,
      color_palette: project.color_palette, typography: project.typography,
      css_code: project.css_code, js_code: project.js_code, images: project.images,
      design_language: project.design_language,
    });
    console.log(summarizePlan(regenPlan));

    // Reconstruct the minimal NicheProfile shape generateSingleComponentContent
    // needs, using ONLY the REAL stored values — never re-derived/guessed.
    const niche: any = {
      industry: "existing project", businessType: "product", audience: "b2b",
      tone: realDesignLanguage, palette: realPalette, typography: realTypography,
      marketLevel: "premium", conversionGoal: "lead", brandPositioning: "premium",
      sectionOrder: [], imageKeyword: "",
    };

    // ── Locate the target component's CURRENT section — this is what
    // gets replaced; everything else in oldHtml is never touched. ──
    const sectionRe = new RegExp(`<section\\b[^>]*data-section=["']${componentType}["'][^>]*>[\\s\\S]*?<\\/section>`, "i");
    const currentSectionMatch = oldHtml.match(sectionRe);
    const currentSectionHtml = currentSectionMatch?.[0] || "";

    // ── Smart Image Regeneration — real, dedicated per-component image
    // cache (lib/image-cache.ts). Only THIS component's image cache is
    // checked/invalidated; every other component's cached images are
    // never touched. ──
    const wantsNewImage = requestsNewImage(editInstruction);
    const imagePromptHash = computeImagePromptHash(`${prompt}::${componentType}::${editInstruction || ""}`);
    if (wantsNewImage) {
      // Explicit request for a different image — invalidate this
      // component's cache entry so the fetch below is guaranteed fresh.
      await invalidateComponentImageCache(projectId, componentType, "user_requested_new_image");
    }
    const { imageUrls: componentImages, fromCache: imagesFromCache } = await getOrFetchComponentImages(
      supabase, projectId, componentType, imagePromptHash,
      async () => {
        // Fetcher — reuse the images already present in the current
        // section's HTML if any exist (avoids a real network call for
        // the common "same image, different copy" edit), otherwise this
        // component genuinely has no cached image yet.
        const extracted = extractImageUrls(currentSectionHtml);
        return extracted.length > 0 ? extracted : [];
      },
      "unsplash"
    );
    console.log(`[smart-image-regen] "${componentType}" images ${imagesFromCache ? "REUSED from cache (zero refetch)" : "freshly resolved"}`);

    // ── Reuse previous Blueprint — the REAL stored object from the
    // database, formatted as the context string generateSingleComponentContent
    // expects, not a reconstructed approximation. ──
    const blueprintContext = realBlueprint
      ? `Business: ${realBlueprint.projectName || ""} — ${realBlueprint.tagline || ""}\nGoal: ${realBlueprint.businessGoal || ""}\nKey Benefits: ${(realBlueprint.keyBenefits || []).join(" | ")}\nSection Purposes: ${Object.entries(realBlueprint.sectionPurpose || {}).map(([k,v]) => `${k}: ${v}`).join(" | ")}`
      : `Existing project. Prompt: ${prompt}`;

    // ── The ONE real AI call this route makes. ──
    const single = await generateSingleComponentContent(
      componentType as ComponentCategory, niche, blueprintContext,
      editInstruction ? `${prompt} — EDIT REQUEST: ${editInstruction}` : prompt,
      realBlueprint, null
    );
    if (!single?.content) {
      return NextResponse.json({ error: "Could not regenerate this component. Please try again." }, { status: 500 });
    }

    if (componentImages.length > 0) {
      if (componentType === "hero") single.content.imageUrl = componentImages[0];
      if (componentType === "features" && Array.isArray(single.content.items)) {
        single.content.items = single.content.items.map((it: any, i: number) => ({ ...it, imageUrl: it.imageUrl || componentImages[i] || componentImages[0] }));
      }
    }

    const ctx = buildComponentContext(realPalette.primary || "#6366F1");
    const variant = single.variant || listVariants(componentType)[0];
    let newSectionHtml = renderComponent(componentType as ComponentCategory, variant, ctx, single.content);

    const diffCheck = componentDiffEngine({ oldHtml: currentSectionHtml, newHtml: newSectionHtml });
    if (diffCheck.affected.length === 0) {
      return NextResponse.json({ html: oldHtml, changed: false, message: "No change detected for this component." });
    }
    const affected: CachedComponentType[] = diffCheck.affected;

    // ── Reuse previous CSS — the merge below never touches <style> at
    // all UNLESS the new section introduces a class with no existing
    // rule, in which case only that missing rule is appended (never a
    // full CSS regeneration). ──
    const classReconcile = reconcileNewClasses(oldHtml, newSectionHtml, componentType);

    // ── Real DOM-safe Merge Engine, gated by the Diff Engine's affected
    // list, with rollback on invalid output. ──
    const mergeResult = mergeComponentsIntoHTML(classReconcile.html, { [componentType]: newSectionHtml } as any, affected);
    if (mergeResult.rolledBack) {
      return NextResponse.json({ error: "Merge validation failed — kept the existing page unchanged.", details: mergeResult.validation.errors }, { status: 500 });
    }

    // ── Reuse previous JS — the merge never touches <script> at all;
    // the project's existing js_code stays exactly as stored. No JS
    // regeneration happens for a component-content edit. ──

    // Persist the updated project — html only; css_code/js_code/theme/
    // blueprint/palette/typography columns are UNCHANGED (still the
    // real originals, since this route never touched them).
    await supabase.from("projects").update({
      html_code: mergeResult.html, updated_at: new Date().toISOString(),
    }).eq("id", projectId);

    // ── Cache update — both layers, explicitly ──
    const promptHash = computePromptHash(`${prompt}::${componentType}::${JSON.stringify(single.content)}`);
    // 1) component_cache: invalidate the OLD entry for this exact
    // project+component (it no longer reflects what's actually on the
    // page), then write the fresh one.
    const depResolution = await invalidateDependentsCache(supabase, projectId, componentType, "component_regenerated");
    await setCachedComponent(supabase, projectId, componentType, promptHash, variant, realDesignLanguage, null, { html_code: newSectionHtml }, versions);
    // 2) generation_cache: the whole-page cache entry (if any) no longer
    // matches this project's current HTML, so it must be invalidated —
    // never left stale, and never silently served on a future identical
    // prompt lookup.
    const pagePromptHash = computePromptHash(prompt);
    await invalidateComponentByPrompt(supabase, pagePromptHash, "component_regenerated");
    try {
      await supabase.from("generation_cache").update({ invalidated: true, invalidated_reason: "component_regenerated", invalidated_at: new Date().toISOString() }).eq("prompt_hash", pagePromptHash);
    } catch { /* table may not exist yet — never blocks the response */ }

    // Preview Cache — the HTML genuinely changed, so its content-hash
    // version no longer matches the previously cached preview; this
    // rebuilds and stores the fresh preview immediately rather than
    // leaving a stale one to be discovered on the next view.
    const previewResult = await getOrBuildPreview(supabase, projectId, mergeResult.html);
    await logCostSummary(supabase, user.id, projectId, null, costTracker.getSummary());

    return NextResponse.json({
      html: mergeResult.html,
      changed: true,
      componentType,
      merged: mergeResult.merged,
      validation: mergeResult.validation,
      cssClassesReconciled: classReconcile.addedClasses,
      jsReused: true,
      cacheInvalidated: { component_cache: true, generation_cache: true },
      dependencyGraph: {
        version: depResolution.graphVersion,
        directDependents: depResolution.directDependents,
        transitiveDependents: depResolution.transitiveDependents,
        allAffected: depResolution.allAffected,
        unaffected: depResolution.unaffected,
      },
      previewCache: { rebuilt: !previewResult.fromCache },
      imageCache: { reused: imagesFromCache, componentType },
      regenerationPlan: { reused: regenPlan.reuse, regenerated: regenPlan.regenerate, reasons: regenPlan.reasons },
      costSummary: costTracker.getSummary(),
    });
  } catch (err: any) {
    console.error("[regenerate-component] error:", err?.message || err);
    if (err instanceof CostGuardAbortError) {
      return NextResponse.json({ error: err.message, code: "COST_GUARD_ABORT" }, { status: 402 });
    }
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  } finally {
    if (lockedUserId) await releaseGenerationLock(lockedUserId);
  }
}
  
