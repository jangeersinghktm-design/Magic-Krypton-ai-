// lib/preview-cache.ts
// Preview Cache — persistent, versioned cache of the fully-rendered
// preview HTML for a project. A preview is only ever regenerated
// (re-fetched/re-processed) when the underlying html_code actually
// changed (tracked via a real content hash, not a guess) or when it has
// genuinely expired/been invalidated.

import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export const PREVIEW_CACHE_HTML_VERSION = "v1";

export interface PreviewCacheEntry {
  previewHtml: string;
  previewVersion: string;
  hit: boolean;
}

/** Real content-hash of the page HTML — this IS the preview's version.
 *  Identical html_code always produces the identical version, so an
 *  unchanged page always hits cache; any real change always misses. */
export function computePreviewVersion(htmlCode: string): string {
  return createHash("sha256").update(htmlCode).digest("hex");
}

/**
 * Looks up the cached preview for a project. Returns null on any miss —
 * invalidated, expired, or the underlying HTML has genuinely changed
 * since this preview was cached (version mismatch). Never throws — a
 * missing preview_cache table falls through to a miss, same safe
 * pattern as the other caches in this codebase.
 */
export async function getPreviewCache(
  supabase: SupabaseClient,
  projectId: string,
  currentHtmlCode: string
): Promise<PreviewCacheEntry | null> {
  const currentVersion = computePreviewVersion(currentHtmlCode);
  try {
    const { data: cached } = await supabase
      .from("preview_cache")
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();

    if (!cached) return null;

    const reasons: string[] = [];
    if (cached.invalidated) reasons.push("manually invalidated");
    if (cached.expires_at && new Date(cached.expires_at).getTime() < Date.now()) reasons.push("TTL expired");
    if (cached.preview_version !== currentVersion) reasons.push("underlying HTML changed since this preview was cached");
    if (cached.html_version !== PREVIEW_CACHE_HTML_VERSION) reasons.push("html version mismatch");

    if (reasons.length > 0) {
      console.log(`[preview-cache] stale entry for project ${projectId} ignored (${reasons.join(", ")})`);
      return null;
    }

    // Best-effort hit tracking — never blocks the read path.
    supabase.from("preview_cache")
      .update({ hit_count: (cached.hit_count || 0) + 1, last_hit_at: new Date().toISOString() })
      .eq("project_id", projectId)
      .then(() => {}, () => {});

    return { previewHtml: cached.preview_html, previewVersion: cached.preview_version, hit: true };
  } catch {
    return null; // table may not exist yet — safe miss
  }
}

/** Stores (upserts) the rendered preview for a project. */
export async function setPreviewCache(
  supabase: SupabaseClient,
  projectId: string,
  htmlCode: string,
  ttlSeconds: number = 7 * 24 * 60 * 60
): Promise<void> {
  if (!htmlCode || htmlCode.length === 0) return;
  const previewVersion = computePreviewVersion(htmlCode);
  try {
    await supabase.from("preview_cache").upsert({
      project_id:       projectId,
      preview_html:     htmlCode,
      preview_version:  previewVersion,
      html_version:     PREVIEW_CACHE_HTML_VERSION,
      hit_count:        0,
      created_at:       new Date().toISOString(),
      expires_at:       new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      invalidated:      false,
    }, { onConflict: "project_id" });
  } catch { /* table may not exist yet — never blocks the caller */ }
}

/** Real invalidation — marks the cached preview stale so the next
 *  request is guaranteed to rebuild it, without deleting the row
 *  (preserves history/audit trail). */
export async function invalidatePreviewCache(
  supabase: SupabaseClient,
  projectId: string,
  reason: string = "manual"
): Promise<void> {
  try {
    await supabase.from("preview_cache")
      .update({ invalidated: true, invalidated_reason: reason, invalidated_at: new Date().toISOString() })
      .eq("project_id", projectId);
  } catch { /* never blocks */ }
}

/**
 * Force refresh — explicitly bypasses the cache regardless of version/
 * TTL/invalidated state, always returns null (forcing the caller to
 * rebuild), and immediately invalidates the stale row so nothing else
 * can accidentally reuse it in the meantime.
 */
export async function forceRefreshPreview(
  supabase: SupabaseClient,
  projectId: string
): Promise<null> {
  await invalidatePreviewCache(supabase, projectId, "force_refresh");
  return null;
}

/**
 * The real "get-or-build" entry point other code should call: returns
 * the cached preview if it's genuinely still valid for this exact HTML;
 * otherwise builds fresh from the given htmlCode, stores it, and
 * returns it. `forceRefresh=true` always rebuilds regardless of cache
 * state.
 */
export async function getOrBuildPreview(
  supabase: SupabaseClient,
  projectId: string,
  htmlCode: string,
  forceRefresh: boolean = false
): Promise<{ html: string; fromCache: boolean }> {
  if (forceRefresh) {
    await forceRefreshPreview(supabase, projectId);
  } else {
    const cached = await getPreviewCache(supabase, projectId, htmlCode);
    if (cached) return { html: cached.previewHtml, fromCache: true };
  }
  await setPreviewCache(supabase, projectId, htmlCode);
  return { html: htmlCode, fromCache: false };
}

