// lib/design-engine.ts
// Shared seeded-random Design Diversity Engine — used by BOTH
// app/api/orchestrate/route.ts and app/api/multipage/route.ts so every
// generation path draws from the exact same deterministic system.
// No Math.random() anywhere — seed comes from crypto.randomUUID() once
// per generation, everything downstream derives from that seed.

import { listVariants, type ComponentCategory } from "@/lib/component-library";

// mulberry32 — compact, well-known deterministic PRNG.
export function createSeededRandom(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generationSeedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) { h = (Math.imul(31, h) + id.charCodeAt(i)) | 0; }
  return h;
}

/** Picks a real component-library variant name for the given category,
 *  deterministically from the seed. Caller passes in listVariants(category)
 *  so this file has no dependency on the component-library module shape. */
export function pickVariantFromSeed(options: string[], category: string, seed: number): string {
  if (!options.length) return "";
  const categoryOffset = category.split("").reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0);
  const rng = createSeededRandom((seed ^ categoryOffset) | 0);
  return options[Math.floor(rng() * options.length)];
}

/** Convenience wrapper — picks a real component-library variant for a
 *  category directly from its name, without the caller needing to import
 *  listVariants() itself first. Used by assembleFromComponentLibrary. */
export function pickComponentVariant(category: string, seed: number): string {
  return pickVariantFromSeed(listVariants(category as ComponentCategory), category, seed);
}
