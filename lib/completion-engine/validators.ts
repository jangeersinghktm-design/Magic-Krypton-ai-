/**
 * KRYPTON AI — Completion Engine: Validators
 *
 * Static-analysis approximations for "Runtime Pass" and "Visual QA".
 *
 * IMPORTANT — INFRA NOTE:
 * True runtime validation (executing JS, catching ReferenceError etc.)
 * and true visual QA (rendering DOM, checking computed styles) require
 * a headless browser or JS sandbox VM. Neither is available in Vercel
 * Edge Runtime. These functions are heuristic proxies that catch the
 * most common failure classes (unbalanced brackets from truncated AI
 * output, blank bodies, invisible buttons, placeholder text) via pure
 * string/regex analysis — no execution, no DOM.
 *
 * Designed so a future Phase-2 service (Playwright-based) can replace
 * the body of these functions without changing their signatures.
 */

export interface SyntaxCheckResult {
  pass: boolean;
  errors: string[];
}

export interface VisualQAResult {
  pass: boolean;
  issues: string[];
}

export interface MobileCheckResult {
  pass: boolean;
  issues: string[];
}

// ── "Runtime Pass" proxy: bracket/brace/paren/string balance ───────
// Scans all <script>...</script> blocks. Tracks nesting of {, (, [
// while correctly skipping over string/template literals, regex
// literals (best-effort), and comments. Reports the single most
// common AI-truncation failure: ending mid-expression.
export function checkSyntaxBalance(html: string): SyntaxCheckResult {
  const errors: string[] = [];
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m => m[1]);

  if (scripts.length === 0) {
    return { pass: false, errors: ["No <script> block found"] };
  }

  for (let i = 0; i < scripts.length; i++) {
    const code = scripts[i];
    const result = scanBalance(code);
    if (!result.pass) {
      errors.push(`Script block ${i + 1}: ${result.errors.join("; ")}`);
    }
  }

  return { pass: errors.length === 0, errors };
}

function scanBalance(code: string): SyntaxCheckResult {
  const stack: { ch: string; pos: number }[] = [];
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const opens = new Set(["(", "[", "{"]);
  const closes = new Set([")", "]", "}"]);

  let i = 0;
  const len = code.length;
  let inLineComment = false;
  let inBlockComment = false;
  let stringChar: string | null = null; // ', ", or `
  let templateDepth = 0; // tracks ${ } inside template literals

  while (i < len) {
    const ch = code[i];
    const next = code[i + 1];

    if (inLineComment) {
      if (ch === "\n") inLineComment = false;
      i++; continue;
    }
    if (inBlockComment) {
      if (ch === "*" && next === "/") { inBlockComment = false; i += 2; continue; }
      i++; continue;
    }
    if (stringChar) {
      if (ch === "\\") { i += 2; continue; } // skip escaped char
      if (stringChar === "`" && ch === "$" && next === "{") {
        // ${ inside template literal — track as code, push special marker
        stack.push({ ch: "${", pos: i });
        templateDepth++;
        stringChar = null; // temporarily exit string mode to scan expression
        i += 2; continue;
      }
      if (ch === stringChar) { stringChar = null; i++; continue; }
      i++; continue;
    }

    // Not in string/comment — check for start of one
    if (ch === "/" && next === "/") { inLineComment = true; i += 2; continue; }
    if (ch === "/" && next === "*") { inBlockComment = true; i += 2; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { stringChar = ch; i++; continue; }

    // Handle closing of a ${...} back into template-literal string mode
    if (ch === "}" && templateDepth > 0 && stack.length && stack[stack.length - 1].ch === "${") {
      stack.pop();
      templateDepth--;
      stringChar = "`"; // resume template literal scanning
      i++; continue;
    }

    if (opens.has(ch)) { stack.push({ ch, pos: i }); i++; continue; }
    if (closes.has(ch)) {
      const expected = pairs[ch];
      if (stack.length === 0) {
        return { pass: false, errors: [`Unexpected closing '${ch}' at position ${i} with nothing open`] };
      }
      const top = stack[stack.length - 1];
      if (top.ch !== expected) {
        return { pass: false, errors: [`Mismatched bracket: found '${ch}' at ${i}, expected closer for '${top.ch}' opened at ${top.pos}`] };
      }
      stack.pop();
      i++; continue;
    }

    i++;
  }

  const errors: string[] = [];
  if (stringChar) errors.push(`Unterminated string/template literal (started with ${stringChar})`);
  if (inBlockComment) errors.push("Unterminated /* block comment */");
  if (stack.length > 0) {
    const unclosed = stack.map(s => `'${s.ch}' opened at ${s.pos}`).join(", ");
    errors.push(`${stack.length} unclosed bracket(s): ${unclosed}`);
  }

  return { pass: errors.length === 0, errors };
}

// ── "Visual QA" proxy: heuristic structural checks ──────────────────
export function checkVisualQA(html: string): VisualQAResult {
  const issues: string[] = [];

  // 1. Empty or near-empty <body>
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    const bodyText = bodyMatch[1]
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<[^>]+>/g, "")
      .trim();
    if (bodyText.length < 10 && !/<canvas/i.test(bodyMatch[1])) {
      issues.push("Body has almost no visible text content and no <canvas>");
    }
  } else {
    issues.push("No <body> tag found");
  }

  // 2. Root-level elements hidden via inline style
  if (/<body[^>]*style=["'][^"']*(?:display:\s*none|visibility:\s*hidden|opacity:\s*0)/i.test(html)) {
    issues.push("<body> itself is hidden (display:none / visibility:hidden / opacity:0)");
  }
  // A #app/#root/#game container hidden by default with no JS that un-hides it
  const hiddenRootMatch = html.match(/<div[^>]*id=["'](app|root|game|main|container)["'][^>]*style=["'][^"']*(?:display:\s*none|visibility:\s*hidden)/i);
  if (hiddenRootMatch) {
    const id = hiddenRootMatch[1];
    const unhidePattern = new RegExp(`getElementById\\(["']${id}["']\\)[^;]*\\.(?:style\\.display|style\\.visibility|classList)`, "i");
    if (!unhidePattern.test(html)) {
      issues.push(`#${id} is hidden by default and no script appears to un-hide it`);
    }
  }

  // 3. Interactive elements with no visible label/content
  const buttonsAndLinks = [...html.matchAll(/<(button|a)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];
  let emptyInteractive = 0;
  for (const m of buttonsAndLinks) {
    const attrs = m[2];
    const inner = m[3].replace(/<[^>]+>/g, "").trim();
    const hasAria = /aria-label=["'][^"']+["']/i.test(attrs);
    const hasTitle = /title=["'][^"']+["']/i.test(attrs);
    const hasIconClass = /class=["'][^"']*(icon|fa-|svg)/i.test(attrs) || /<svg/i.test(m[3]);
    if (!inner && !hasAria && !hasTitle && !hasIconClass) emptyInteractive++;
  }
  if (emptyInteractive > 0) {
    issues.push(`${emptyInteractive} button/link element(s) have no visible text, icon, or aria-label`);
  }

  // 4. Placeholder / unfinished content markers
  const placeholderPatterns = [
    /lorem ipsum/i,
    /\btodo\b/i,
    /coming soon/i,
    /\[insert/i,
    /placeholder\.(png|jpg|svg)/i,
    /your (text|content) here/i,
  ];
  for (const p of placeholderPatterns) {
    if (p.test(html)) { issues.push(`Placeholder content detected (matches ${p})`); break; }
  }

  // 5. Nav links pointing to "#" with no corresponding click handler / anchor target
  const hashLinks = [...html.matchAll(/<a[^>]*href=["']#([\w-]*)["'][^>]*>/gi)];
  let brokenHashLinks = 0;
  for (const m of hashLinks) {
    const target = m[1];
    if (!target) {
      // href="#" with no onclick handler on the same tag
      if (!/onclick=/i.test(m[0])) brokenHashLinks++;
    } else {
      // href="#section" — check an element with that id exists
      const idExists = new RegExp(`id=["']${target}["']`, "i").test(html);
      if (!idExists) brokenHashLinks++;
    }
  }
  if (brokenHashLinks > 0) {
    issues.push(`${brokenHashLinks} navigation link(s) point to "#" or a missing anchor with no handler`);
  }

  return { pass: issues.length === 0, issues };
}

// ── Mobile support check ─────────────────────────────────────────
export function checkMobileSupport(html: string): MobileCheckResult {
  const issues: string[] = [];

  if (!/<meta[^>]*name=["']viewport["']/i.test(html)) {
    issues.push("Missing <meta name=\"viewport\"> tag");
  }

  const hasTouchHandlers = /touchstart|touchend|touchmove/i.test(html);
  const hasMediaQueries  = /@media/i.test(html);
  const hasResponsiveUnits = /\b(vw|vh|%|rem|em)\b/.test(html);

  if (!hasTouchHandlers && !hasMediaQueries && !hasResponsiveUnits) {
    issues.push("No touch handlers, media queries, or responsive units found");
  }

  return { pass: issues.length === 0, issues };
}

// ── Performance check (heuristic, 0-100 score) ──────────────────
export interface PerformanceResult {
  score: number; // 0-100
  issues: string[];
}

// ── Smart Quality Gate 2.0 — Advanced structural/visual checks ──────
// Pure regex/string heuristics, Edge-compatible, zero extra AI calls.
// Detects the 10 most common "looks broken" failure classes that the
// original checklist-based audit doesn't catch on its own.
export interface AdvancedQualityResult {
  pass: boolean;
  issues: string[];
  autoFixable: string[]; // subset of `issues` that applyAutoRepairs() can fix mechanically
}

// WCAG relative luminance + contrast ratio (standard formula)
function hexToLuminance(hex: string): number | null {
  const m = hex.replace("#", "").match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrastRatio(hex1: string, hex2: string): number | null {
  const l1 = hexToLuminance(hex1), l2 = hexToLuminance(hex2);
  if (l1 === null || l2 === null) return null;
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

export function checkAdvancedQuality(html: string): AdvancedQualityResult {
  const issues: string[] = [];
  const autoFixable: string[] = [];

  // 1. Missing footer (hard check — website-checklist only weights this lightly)
  if (!/<footer\b/i.test(html)) {
    issues.push("Missing footer"); autoFixable.push("Missing footer");
  }

  // 2. Missing CTA (universal — not just landing-type pages)
  const ctaPattern = /get started|sign ?up|buy now|book now|contact us|subscribe|shop now|join free|schedule|request demo|try.*free|learn more|add to cart|download/i;
  if (!ctaPattern.test(html)) {
    issues.push("Missing call-to-action button"); autoFixable.push("Missing call-to-action button");
  }

  // 3. Mobile text overflow risk — fixed px width wider than mobile viewport, no max-width cap
  const fixedWideWidths = [...html.matchAll(/width:\s*(\d{3,})px/gi)].filter(m => parseInt(m[1], 10) > 420);
  const hasOverflowGuard = /overflow-x:\s*hidden/i.test(html) || /max-width:\s*100%/i.test(html);
  if (fixedWideWidths.length > 0 && !hasOverflowGuard) {
    issues.push(`${fixedWideWidths.length} element(s) with fixed width >420px and no overflow-x guard (mobile horizontal scroll risk)`);
  }

  // 4. Cropped headings — fixed px font-size on h1/h2/h3 (clamp() required for mobile safety)
  const fixedHeadingFonts = [...html.matchAll(/\bh[123][^{]*\{[^}]*?font-size:\s*(\d+)px/gi)].filter(m => parseInt(m[1], 10) >= 28);
  if (fixedHeadingFonts.length > 0) {
    issues.push(`${fixedHeadingFonts.length} heading(s) use fixed px font-size instead of clamp() — risk of word-per-line wrapping on mobile`);
    autoFixable.push("Cropped/fixed-px headings");
  }

  // 5. Poor spacing/padding — sections with zero or near-zero padding
  const sectionBlocks = [...html.matchAll(/<section\b[^>]*style=["']([^"']*)["']/gi)];
  const tightSections = sectionBlocks.filter(m => /padding:\s*0(?:px)?\s*[;"]/.test(m[1]) || /padding:\s*[0-4]px\s*[;"]/.test(m[1]));
  if (sectionBlocks.length > 0 && tightSections.length > 0) {
    issues.push(`${tightSections.length} section(s) have near-zero padding (cramped layout)`);
    autoFixable.push("Poor section spacing");
  }

  // 6. Broken navigation links — specifically inside <nav>...</nav>
  const navBlock = html.match(/<nav\b[^>]*>([\s\S]*?)<\/nav>/i);
  if (navBlock) {
    const navLinks = [...navBlock[1].matchAll(/<a[^>]*href=["']#([\w-]*)["']/gi)];
    let brokenNavLinks = 0;
    for (const m of navLinks) {
      const target = m[1];
      if (target && !new RegExp(`id=["']${target}["']`, "i").test(html)) brokenNavLinks++;
    }
    if (brokenNavLinks > 0) {
      issues.push(`${brokenNavLinks} navbar link(s) point to a missing section anchor`);
    }
  }

  // 7. Missing responsive breakpoints — must include an actual mobile-range breakpoint,
  // not just any @media rule (e.g. a print-only query shouldn't count)
  const mobileBreakpoint = /@media[^{]*\(\s*max-width:\s*(?:[1-9]\d{2}|[1-6]\d{2})px\s*\)/i.test(html);
  if (!mobileBreakpoint) {
    issues.push("No mobile-range @media breakpoint found (max-width: ~480-768px)");
    autoFixable.push("Missing responsive breakpoint");
  }

  // 8. Invisible buttons — text color matches background color (exact or near-exact hex match)
  const buttonStyles = [...html.matchAll(/<(?:button|a)[^>]*class=["'][^"']*btn[^"']*["'][^>]*style=["']([^"']*)["']/gi)];
  let invisibleButtons = 0;
  for (const m of buttonStyles) {
    const style = m[1];
    const color = style.match(/(?:^|;)\s*color:\s*(#[0-9a-f]{3,6})/i)?.[1];
    const bg = style.match(/background(?:-color)?:\s*(#[0-9a-f]{3,6})/i)?.[1];
    if (color && bg && color.toLowerCase() === bg.toLowerCase()) invisibleButtons++;
  }
  if (invisibleButtons > 0) {
    issues.push(`${invisibleButtons} button(s) have identical text and background color (invisible)`);
    autoFixable.push("Invisible buttons");
  }

  // 9. Low contrast text — scan :root CSS variables for text-vs-background pairs (WCAG AA = 4.5)
  const rootBlock = html.match(/:root\s*\{([^}]*)\}/i);
  if (rootBlock) {
    const vars: Record<string, string> = {};
    for (const m of rootBlock[1].matchAll(/--([\w-]+):\s*(#[0-9a-f]{3,6})/gi)) vars[m[1]] = m[2];
    const textVar = vars["text"] || vars["text-2"];
    const bgVar = vars["bg"] || vars["background"];
    if (textVar && bgVar) {
      const ratio = contrastRatio(textVar, bgVar);
      if (ratio !== null && ratio < 4.5) {
        issues.push(`Low contrast: --text vs --bg ratio is ${ratio.toFixed(1)}:1 (WCAG AA needs 4.5:1)`);
      }
    }
  }

  // 10. Empty sections — per-section near-zero text content (not just whole-body check)
  const allSections = [...html.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)];
  let emptySections = 0;
  for (const m of allSections) {
    const text = m[1].replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]+>/g, "").trim();
    if (text.length < 15) emptySections++;
  }
  if (emptySections > 0) {
    issues.push(`${emptySections} section(s) have almost no visible content`);
  }

  return { pass: issues.length === 0, issues, autoFixable };
}

// ── Auto-Repair — mechanically fixes what checkAdvancedQuality() flagged ──
// Zero AI calls. Only touches issues that are safely fixable via string
// transforms; anything needing real content/design judgment is left for
// the existing AI repair pass (see buildRepairInstructions in production-gate.ts).
export function applyAutoRepairs(html: string, advancedIssues: string[]): string {
  let fixed = html;

  // Fix: cropped/fixed-px headings → clamp()
  if (advancedIssues.includes("Cropped/fixed-px headings")) {
    fixed = fixed.replace(
      /(\bh[123][^{]*\{[^}]*?font-size:\s*)(\d+)(px)/gi,
      (match, pre, px, unit) => {
        const size = parseInt(px, 10);
        if (size < 28) return match;
        const min = Math.round(size * 0.55);
        const vw = Math.round(size * 0.09 * 10) / 10;
        return `${pre}clamp(${min}px,${vw}vw,${size}${unit})`;
      }
    );
  }

  // Fix: missing footer → inject a minimal real footer before </body>
  if (advancedIssues.includes("Missing footer")) {
    const footer = `<footer style="padding:48px 24px;text-align:center;border-top:1px solid rgba(255,255,255,0.08);"><p style="opacity:0.6;font-size:14px;">&copy; 2026 All rights reserved.</p></footer>`;
    fixed = fixed.replace(/<\/body>/i, `${footer}</body>`);
  }

  // Fix: missing CTA → inject a visible CTA button right after <body> opens
  // (best-effort placement; AI repair pass can reposition it more precisely later)
  if (advancedIssues.includes("Missing call-to-action button")) {
    const cta = `<div style="text-align:center;padding:16px;"><a href="#contact" class="btn" style="display:inline-block;padding:14px 32px;border-radius:10px;background:#6366F1;color:#fff;font-weight:700;text-decoration:none;">Get Started</a></div>`;
    fixed = fixed.replace(/(<body[^>]*>)/i, `$1${cta}`);
  }

  // Fix: missing responsive breakpoint → append a safe generic mobile breakpoint
  if (advancedIssues.includes("Missing responsive breakpoint")) {
    const breakpoint = `\n@media (max-width: 768px) { .container, section { padding-left: 16px; padding-right: 16px; } h1 { font-size: clamp(28px,8vw,42px); } }\n`;
    if (/<\/style>/i.test(fixed)) fixed = fixed.replace(/<\/style>/i, `${breakpoint}</style>`);
  }

  // Fix: poor section spacing → append an override rule (doesn't touch inline styles
  // directly to avoid breaking other declarations on the same line; CSS cascade wins)
  if (advancedIssues.includes("Poor section spacing")) {
    const spacingFix = `\nsection { padding-top: max(48px, 6vw) !important; padding-bottom: max(48px, 6vw) !important; }\n`;
    if (/<\/style>/i.test(fixed)) fixed = fixed.replace(/<\/style>/i, `${spacingFix}</style>`);
  }

  // Fix: invisible buttons → force a visible text color override via !important
  if (advancedIssues.includes("Invisible buttons")) {
    const buttonFix = `\n.btn, button, a.btn { color: #FFFFFF !important; }\n`;
    if (/<\/style>/i.test(fixed)) fixed = fixed.replace(/<\/style>/i, `${buttonFix}</style>`);
  }

  return fixed;
}

export function checkPerformance(html: string, kind: "game" | "website"): PerformanceResult {
  const checks: { ok: boolean; weight: number; issue: string }[] = [];

  if (kind === "game") {
    // Main loop should use requestAnimationFrame, not setInterval (jank/battery)
    checks.push({
      ok: /requestAnimationFrame/.test(html) && !/setInterval\([^,]*(update|loop|render|tick)/i.test(html),
      weight: 30,
      issue: "Game loop should use requestAnimationFrame, not setInterval",
    });
    // Canvas resize handled on 'resize' event (avoids stale fullscreen sizing)
    checks.push({
      ok: /addEventListener\(\s*['"]resize['"]/.test(html),
      weight: 15,
      issue: "No window resize handler for canvas (can leave stale dimensions)",
    });
    // Avoid creating new objects/arrays inside the render loop body every frame
    // (heuristic: render()/draw() function shouldn't contain 'new Array(' or 'new Image(')
    const renderFn = html.match(/function\s+(?:render|draw)\s*\([^)]*\)\s*\{([\s\S]{0,2000}?)\n\}/i);
    checks.push({
      ok: !renderFn || !/new (Array|Image)\(/.test(renderFn[1]),
      weight: 15,
      issue: "render()/draw() appears to allocate new Array/Image every frame",
    });
    // Audio: reuse a single AudioContext rather than creating one per sound
    const audioCtxCount = (html.match(/new \(window\.AudioContext/g) || []).length;
    checks.push({
      ok: audioCtxCount <= 1,
      weight: 20,
      issue: "Multiple AudioContext instances created (should reuse one)",
    });
    // requestAnimationFrame should be called recursively (continuous loop)
    checks.push({
      ok: (html.match(/requestAnimationFrame/g) || []).length >= 2,
      weight: 20,
      issue: "Game loop may not be self-sustaining (requestAnimationFrame called only once)",
    });
  } else {
    // Images should have width/height or loading="lazy" to avoid layout shift
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)];
    const badImgs = imgs.filter(m => !/loading=["']lazy["']/i.test(m[0]) && !(/width=/i.test(m[0]) && /height=/i.test(m[0])));
    checks.push({
      ok: imgs.length === 0 || badImgs.length === 0,
      weight: 20,
      issue: `${badImgs.length} <img> tag(s) missing loading="lazy" and width/height (layout shift risk)`,
    });
    // Animations should prefer transform/opacity over top/left/width/height (reflow cost)
    const animatesLayoutProps = /@keyframes[\s\S]*?\{[\s\S]*?(top|left|width|height)\s*:/i.test(html);
    checks.push({
      ok: !animatesLayoutProps,
      weight: 20,
      issue: "CSS @keyframes animate layout properties (top/left/width/height) instead of transform/opacity",
    });
    // Scroll-based reveal should use IntersectionObserver, not scroll event polling
    const hasScrollPolling = /addEventListener\(\s*['"]scroll['"][^)]*\)[\s\S]{0,80}(getBoundingClientRect|offsetTop)/i.test(html);
    checks.push({
      ok: !hasScrollPolling || /IntersectionObserver/.test(html),
      weight: 20,
      issue: "Scroll-position polling detected without IntersectionObserver (jank on scroll)",
    });
    // External resources should specify font-display or use preconnect for Google Fonts
    const usesGoogleFonts = /fonts\.googleapis\.com/i.test(html);
    checks.push({
      ok: !usesGoogleFonts || /display=swap/i.test(html) || /font-display:\s*swap/i.test(html),
      weight: 20,
      issue: "Google Fonts loaded without display=swap (causes invisible-text flash)",
    });
    // No more than a handful of inline <script> blocks (bundling proxy)
    const scriptCount = (html.match(/<script\b/gi) || []).length;
    checks.push({
      ok: scriptCount <= 3,
      weight: 20,
      issue: `${scriptCount} separate <script> blocks (consider consolidating)`,
    });
  }

  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.filter(c => c.ok).reduce((s, c) => s + c.weight, 0);
  const issues = checks.filter(c => !c.ok).map(c => c.issue);

  return { score: total > 0 ? Math.round((earned / total) * 100) : 100, issues };
}
