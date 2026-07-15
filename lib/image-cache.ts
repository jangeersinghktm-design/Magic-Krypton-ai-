// lib/image-cache.ts
// Smart Image Regeneration — a real, dedicated per-component image
// cache. When Hero changes, only Hero's image cache entry is
// invalidated/regenerated; every other component's cached images are
// reused untouched. Persistent (Supabase-backed), versioned, never
// in-memory-only.

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const IMAGE_CACHE_VERSION = "v1";

export type ImageSource = "unsplash" | "picsum" | "openai_dalle3" | "flux" | "ideogram" | "gemini_image";

export function computeImagePromptHash(prompt: string): string {
  return createHash("sha256").update(prompt.trim().toLowerCase()).digest("hex");
}

/** Deterministic, per-component, per-project image cache key. Changing
 *  project, component type, prompt, or version always produces a
 *  different key — identical inputs always produce the identical key,
 *  which is what makes "reuse unchanged images" and "regenerate only
 *  the changed component's image" both actually correct. */
export function computeImageCacheKey(
  projectId: string | null,
  componentType: string,
  promptHash: string,
  imageVersion: string = IMAGE_CACHE_VERSION
): string {
  const raw = `${projectId || "no-project"}::${componentType}::${promptHash}::${imageVersion}`;
  return createHash("sha256").update(raw).digest("hex");
}

export interface ImageCacheEntry {
  imageUrls: string[];
  imageSource: ImageSource;
  hit: boolean;
}

/** Real cache lookup. Returns null on any miss — invalidated, expired,
 *  version mismatch, or genuinely absent. Never throws (missing table
 *  falls through to a miss, same safe pattern as every other cache in
 *  this codebase). */
export async function getCachedImage(
  supabase: SupabaseClient,
  projectId: string | null,
  componentType: string,
  promptHash: string,
  imageVersion: string = IMAGE_CACHE_VERSION
): Promise<ImageCacheEntry | null> {
  const key = computeImageCacheKey(projectId, componentType, promptHash, imageVersion);
  try {
    const { data: cached } = await supabase
      .from("image_cache")
      .select("*")
      .eq("image_key", key)
      .maybeSingle();

    if (!cached) return null;

    const reasons: string[] = [];
    if (cached.invalidated) reasons.push("manually invalidated");
    if (cached.expires_at && new Date(cached.expires_at).getTime() < Date.now()) reasons.push("TTL expired");
    if (cached.prompt_hash !== promptHash) reasons.push("prompt hash mismatch");
    if (cached.image_version !== imageVersion) reasons.push("image version mismatch");

    if (reasons.length > 0) {
      console.log(`[image-cache] stale ${componentType} entry ignored (${reasons.join(", ")})`);
      return null;
    }
    if (!cached.image_urls || cached.image_urls.length === 0) return null;

    // Best-effort hit tracking — never blocks the read path.
    supabase.from("image_cache")
      .update({ hit_count: (cached.hit_count || 0) + 1, last_hit_at: new Date().toISOString() })
      .eq("image_key", key)
      .then(() => {}, () => {});

    return { imageUrls: cached.image_urls, imageSource: cached.image_source, hit: true };
  } catch {
    return null; // table may not exist yet — safe miss
  }
}

/** Stores (upserts) the resolved image URLs for one component. Only
 *  ever affects this exact project+component+prompt+version row. */
export async function setCachedImage(
  supabase: SupabaseClient,
  projectId: string | null,
  componentType: string,
  promptHash: string,
  imageUrls: string[],
  imageSource: ImageSource = "unsplash",
  imageVersion: string = IMAGE_CACHE_VERSION,
  ttlSeconds: number = 30 * 24 * 60 * 60
): Promise<void> {
  if (!imageUrls || imageUrls.length === 0) return;
  const key = computeImageCacheKey(projectId, componentType, promptHash, imageVersion);
  try {
    await supabase.from("image_cache").upsert({
      image_key:      key,
      project_id:     projectId,
      component_type: componentType,
      prompt_hash:    promptHash,
      image_version:  imageVersion,
      image_urls:     imageUrls,
      image_source:   imageSource,
      hit_count:      0,
      created_at:     new Date().toISOString(),
      expires_at:     new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      invalidated:    false,
    }, { onConflict: "image_key" });
  } catch { /* table may not exist yet — never blocks generation */ }
}

/** Invalidates one component's cached images for one project — e.g.
 *  "Hero changed" only invalidates Hero's image cache row, leaving
 *  every other component's cached images completely untouched. */
export async function invalidateComponentImageCache(
  supabase: SupabaseClient,
  projectId: string,
  componentType: string,
  reason: string = "component_changed"
): Promise<void> {
  try {
    await supabase.from("image_cache")
      .update({ invalidated: true, invalidated_reason: reason, invalidated_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .eq("component_type", componentType);
  } catch { /* never blocks */ }
}

/**
 * The real "get-or-fetch" entry point. Checks the cache first; on a hit,
 * returns the cached URLs with ZERO refetch. On a miss, calls the
 * provided fetcher (e.g. getRealImageSet) exactly once, stores the
 * result, and returns it. This is the mechanism that guarantees
 * "never refetch unchanged images" — a component whose content didn't
 * change always produces the same promptHash, so it always hits cache.
 */
export async function getOrFetchComponentImages(
  supabase: SupabaseClient,
  projectId: string | null,
  componentType: string,
  promptHash: string,
  fetcher: () => Promise<string[]>,
  imageSource: ImageSource = "unsplash",
  imageVersion: string = IMAGE_CACHE_VERSION
): Promise<{ imageUrls: string[]; fromCache: boolean }> {
  const cached = await getCachedImage(supabase, projectId, componentType, promptHash, imageVersion);
  if (cached) {
    console.log(`[image-cache] "${componentType}" -> HIT, reusing ${cached.imageUrls.length} image(s), zero refetch`);
    return { imageUrls: cached.imageUrls, fromCache: true };
  }
  console.log(`[image-cache] "${componentType}" -> MISS, fetching fresh images`);
  const imageUrls = await fetcher();
  await setCachedImage(supabase, projectId, componentType, promptHash, imageUrls, imageSource, imageVersion);
  return { imageUrls, fromCache: false };
}

