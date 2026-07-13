/**
 * KRYPTON AI — Completion Engine: Quality Dimensions (v2)
 *
 * 6-dimension scoring per the Project Generation Engine spec:
 *   - Structure      : is the output a valid, well-formed document?
 *                       (derived from buildPass/buildIssues, not checklist items)
 *   - Functionality  : core mechanics/nav work (collision, loop, controls, links)
 *   - UX             : polish (sound, animation, restart, pause, theming)
 *   - Mobile         : touch controls, responsiveness, viewport
 *   - Performance    : derived from checkPerformance() heuristics
 *   - Completeness   : breadth of features (score, levels, sections, end-states,
 *                       persistence — previously "Reliability", folded in here)
 *
 * Functionality/UX/Mobile/Completeness are computed from checklist items
 * via keyword classification (unchanged approach — no need to edit the
 * ~280 existing FeatureCheck entries). Structure and Performance are
 * computed separately in production-gate.ts from buildPass/buildIssues
 * and checkPerformance() respectively, then merged into the same
 * DimensionScore[] array.
 */

export type QualityDimension = "Structure" | "Functionality" | "UX" | "Mobile" | "Performance" | "Completeness" | "Accessibility" | "SEO" | "Conversion";

export const ALL_DIMENSIONS: QualityDimension[] = ["Structure", "Functionality", "UX", "Mobile", "Performance", "Completeness", "Accessibility", "SEO", "Conversion"];

// Checklist-derived dimensions only (Structure & Performance come from elsewhere)
type ChecklistDimension = "Functionality" | "UX" | "Mobile" | "Completeness";

export function classifyDimension(id: string, label: string): ChecklistDimension {
  const s = `${id} ${label}`.toLowerCase();

  // Mobile — check first, most specific
  if (/mobile|touch|responsive|viewport/.test(s)) return "Mobile";

  // Completeness — breadth of features, end-states, persistence
  // (previously split out as "Reliability" — folded in here)
  if (/highscore|localstorage|save|persist|endstate|game.?over|win|victory|defeat|checkmate|lose|complete\b|gameover/.test(s)) {
    return "Completeness";
  }
  if (/score|level|lives|coin|powerup|power-up|achievement|inventory|quest|mission|economy|gold|currency|upgrade|xp|experience|section|footer|hero|nav|cta|testimonial|pricing|contact|form/.test(s)) {
    return "Completeness";
  }

  // UX — polish, feedback, audio, visual flair
  if (/sound|audio|particle|animation|restart|pause|theme|ui\b|hud|menu|transition|effect/.test(s)) {
    return "UX";
  }

  // Functionality — default: core mechanics
  return "Functionality";
}

export interface DimensionScore {
  dimension: QualityDimension;
  score: number;   // 0-100, normalized within this dimension
  total: number;   // sum of weights in this dimension (raw; 0 for Structure/Performance)
  earned: number;  // sum of weights earned in this dimension (raw; 0 for Structure/Performance)
}

/**
 * Computes the 4 checklist-derived dimension scores (Functionality, UX,
 * Mobile, Completeness) from passed/failed feature-checklist items.
 * Structure and Performance are NOT included here — production-gate.ts
 * appends them separately.
 */
export function computeChecklistDimensionScores(
  passed: { id: string; label: string; weight: number }[],
  failed: { id: string; label: string; weight: number }[]
): DimensionScore[] {
  const dims: ChecklistDimension[] = ["Functionality", "UX", "Mobile", "Completeness"];
  const totals: Record<ChecklistDimension, { earned: number; total: number }> = {
    Functionality: { earned: 0, total: 0 },
    UX:            { earned: 0, total: 0 },
    Mobile:        { earned: 0, total: 0 },
    Completeness:  { earned: 0, total: 0 },
  };

  for (const p of passed) {
    const dim = classifyDimension(p.id, p.label);
    totals[dim].earned += p.weight;
    totals[dim].total  += p.weight;
  }
  for (const f of failed) {
    const dim = classifyDimension(f.id, f.label);
    totals[dim].total += f.weight;
  }

  return dims.map(dim => {
    const { earned, total } = totals[dim];
    return {
      dimension: dim,
      score: total > 0 ? Math.round((earned / total) * 100) : 100,
      total,
      earned,
    };
  });
}

// Backward-compat alias (used by Phase-2 production-gate before the 6-dim restructure)
export const computeDimensionScores = computeChecklistDimensionScores;

