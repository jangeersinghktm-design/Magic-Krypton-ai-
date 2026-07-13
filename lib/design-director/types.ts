// lib/design-director/types.ts
// The AI Design Director's core types — DesignPlan is the single,
// consolidated source of truth built once per generation from real,
// already-computed data (NicheProfile + DomainBlueprint). This does NOT
// replace or modify the rendering engine's own data (niche/domainPlan) —
// it consolidates them into one object and adds a genuinely new,
// deterministic VisualHierarchy computation that actually influences
// which components get chosen (not just an informational summary).

import type { NicheProfile } from "@/lib/rendering-engine/types";
import type { DomainBlueprint } from "@/lib/rendering-engine/domain-knowledge";

export type PrimaryFocus = "conversion" | "trust" | "brand" | "information";

export interface VisualHierarchy {
  primaryFocus: PrimaryFocus;
  secondaryFocus: PrimaryFocus;
  ctaPriority: "high" | "medium" | "low";
  readingOrder: string[];        // the actual section order this generation will use
  whitespaceRhythm: "generous" | "balanced" | "tight";
  visualBalance: "symmetric" | "asymmetric";
}

export interface DesignPlan {
  industry: string;
  businessType: string;
  audience: string;
  brandPersonality: string;
  designLanguage: string;        // the tone name actually selected for this generation
  layoutStrategy: string[];      // = readingOrder, kept for explicit naming per spec
  visualHierarchy: VisualHierarchy;
  typographyPlan: { headingFont: string; bodyFont: string; weight: string };
  colorPlan: { primary: string; secondary: string; accent: string };
  spacingPlan: string;
  componentPlan: string[];       // which component categories this page will use
  animationPlan: string;
  responsivePlan: string;
  qualityTarget: number;
}

