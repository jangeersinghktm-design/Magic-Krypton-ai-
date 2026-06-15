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

