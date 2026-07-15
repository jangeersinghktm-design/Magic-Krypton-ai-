// lib/dependency-graph.ts
// Production Dependency Graph — tracks REAL, explicit dependencies
// between component types (not guessed at runtime). When a component
// changes, its dependents must also be considered stale, since their
// own content may reference or echo the changed component. Everything
// NOT reachable in the dependency graph from the changed component
// stays exactly as cached — no blanket invalidation.

import type { CachedComponentType } from "./component-cache";
import { invalidateComponentByType } from "./component-cache";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DEPENDENCY_GRAPH_VERSION = "v1";

/**
 * Real, explicit dependency edges: key = a component, value = the
 * components that DEPEND ON it (i.e. that should be reconsidered if the
 * key component changes). Based on genuine structural/content
 * relationships in how Krypton AI actually generates pages:
 *
 *  - navbar  → footer      (footer commonly echoes navbar's link structure)
 *  - hero    → cta         (hero's primary CTA copy/goal is often echoed by the page-level CTA section)
 *  - features → pricing    (pricing tiers commonly list which features are included)
 *  - pricing → faq         (FAQ commonly answers pricing-specific questions, e.g. "what's included in Pro")
 *  - pricing → cta         (CTA copy often references the pricing decision just shown)
 *  - testimonials → cta    (CTA sections sometimes echo social-proof framing from testimonials)
 */
const DEPENDENCY_GRAPH: Record<CachedComponentType, CachedComponentType[]> = {
  navbar:       ["footer"],
  hero:         ["cta"],
  features:     ["pricing"],
  stats:        [],
  pricing:      ["faq", "cta"],
  testimonials: ["cta"],
  faq:          [],
  cta:          [],
  footer:       [],
  portfolio:    [],
  dashboard:    [],
  ecommerce:    [],
};

export interface DependencyResolution {
  changed: CachedComponentType;
  directDependents: CachedComponentType[];
  transitiveDependents: CachedComponentType[];
  allAffected: CachedComponentType[]; // changed + every dependent, direct and transitive
  unaffected: CachedComponentType[];  // every other known component type — untouched, loads from cache
  graphVersion: string;
}

const ALL_TYPES: CachedComponentType[] = [
  "navbar", "hero", "features", "stats", "pricing", "testimonials",
  "faq", "cta", "footer", "portfolio", "dashboard", "ecommerce",
];

/**
 * Given the ONE component that actually changed, walks the real
 * dependency graph (breadth-first, cycle-safe) and returns every
 * component that must also be considered affected — direct dependents
 * and their own dependents, transitively. Everything else is returned
 * as `unaffected` and must load from cache, never regenerate.
 */
export function resolveDependents(changedComponent: CachedComponentType): DependencyResolution {
  const directDependents = DEPENDENCY_GRAPH[changedComponent] || [];

  const visited = new Set<CachedComponentType>([changedComponent]);
  const queue: CachedComponentType[] = [...directDependents];
  const transitiveOnly: CachedComponentType[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue; // cycle-safe — never revisits a node
    visited.add(current);
    if (!directDependents.includes(current)) transitiveOnly.push(current);
    const next = DEPENDENCY_GRAPH[current] || [];
    for (const n of next) if (!visited.has(n)) queue.push(n);
  }

  const allAffected = [changedComponent, ...directDependents, ...transitiveOnly];
  const uniqueAffected = [...new Set(allAffected)];
  const unaffected = ALL_TYPES.filter(t => !uniqueAffected.includes(t));

  return {
    changed: changedComponent,
    directDependents,
    transitiveDependents: transitiveOnly,
    allAffected: uniqueAffected,
    unaffected,
    graphVersion: DEPENDENCY_GRAPH_VERSION,
  };
}

/**
 * Real invalidation integration — when a component genuinely changes,
 * invalidates that component's cache entry AND every real dependent's
 * cache entry for this project, using the existing component_cache
 * invalidation function. Everything outside the resolved dependency set
 * is never touched.
 */
export async function invalidateDependentsCache(
  supabase: SupabaseClient,
  projectId: string,
  changedComponent: CachedComponentType,
  reason: string = "dependency_invalidation"
): Promise<DependencyResolution> {
  const resolution = resolveDependents(changedComponent);
  for (const type of resolution.allAffected) {
    await invalidateComponentByType(supabase, projectId, type, `${reason} (triggered by ${changedComponent} change)`);
  }
  console.log(`[dependency-graph v${DEPENDENCY_GRAPH_VERSION}] "${changedComponent}" changed -> invalidated: [${resolution.allAffected.join(", ")}] -> untouched (cache-only): [${resolution.unaffected.join(", ")}]`);
  return resolution;
}

/** Returns the raw edge list for a component — used for debugging/audit,
 *  never for silent runtime decisions outside resolveDependents(). */
export function getDependencyEdges(component: CachedComponentType): CachedComponentType[] {
  return [...(DEPENDENCY_GRAPH[component] || [])];
}

