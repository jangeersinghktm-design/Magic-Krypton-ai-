// lib/completion-engine/design-summary.ts
// Compact, user-facing Design Summary + Score Summary — built entirely
// from data the rendering engine already produced deterministically
// (NicheProfile, DomainBlueprint, ProductionGateResult). This file does
// NOT generate or influence any design decision — it only summarizes
// decisions that were already made, for display to the user. No AI call,
// no randomness, no invented data.
//
// This is intentionally separate from lib/rendering-engine/ — it reads
// that engine's output, it does not modify how that output is produced.

import type { NicheProfile } from "@/lib/rendering-engine/types";
import type { DomainBlueprint } from "@/lib/rendering-engine/domain-knowledge";
import type { ProductionGateResult, QualityDimension } from "./production-gate";

export interface ScoreSummary {
  overall: number;
  breakdown: Partial<Record<QualityDimension, number>>;
}

export interface DesignSummary {
  industry: string;
  positioning: string;         // e.g. "premium creative"
  primaryGoal: string;         // conversionGoal / businessGoal
  sectionOrder: string[];      // the actual, final section order used
  colorStrategy: string;       // one-line, human-readable
  typographyStrategy: string;
  trustSignals: string[];      // top objection/trust elements actually used
  scores: ScoreSummary;
}

/**
 * Builds a short, expandable Design Summary from real generation data.
 * Never exposes raw prompts, AI reasoning, or internal blueprint text —
 * only the concrete decisions (which section order, which palette
 * direction, which scores) that were deterministically produced.
 */
export function buildDesignSummary(
  niche: NicheProfile,
  gate: ProductionGateResult,
  domainPlan?: DomainBlueprint | null
): DesignSummary {
  const breakdown: Partial<Record<QualityDimension, number>> = {};
  for (const d of gate.dimensions) breakdown[d.dimension] = Math.round(d.score);

  return {
    industry: niche.industry,
    positioning: `${niche.marketLevel} ${niche.brandPositioning}`.trim(),
    primaryGoal: domainPlan?.businessGoal || niche.conversionGoal,
    sectionOrder: niche.sectionOrder,
    colorStrategy: domainPlan?.designDirectives?.colorMood || `${niche.tone}-toned palette for ${niche.industry.toLowerCase()}`,
    typographyStrategy: domainPlan?.designDirectives?.typographyFeel || `${niche.typography.headingFont} headings, ${niche.typography.bodyFont} body`,
    trustSignals: niche.trustElements.slice(0, 3),
    scores: { overall: gate.score, breakdown },
  };
}

