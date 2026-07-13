/**
 * KRYPTON AI — Completion Engine: Production Gate (v2)
 *
 * Unified entry point used by both /api/game and /api/orchestrate.
 *
 *   Build Pass      — structural HTML validity (doctype/html/script tags,
 *                      canvas for games, body content for websites)
 *   Validation Pass — feature-checklist score >= 80 (most core features present)
 *   Runtime Pass    — bracket/brace/paren/string balance in <script> (proxy
 *                      for "code runs without a syntax-level crash")
 *   Mobile Pass     — viewport meta + responsive/touch support
 *   Overall Pass    — all 4 gates true AND overall score >= 90 (target)
 *
 * Overall `score` is now the average of 6 dimensions:
 *   Structure, Functionality, UX, Mobile, Performance, Completeness
 * (Structure from buildPass/buildIssues; Performance from
 *  checkPerformance(); the other 4 from the feature checklist via
 *  lib/completion-engine/dimensions.)
 */

import { auditGameHTML, type AuditResult as GameAuditResult } from "@/lib/game-builder/quality-audit";
import { auditWebsiteHTML, type AuditResult as WebAuditResult } from "./website-checklist";
import { checkSyntaxBalance, checkVisualQA, checkMobileSupport, checkPerformance, checkAdvancedQuality, applyAutoRepairs } from "./validators";
import { computeChecklistDimensionScores, type DimensionScore, type QualityDimension } from "./dimensions";

export type ProductKind = "game" | "website";

export interface ProductionGateResult {
  buildPass:      boolean;
  validationPass: boolean;
  runtimePass:    boolean;
  mobilePass:     boolean;
  overallPass:    boolean;

  score:      number;       // 0-100 — average of the 6 dimension scores
  dimensions: DimensionScore[]; // 6 entries: Structure, Functionality, UX, Mobile, Performance, Completeness

  // Diagnostics for repair loop / UI
  failedFeatures: { id: string; label: string; weight: number }[];
  syntaxErrors:   string[];
  visualIssues:   string[];
  mobileIssues:   string[];
  buildIssues:    string[];
  performanceIssues: string[];
  advancedIssues: string[];   // Smart Quality Gate 2.0 — footer/CTA/contrast/etc
  autoFixableIssues: string[]; // subset of advancedIssues fixable without an AI call
}

const VALIDATION_PASS_THRESHOLD = 80;
const OVERALL_TARGET_SCORE      = 90; // lowered from 95 per Project Generation Engine spec

// ── Build Pass: structural validity ──────────────────────────────
function checkBuildPass(html: string, kind: ProductKind): { pass: boolean; issues: string[] } {
  const issues: string[] = [];
  const trimmed = html.trim();

  if (!trimmed.startsWith("<!DOCTYPE")) issues.push("Missing <!DOCTYPE html>");
  if (!/<\/html>\s*$/i.test(trimmed))   issues.push("Missing closing </html> (possible truncation)");
  if (!html.includes("<body"))          issues.push("Missing <body>");
  if (!html.includes("</script>"))      issues.push("Missing closed <script> block");
  if ((html.match(/<!DOCTYPE/gi) || []).length > 1) issues.push("Multiple <!DOCTYPE> (double-wrapped output)");
  if (html.includes("```"))             issues.push("Stray markdown code fence in output");

  if (kind === "game" && !html.includes("<canvas")) issues.push("Missing <canvas> element");
  if (html.length < 500) issues.push("Output too short to be a real product");

  return { pass: issues.length === 0, issues };
}

// Structure score: 100 if buildPass, otherwise scaled down per issue
function structureScore(buildIssues: string[]): number {
  if (buildIssues.length === 0) return 100;
  return Math.max(0, 100 - buildIssues.length * 25);
}

// ── Accessibility — deterministic, marker-based (never AI-guessed) ─────
function accessibilityScore(html: string): number {
  let score = 100;
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const imgsWithoutAlt = imgTags.filter(t => !/\balt\s*=\s*["'][^"']*["']/.test(t));
  if (imgTags.length > 0) score -= Math.min(30, (imgsWithoutAlt.length / imgTags.length) * 30);

  // Icon-only interactive elements (button/a with no text content, just an
  // emoji/icon) should have an accessible name via aria-label or title.
  const iconOnlyEls = html.match(/<(button|a)\b[^>]*>(\s*[^\w\s<]{1,4}\s*)<\/\1>/gi) || [];
  const iconOnlyMissingLabel = iconOnlyEls.filter(t => !/aria-label\s*=|title\s*=/.test(t));
  if (iconOnlyEls.length > 0) score -= Math.min(20, (iconOnlyMissingLabel.length / iconOnlyEls.length) * 20);

  if (!/<html[^>]*\blang\s*=/i.test(html)) score -= 10;

  const inputsWithoutLabel = (html.match(/<input\b(?![^>]*type\s*=\s*["'](hidden|submit|button)["'])[^>]*>/gi) || [])
    .filter(t => !/aria-label\s*=|id\s*=/.test(t)); // has id → could be matched by a <label for=...>, best-effort
  if (inputsWithoutLabel.length > 0) score -= 10;

  return Math.max(0, Math.round(score));
}

// ── SEO — deterministic, marker-based ───────────────────────────────────
function seoScore(html: string): number {
  let score = 100;
  if (!/<title>[^<]{3,}<\/title>/i.test(html)) score -= 20;
  if (!/<meta\s+name=["']description["']\s+content=["'][^"']{20,}["']/i.test(html)) score -= 20;
  const h1Count = (html.match(/<h1\b/gi) || []).length;
  if (h1Count === 0) score -= 20;
  else if (h1Count > 1) score -= 10; // multiple h1s hurt semantic clarity
  if (!/<meta\s+property=["']og:/i.test(html)) score -= 15;
  if (!/<meta\s+name=["']viewport["']/i.test(html)) score -= 15;
  return Math.max(0, Math.round(score));
}

// ── Conversion — deterministic, marker-based ────────────────────────────
function conversionScore(html: string): number {
  let score = 100;
  const ctaPattern = /get started|sign up|book now|contact us|buy now|start free|try free|request demo|apply now|join now|subscribe/i;
  if (!ctaPattern.test(html)) score -= 30;
  const hasTrustSignals = /testimonial|review|rating|trusted by|as seen in|customers|clients/i.test(html);
  if (!hasTrustSignals) score -= 25;
  const hasContactOrPricing = /<section[^>]*(pricing|contact)[^>]*>|id=["'](pricing|contact)["']/i.test(html);
  if (!hasContactOrPricing) score -= 20;
  return Math.max(0, Math.round(score));
}

export function runProductionGate(
  html: string,
  kind: ProductKind,
  subtype: string // gameType or projectType
): ProductionGateResult {
  const build = checkBuildPass(html, kind);

  const audit: GameAuditResult | WebAuditResult = kind === "game"
    ? auditGameHTML(html, subtype)
    : auditWebsiteHTML(html, subtype);

  const syntax  = checkSyntaxBalance(html);
  const visual  = checkVisualQA(html);
  const mobile  = checkMobileSupport(html);
  const perf    = checkPerformance(html, kind);
  // Smart Quality Gate 2.0 — website-specific (footer/CTA/contrast/nav/etc).
  // Games have different conventions (no footer/CTA expected), so this only
  // runs for websites — zero extra AI calls, pure heuristic analysis.
  const advanced = kind === "website"
    ? checkAdvancedQuality(html)
    : { pass: true, issues: [] as string[], autoFixable: [] as string[] };

  // 4 checklist-derived dimensions (Functionality/UX/Mobile/Completeness)
  const checklistDims = computeChecklistDimensionScores(audit.passed, audit.failed);

  // Add Structure and Performance as their own dimensions
  const dimensions: DimensionScore[] = [
    { dimension: "Structure" as QualityDimension, score: structureScore(build.issues), total: 0, earned: 0 },
    ...checklistDims.filter(d => d.dimension === "Functionality"),
    ...checklistDims.filter(d => d.dimension === "UX"),
    ...checklistDims.filter(d => d.dimension === "Mobile"),
    { dimension: "Performance" as QualityDimension, score: perf.score, total: 0, earned: 0 },
    ...checklistDims.filter(d => d.dimension === "Completeness"),
    ...(kind === "website" ? [
      { dimension: "Accessibility" as QualityDimension, score: accessibilityScore(html), total: 0, earned: 0 },
      { dimension: "SEO" as QualityDimension,           score: seoScore(html),           total: 0, earned: 0 },
      { dimension: "Conversion" as QualityDimension,    score: conversionScore(html),     total: 0, earned: 0 },
    ] : []),
  ];

  // Overall score = average of the 6 dimension scores
  const score = Math.round(dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length);

  const validationPass = audit.score >= VALIDATION_PASS_THRESHOLD;
  const runtimePass     = syntax.pass; // visual issues are warnings, syntax balance gates runtime
  const mobilePass      = mobile.pass;
  const buildPass       = build.pass;

  const overallPass = buildPass && validationPass && runtimePass && mobilePass
    && advanced.pass && score >= OVERALL_TARGET_SCORE;

  return {
    buildPass,
    validationPass,
    runtimePass,
    mobilePass,
    overallPass,
    score,
    dimensions,
    failedFeatures: audit.failed,
    syntaxErrors: syntax.errors,
    visualIssues: visual.issues,
    mobileIssues: mobile.issues,
    buildIssues: build.issues,
    performanceIssues: perf.issues,
    advancedIssues: advanced.issues,
    autoFixableIssues: advanced.autoFixable,
  };
}

/**
 * Builds a human-readable "fix this" instruction block for the repair
 * pass, combining failed checklist features, syntax errors, mobile
 * gaps, performance issues, and visual-QA issues into one prompt section.
 */
export function buildRepairInstructions(gate: ProductionGateResult): string {
  // ── Priority 1: CRITICAL (playability-breaking) issues ────────────
  // Build issues, syntax errors, and visual/playability issues (blank
  // screen, hidden roots, empty buttons, broken nav) make the output
  // non-functional. If ANY of these exist, the repair pass should fix
  // ONLY these — adding features/polish on top of broken code wastes
  // the repair attempt and often produces an even longer (more likely
  // to truncate) output without fixing the actual blank-screen cause.
  const critical: string[] = [];

  if (gate.buildIssues.length > 0) {
    critical.push(
      `BUILD ISSUES (fix first — these break the entire output):\n` +
      gate.buildIssues.map(i => `- ${i}`).join("\n")
    );
  }
  if (gate.syntaxErrors.length > 0) {
    critical.push(
      `SYNTAX ERRORS IN <script> (fix first — these cause a blank/broken page):\n` +
      gate.syntaxErrors.map(e => `- ${e}`).join("\n")
    );
  }
  if (gate.visualIssues.length > 0) {
    critical.push(
      `PLAYABILITY ISSUES (blank screen / hidden or unresponsive elements):\n` +
      gate.visualIssues.map(i => `- ${i}`).join("\n")
    );
  }

  if (critical.length > 0) {
    return (
      `CRITICAL — fix ONLY the issues below. Do NOT add new features, ` +
      `particles, animations, mobile controls, or other polish/optimizations ` +
      `in this pass — focus entirely on making the existing output WORK ` +
      `correctly first:\n\n` + critical.join("\n\n")
    );
  }

  // ── Priority 2: secondary (feature/polish) issues ──────────────────
  // Only reached when build/syntax/playability are already clean —
  // safe to spend this repair pass on completeness/mobile/performance.
  const sections: string[] = [];

  if (gate.failedFeatures.length > 0) {
    sections.push(
      `MISSING FEATURES:\n` + gate.failedFeatures.map(f => `- ${f.label}`).join("\n")
    );
  }
  // Smart Quality Gate 2.0 issues that auto-repair couldn't fix mechanically
  // (e.g. empty sections, low contrast, broken nav anchors — need real judgment)
  const remainingAdvanced = gate.advancedIssues.filter(i => !gate.autoFixableIssues.some(af => i.includes(af) || af === i));
  if (remainingAdvanced.length > 0) {
    sections.push(
      `QUALITY GATE 2.0 ISSUES:\n` + remainingAdvanced.map(i => `- ${i}`).join("\n")
    );
  }
  if (gate.mobileIssues.length > 0) {
    sections.push(
      `MOBILE ISSUES:\n` + gate.mobileIssues.map(i => `- ${i}`).join("\n")
    );
  }
  if (gate.performanceIssues.length > 0) {
    sections.push(
      `PERFORMANCE ISSUES (lower priority — optimize only after the above are addressed):\n` +
      gate.performanceIssues.map(i => `- ${i}`).join("\n")
    );
  }

  return sections.join("\n\n");
}

export const PRODUCTION_GATE_CONSTANTS = {
  VALIDATION_PASS_THRESHOLD,
  OVERALL_TARGET_SCORE,
};
  
