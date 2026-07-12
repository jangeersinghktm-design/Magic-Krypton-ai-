// lib/rendering-engine/html-utils.ts
// Shared HTML/CSS post-processing utilities — image sanitization, luxury
// palette enforcement, responsive-heading enforcement, premium CSS
// effects per tone, HTML cleanup, and the FORCE_RULES prompt constant.
// Imported by BOTH orchestrate and generate routes.

import type { NicheProfile } from "./types";

export function sanitizeImageUrls(html: string, realUrls: string[]): string {
  if (realUrls.length === 0) return html;
  let urlIndex = 0;
  const nextUrl = () => realUrls[urlIndex++ % realUrls.length];

  // Replace any src="...unsplash.com..." or url(...unsplash.com...) that is
  // NOT one of our verified real URLs (AI-hallucinated ones get swapped out).
  const isOurUrl = (url: string) => realUrls.some(u => url.includes(u.split('?')[0]));

  // Fix <img src="...">
  html = html.replace(/(<img[^>]*\bsrc=["'])([^"']*unsplash\.com[^"']*)(["'])/gi, (match, pre, url, post) => {
    if (isOurUrl(url)) return match; // already a real URL, leave it
    return `${pre}${nextUrl()}${post}`;
  });

  // Fix CSS background-image: url('...')
  html = html.replace(/(background(?:-image)?:\s*url\(['"]?)([^'")]*unsplash\.com[^'")]*)(['"]?\))/gi, (match, pre, url, post) => {
    if (isOurUrl(url)) return match;
    return `${pre}${nextUrl()}${post}`;
  });

  // Also catch any other dead/placeholder patterns the AI might invent
  html = html.replace(/(<img[^>]*\bsrc=["'])(https?:\/\/source\.unsplash\.com[^"']*)(["'])/gi, (match, pre, url, post) => `${pre}${nextUrl()}${post}`);
  html = html.replace(/(<img[^>]*\bsrc=["'])(https?:\/\/via\.placeholder\.com[^"']*)(["'])/gi, (match, pre, url, post) => `${pre}${nextUrl()}${post}`);

  return html;
}


export function enforceLuxuryPalette(html: string, niche: NicheProfile): string {
  if (niche.marketLevel !== "luxury") return html;

  const p = niche.palette;
  // Cheap flat colors the AI sometimes defaults to, regardless of our
  // palette instructions — swap these for the correct muted-gold tones.
  const CHEAP_COLOR_SWAPS: [RegExp, string][] = [
    [/#FFD700/gi, p.primary],   // bright gold → antique gold
    [/#FFC107/gi, p.primary],
    [/#FFA500/gi, p.secondary], // bright orange → deep bronze
    [/#FF7A00/gi, p.secondary],
    [/#FFB000/gi, p.accent],
    [/#FFEB3B/gi, p.primary],
  ];
  for (const [re, replacement] of CHEAP_COLOR_SWAPS) {
    html = html.replace(re, replacement);
  }

  // If the generated CSS uses flat solid background on buttons/CTAs,
  // nudge toward the elegant gradient instead (best-effort regex swap
  // on common button background patterns using the primary color).
  html = html.replace(
    new RegExp(`background:\\s*${p.primary.replace('#','\\#')}([;\\s])`, 'gi'),
    `background:${p.grad}$1`
  );

  return html;
}


export function enforceResponsiveHeadings(html: string): string {
  // Convert "font-size: 48px" / "font-size:48px" on h1/h2/h3 rules to clamp().
  // Matches patterns like ".hero h1 { ... font-size: 48px; ... }" or
  // "h1 { font-size:56px; }" and rewrites just the font-size value.
  return html.replace(
    /(\bh[123][^{]*\{[^}]*?font-size:\s*)(\d+)(px\s*;)/gi,
    (match, pre, px, post) => {
      const size = parseInt(px, 10);
      if (size < 28) return match; // small text, fixed px is fine
      const min = Math.round(size * 0.55);
      const vw  = Math.round(size * 0.09 * 10) / 10; // gentle viewport scaling
      return `${pre}clamp(${min}px,${vw}vw,${size}px)${post}`;
    }
  );
}


export function getPremiumEffects(niche: NicheProfile, rgb: string): string {
  switch(niche.tone) {
    case "editorial":
      return `LUXURY EFFECTS:
- NO rounded corners (border-radius:0 or max 4px)
- Generous line-height on headings: 1.2+
- Subtle reveal animations (opacity 0→1, no translateY)
- Black/white photography with gold accent on hover
- Thin borders: 0.5px rgba(255,255,255,0.15)
- Large white space — let content breathe
- Serif headings, sans-serif body (elegant contrast)
- Gold dividers: <div style="width:40px;height:1px;background:var(--primary);margin:32px 0">
- No gradients on buttons — use outline style`;

    case "energetic":
      return `HIGH ENERGY EFFECTS:
- Diagonal section cuts: clip-path:polygon(0 0,100% 0,100% calc(100% - 40px),0 100%)
- Large bold numbers (stat counters with data-count attribute)
- Progress bars for achievements/goals
- Parallax background movement (mild)
- Hover: scale(1.03) on images — powerful
- Strong drop shadows: 0 20px 60px rgba(0,0,0,0.5)
- Before/after comparison (use CSS clip-path slider)
- Achievement badges with gradient backgrounds`;

    case "warm":
      return `WARM HOSPITALITY EFFECTS:
- Rounded corners everywhere: border-radius:24px+ 
- Warm overlay on food images: linear-gradient(to top, rgba(0,0,0,0.5), transparent)
- Image zoom on hover: transform:scale(1.05)
- Star ratings in accent color
- Menu cards with category badges
- Reservation form with elegant styling
- Map embed placeholder section
- Opening hours display`;

    case "trust":
      return `TRUST & AUTHORITY EFFECTS:
- Security badges: lock icon + "256-bit SSL encrypted"
- Data visualization: simple CSS charts/bars
- Certification logos grid
- Testimonial with company logo
- Real-time stats counter (data-count)
- Timeline/roadmap section
- Feature comparison table
- Subtle grid background overlay`;

    case "bold":
      return `CREATIVE BOLD EFFECTS:
- Portfolio grid: masonry-style or 2-col asymmetric
- Work cards with overlay on hover (project name + CTA)
- Large outlined text (outline style font): -webkit-text-stroke:2px var(--primary)
- Process numbered steps with connecting line
- Before/After results with specific numbers
- Awards and recognition section
- Team grid with hover flip effect`;

    default:
      return `CLEAN TECH EFFECTS:
- Glass morphism cards: backdrop-filter:blur(20px) + semi-transparent bg
- Feature icon boxes with gradient bg + glow shadow
- Browser/app mockup frame for product screenshot
- Code snippet block (dark bg, monospace font, colored syntax)
- Integration logos marquee
- Pricing cards with featured highlight
- Live demo CTA with preview thumbnail`;
  }
}


export function cleanHTML(raw: string): string {
  let html = raw.replace(/^html\s*/im,"").replace(/^\s*/im,"").replace(/\s*$/im,"").trim();
  const idx = html.indexOf("<!DOCTYPE");
  if (idx > 0) html = html.substring(idx);
  return html;
}


export const FORCE_RULES = `PRODUCTION REQUIREMENTS (enforced by quality gate):
• Complete HTML/CSS/JS — no placeholders, no TODO, no Lorem ipsum
• Responsive: 375px + 768px + 1440px all work correctly
• Must include: Navbar + Hero + Features + CTA + Footer (minimum)
• Scroll-reveal animations + hover states on all interactive elements
• Real copy specific to the user's niche — not generic filler`;

