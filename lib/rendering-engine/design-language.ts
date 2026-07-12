// lib/rendering-engine/design-language.ts
// Shared Design Language system — translates a niche's tone into real
// CSS instructions (card/button/hero style, motion, spacing, effects).
// Imported by BOTH orchestrate and generate routes.

import type { NicheProfile } from "./types";

export interface DesignLanguage {
  name: string;              // Apple / Stripe / Nike / Airbnb / Linear / Editorial Luxury
  cardStyle: string;         // CSS for cards
  buttonStyle: string;       // CSS for buttons
  heroStyle: string;         // CSS for hero
  sectionBg: string[];       // alternating section backgrounds
  effectsCSS: string;        // premium effects CSS
  spacing: string;           // spacing philosophy
  // ── Visual Intelligence Extensions ─────────────────────────────────
  motionStyle: string;       // how animations behave for this domain
  imageDirection: string;    // photography/imagery direction for AI prompt
  componentDensity: string;  // generous | balanced | tight | data-heavy
  premiumLevel: number;      // 1-10: used to bias CSS quality and complexity
  colorTemperature: string;  // warm | cool | neutral | vibrant — palette mood
  typographyScale: string;   // compact | normal | editorial | display
  borderRadius: string;      // sharp (0px) | subtle (4px) | rounded (12px) | pill (999px)
  shadowDepth: string;       // flat | subtle | medium | dramatic | glow
}

export function getDesignLanguage(niche: NicheProfile): DesignLanguage {
  const p = niche.palette;
  const rgb = hexToRgbValues(p.primary);

  switch(niche.tone) {

    // ── EDITORIAL (Luxury, Perfume, Fashion) — "Bottega Veneta" style
    case "editorial":
      return {
        name: "Editorial Luxury",
        cardStyle: `background:transparent; border:none; border-bottom:1px solid rgba(255,255,255,0.1); border-radius:0; padding:40px 0;`,
        buttonStyle: `border-radius:0; letter-spacing:0.15em; text-transform:uppercase; font-size:12px; padding:18px 48px; background:transparent; border:1px solid var(--primary); color:var(--primary);`,
        heroStyle: `background:var(--bg); min-height:100vh; display:grid; place-items:center;`,
        sectionBg: [p.bg, p.surface, p.bg],
        effectsCSS: `
/* Luxury: No rounded corners, editorial spacing, refined micro-animations */
.luxury-divider { width:40px; height:1px; background:var(--primary); margin:24px 0; }
.luxury-number { font-family:var(--heading-font); font-size:clamp(80px,15vw,200px); font-weight:300; opacity:0.08; position:absolute; top:-20px; left:-10px; line-height:1; color:var(--primary); pointer-events:none; }
.luxury-img { filter:brightness(0.9) contrast(1.1); transition:filter 0.6s ease; }
.luxury-img:hover { filter:brightness(1) contrast(1.05) saturate(1.1); }
img { border-radius:0 !important; }
.btn { border-radius:0 !important; }
.card { border-radius:4px !important; }
@keyframes luxuryReveal { from{opacity:0;letter-spacing:0.3em} to{opacity:1;letter-spacing:0.08em} }
.hero-title { animation:luxuryReveal 1.2s ease forwards; }`,
        spacing: "Use generous whitespace — 160px+ section padding. Let content breathe.",
        motionStyle:       "Ultra-slow reveals (1.2s). Letter-spacing animation on headlines. Parallax on imagery. No bounce easing — only cubic-bezier(0.16,1,0.3,1). Hover: barely perceptible scale(1.02).",
        imageDirection:    "Editorial fashion photography. High contrast. Desaturated or duotone. Studio or location. Never stock. Models in motion or stillness. Black/white with gold accents.",
        componentDensity:  "generous",
        premiumLevel:      10,
        colorTemperature:  "neutral",
        typographyScale:   "editorial",
        borderRadius:      "sharp",
        shadowDepth:       "flat",
      };

    // ── ENERGETIC (Fitness, Sports) — "Nike" style
    case "energetic":
      return {
        name: "Nike Bold",
        cardStyle: `background:var(--card); border:none; border-radius:4px; overflow:hidden; position:relative;`,
        buttonStyle: `border-radius:0; font-weight:900; text-transform:uppercase; letter-spacing:0.05em; padding:18px 40px; font-size:14px; clip-path:polygon(0 0, calc(100% - 12px) 0, 100% 100%, 12px 100%);`,
        heroStyle: `background:var(--bg); min-height:100vh; overflow:hidden; position:relative;`,
        sectionBg: [p.bg, "#000", p.bg, "#050505"],
        effectsCSS: `
/* Nike: Bold, high contrast, diagonal cuts */
.angled-section { clip-path:polygon(0 0,100% 0,100% calc(100% - 60px),0 100%); margin-bottom:-60px; padding-bottom:calc(var(--section-pad) + 60px); }
.angled-section-reverse { clip-path:polygon(0 60px,100% 0,100% 100%,0 100%); margin-top:-60px; padding-top:calc(var(--section-pad) + 60px); }
.stat-number { font-size:clamp(60px,12vw,160px); font-weight:900; line-height:0.9; background:var(--grad); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
.progress-bar { height:4px; background:rgba(255,255,255,0.1); border-radius:0; overflow:hidden; }
.progress-fill { height:100%; background:var(--grad); transition:width 1.5s cubic-bezier(0.16,1,0.3,1); }
@keyframes slideInLeft { from{transform:translateX(-100px);opacity:0} to{transform:translateX(0);opacity:1} }
@keyframes slideInRight { from{transform:translateX(100px);opacity:0} to{transform:translateX(0);opacity:1} }
.slide-left.visible { animation:slideInLeft 0.7s ease forwards; }
.slide-right.visible { animation:slideInRight 0.7s ease forwards; }
:root { --section-pad: clamp(80px,10vw,140px); }`,
        spacing: "Tight, powerful. Section padding 80-120px. Large numbers. High contrast.",
        motionStyle:       "Fast snappy reveals (0.4s). Diagonal slide-in animations. Parallax at speed. Bold hover scale(1.05). Active states with color pulse. Counter animations on stats.",
        imageDirection:    "Action sports photography. Dynamic angles. Athletes mid-motion. High shutter speed. Raw energy. Dramatic contrast. Minimal grain. Wide angle dramatic perspective.",
        componentDensity:  "tight",
        premiumLevel:      7,
        colorTemperature:  "cool",
        typographyScale:   "display",
        borderRadius:      "sharp",
        shadowDepth:       "flat",
      };

    // ── WARM (Restaurant, Food) — "Airbnb" style
    case "warm":
      return {
        name: "Airbnb Warm",
        cardStyle: `background:var(--card); border:none; border-radius:24px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,0.3);`,
        buttonStyle: `border-radius:12px; font-weight:700; padding:16px 36px; font-size:15px;`,
        heroStyle: `background:var(--bg); min-height:100vh; position:relative;`,
        sectionBg: [p.bg, p.surface, p.card, p.bg],
        effectsCSS: `
/* Airbnb: Warm, rounded, human, inviting */
.food-img-wrapper { position:relative; overflow:hidden; border-radius:24px; }
.food-img-wrapper::after { content:''; position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,0.6) 0%,transparent 60%); }
.food-img-label { position:absolute; bottom:16px; left:16px; z-index:2; color:#fff; font-weight:700; font-size:14px; }
.menu-tag { background:rgba(255,255,255,0.08); border-radius:50px; padding:4px 14px; font-size:12px; font-weight:600; color:var(--text-2); display:inline-block; }
.star { color:var(--accent); font-size:16px; }
.review-score { font-size:48px; font-weight:800; color:var(--primary); }
@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
.img-loading { background:linear-gradient(90deg,var(--card) 25%,var(--surface) 50%,var(--card) 75%); background-size:200% 100%; animation:shimmer 1.5s infinite; }`,
        spacing: "Comfortable and inviting. 96px section padding. Generous card padding 32px.",
        motionStyle:       "Smooth gentle reveals (0.65s). Fade + lift from bottom 20px. Card hover lift translateY(-4px) with warm shadow growth. No sharp transitions. Easing: ease-out.",
        imageDirection:    "Warm natural light photography. Golden hour or soft diffuse. Real people, genuine moments. Food close-up with steam and texture. Interior: candles, wood, fabric.",
        componentDensity:  "balanced",
        premiumLevel:      6,
        colorTemperature:  "warm",
        typographyScale:   "normal",
        borderRadius:      "rounded",
        shadowDepth:       "medium",
      };

    // ── TRUST (Finance, Crypto, Medical) — "Stripe" style
    case "trust":
      return {
        name: "Stripe Modern",
        cardStyle: `background:var(--card); border:1px solid var(--border); border-radius:16px; backdrop-filter:blur(20px);`,
        buttonStyle: `border-radius:8px; font-weight:700; padding:14px 32px; font-size:15px; letter-spacing:-0.01em;`,
        heroStyle: `background:var(--bg); min-height:100vh; position:relative; overflow:hidden;`,
        sectionBg: [p.bg, p.surface, p.bg, p.surface],
        effectsCSS: `
/* Stripe: Grid lines, precise, data-driven */
.stripe-grid { background-image:linear-gradient(rgba(255,255,255,0.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.02) 1px,transparent 1px); background-size:64px 64px; }
.stat-card { background:var(--card); border:1px solid var(--border); border-radius:16px; padding:32px; position:relative; overflow:hidden; }
.stat-card::before { content:''; position:absolute; top:0; left:0; right:0; height:3px; background:var(--grad); }
.badge { display:inline-flex; align-items:center; gap:6px; padding:4px 12px; border-radius:50px; font-size:12px; font-weight:600; background:rgba(${hexToRgbValues(p.primary)},0.1); color:var(--primary); border:1px solid rgba(${hexToRgbValues(p.primary)},0.2); }
.badge-success { background:rgba(16,185,129,0.1); color:#10B981; border-color:rgba(16,185,129,0.2); }
.check-list li { list-style:none; padding:8px 0; display:flex; gap:12px; align-items:flex-start; border-bottom:1px solid var(--border); }
.check-list li::before { content:'✓'; color:var(--primary); font-weight:700; flex-shrink:0; margin-top:2px; }
.hero-gradient-blob { position:absolute; border-radius:50%; filter:blur(120px); pointer-events:none; }`,
        spacing: "Precise. 8px base grid. 96px section padding. Data presented cleanly.",
        motionStyle:       "Precise reveals (0.5s). Number counters on stats. Grid line animations. Subtle gradient border on hover. Chart bars animate on scroll. No overshoot easing.",
        imageDirection:    "Clean product screenshots on device mockups. Abstract data visualizations. Dark background with glowing UI elements. Team photos: professional, diverse, confident.",
        componentDensity:  "balanced",
        premiumLevel:      8,
        colorTemperature:  "cool",
        typographyScale:   "compact",
        borderRadius:      "subtle",
        shadowDepth:       "subtle",
      };

    // ── BOLD (Agency, Creative) — "Linear" style  
    case "bold":
      return {
        name: "Linear Creative",
        cardStyle: `background:var(--card); border:1px solid var(--border); border-radius:16px; position:relative; overflow:hidden;`,
        buttonStyle: `border-radius:8px; font-weight:700; padding:14px 32px; font-size:15px;`,
        heroStyle: `background:var(--bg); min-height:100vh; position:relative; overflow:hidden;`,
        sectionBg: [p.bg, "#050208", p.bg, "#030106"],
        effectsCSS: `
/* Linear: Gradient borders, glow effects, dark premium */
.gradient-border { position:relative; }
.gradient-border::before { content:''; position:absolute; inset:-1px; background:var(--grad); border-radius:inherit; z-index:-1; opacity:0; transition:opacity 0.3s; }
.gradient-border:hover::before { opacity:1; }
.work-card { position:relative; overflow:hidden; border-radius:16px; aspect-ratio:4/3; }
.work-card img { width:100%; height:100%; object-fit:cover; transition:transform 0.6s ease; }
.work-card:hover img { transform:scale(1.08); }
.work-card-overlay { position:absolute; inset:0; background:linear-gradient(to top,rgba(0,0,0,0.9) 0%,transparent 60%); display:flex; flex-direction:column; justify-content:flex-end; padding:24px; opacity:0; transition:opacity 0.3s; }
.work-card:hover .work-card-overlay { opacity:1; }
.number-large { font-size:clamp(100px,18vw,220px); font-weight:800; line-height:0.85; opacity:0.04; color:#fff; pointer-events:none; position:absolute; }
@keyframes borderRotate { to { --angle: 360deg; } }
.glow-card::after { content:''; position:absolute; inset:-1px; border-radius:inherit; padding:1px; background:linear-gradient(var(--angle,0deg),var(--primary),transparent,var(--secondary)); -webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0); -webkit-mask-composite:xor; opacity:0; transition:opacity 0.3s; }
.glow-card:hover::after { opacity:1; }`,
        spacing: "Dramatic. Large sections 120px+. Oversized typography. Bold visual statements.",
        motionStyle:       "Cinematic reveals (0.8s). Work cards: overlay reveals on hover. Gradient border rotates on hover. Large number backgrounds count up. Parallax on hero. Bold cursor effects.",
        imageDirection:    "Portfolio case studies: before/after, process shots, final renders. Agency vibe: creative workspace, team in action, whiteboards. Bold typography as graphic element.",
        componentDensity:  "generous",
        premiumLevel:      9,
        colorTemperature:  "cool",
        typographyScale:   "display",
        borderRadius:      "subtle",
        shadowDepth:       "dramatic",
      };

    // ── MINIMAL-LIGHT (White Minimal) — bright, airy, gallery-like ──
    case "minimal-light":
      return {
        name: "White Minimal",
        cardStyle: `background:var(--card); border:1px solid rgba(0,0,0,0.08); border-radius:12px; box-shadow:0 2px 12px rgba(0,0,0,0.04);`,
        buttonStyle: `border-radius:8px; font-weight:600; padding:14px 32px; font-size:14px; box-shadow:0 2px 8px rgba(0,0,0,0.08);`,
        heroStyle: `background:var(--bg); min-height:100vh; display:flex; align-items:center; position:relative;`,
        sectionBg: [p.bg, p.surface, p.bg, p.card],
        effectsCSS: `
/* White Minimal: light, airy, gallery-like — the deliberate anti-dark-mode variant */
.light-card { background:#fff; border:1px solid rgba(0,0,0,0.06); border-radius:14px; box-shadow:0 4px 20px rgba(0,0,0,0.05); transition:box-shadow 0.3s,transform 0.3s; }
.light-card:hover { box-shadow:0 12px 32px rgba(0,0,0,0.09); transform:translateY(-3px); }
.hairline { height:1px; background:rgba(0,0,0,0.08); }
.tag-outline { border:1px solid rgba(0,0,0,0.15); border-radius:20px; padding:4px 14px; font-size:11px; font-weight:600; color:rgba(0,0,0,0.65); }
.section-num { font-size:13px; font-weight:700; color:var(--primary); letter-spacing:0.1em; }
@keyframes lightFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
.reveal.visible { animation:lightFadeUp 0.6s cubic-bezier(0.16,1,0.3,1) forwards; }`,
        spacing: "Airy and gallery-like. 100-140px section padding. Lots of negative space, content never crowds the edges.",
        motionStyle:       "Gentle fade-up reveals (0.6s). Cards lift subtly on hover with shadow growth, no scale. Understated, confident — nothing shouts.",
        imageDirection:    "Bright, naturally-lit photography. White/light backgrounds. Clean product shots or airy lifestyle imagery. Never dark or moody.",
        componentDensity:  "generous",
        premiumLevel:      8,
        colorTemperature:  "neutral",
        typographyScale:   "normal",
        borderRadius:      "rounded",
        shadowDepth:       "soft",
      };

    // ── GLASS-PREMIUM (Dark Glass) — heavy frosted glassmorphism ────
    case "glass-premium":
      return {
        name: "Dark Glass",
        cardStyle: `background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:24px; backdrop-filter:blur(24px) saturate(180%);`,
        buttonStyle: `border-radius:14px; font-weight:600; padding:15px 34px; font-size:15px; backdrop-filter:blur(12px); border:1px solid rgba(255,255,255,0.15);`,
        heroStyle: `background:var(--bg); min-height:100vh; display:flex; align-items:center; position:relative; overflow:hidden;`,
        sectionBg: [p.bg, p.surface, p.bg],
        effectsCSS: `
/* Dark Glass: frosted panels floating over blurred color orbs */
.glass-orb { position:absolute; border-radius:50%; filter:blur(90px); opacity:0.35; pointer-events:none; }
.glass-orb-1 { width:400px; height:400px; background:var(--primary); top:-100px; left:-100px; }
.glass-orb-2 { width:340px; height:340px; background:var(--secondary); bottom:-80px; right:-80px; }
.glass-panel { background:rgba(255,255,255,0.05); backdrop-filter:blur(28px) saturate(160%); border:1px solid rgba(255,255,255,0.1); border-radius:24px; }
.glass-panel:hover { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.18); }
@keyframes floatOrb { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-24px)} }
.glass-orb { animation:floatOrb 8s ease-in-out infinite; }`,
        spacing: "Layered depth — 110px section padding. Floating panels over soft blurred color fields.",
        motionStyle:       "Smooth glass reveals (0.6s), slight blur-to-focus transition. Panels float gently (8s loop). Hover: background brightens, border sharpens.",
        imageDirection:    "Abstract gradients, soft color-blur backgrounds. Product shots with reflective/glass surfaces. Minimal, atmospheric.",
        componentDensity:  "balanced",
        premiumLevel:      9,
        colorTemperature:  "cool",
        typographyScale:   "normal",
        borderRadius:      "rounded",
        shadowDepth:       "soft",
      };

    // ── INDUSTRIAL (Construction, Technical, Utilitarian) ───────────
    case "industrial":
      return {
        name: "Industrial Technical",
        cardStyle: `background:var(--card); border:1px solid var(--border); border-radius:2px; position:relative;`,
        buttonStyle: `border-radius:2px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; padding:16px 36px; font-size:13px; border:2px solid var(--primary);`,
        heroStyle: `background:var(--bg); min-height:100vh; position:relative;`,
        sectionBg: [p.bg, "#0A0A0A", p.bg],
        effectsCSS: `
/* Industrial: sharp edges, grid overlay, utilitarian precision */
.grid-overlay { background-image:linear-gradient(rgba(255,255,255,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.03) 1px,transparent 1px); background-size:40px 40px; }
.spec-row { display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border); font-family:monospace; font-size:13px; }
.corner-marks { position:relative; }
.corner-marks::before,.corner-marks::after { content:''; position:absolute; width:16px; height:16px; border:2px solid var(--primary); }
.corner-marks::before { top:0; left:0; border-right:none; border-bottom:none; }
.corner-marks::after { bottom:0; right:0; border-left:none; border-top:none; }
.stamp-badge { border:2px solid var(--primary); border-radius:2px; padding:6px 14px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:0.1em; transform:rotate(-2deg); }`,
        spacing: "Precise, structured grid. 90-100px section padding. Monospace data callouts.",
        motionStyle:       "Sharp, mechanical reveals (0.4s), no easing softness — linear or steep cubic-bezier. Progress bars fill like gauges.",
        imageDirection:    "Real job-site/technical photography. Equipment, blueprints, materials close-up. High contrast, desaturated slightly. Authentic, not staged.",
        componentDensity:  "tight",
        premiumLevel:      6,
        colorTemperature:  "cool",
        typographyScale:   "normal",
        borderRadius:      "sharp",
        shadowDepth:       "flat",
      };

    // ── PLAYFUL (Gaming, Youth Fashion, Kids Education) ─────────────
    case "playful":
      return {
        name: "Playful Bounce",
        cardStyle: `background:var(--card); border:2px solid var(--border); border-radius:28px; position:relative; overflow:hidden;`,
        buttonStyle: `border-radius:50px; font-weight:800; padding:16px 38px; font-size:15px; box-shadow:0 6px 0 var(--secondary);`,
        heroStyle: `background:var(--bg); min-height:100vh; display:flex; align-items:center; position:relative; overflow:hidden;`,
        sectionBg: [p.bg, p.surface, p.bg, p.card],
        effectsCSS: `
/* Playful: bouncy, colorful, blob shapes, high energy */
.blob-shape { position:absolute; border-radius:60% 40% 50% 50% / 50% 60% 40% 50%; filter:blur(2px); opacity:0.25; pointer-events:none; }
.bounce-btn:active { transform:translateY(6px); box-shadow:0 0 0 var(--secondary) !important; }
.sticker-badge { background:var(--grad); border-radius:50%; width:64px; height:64px; display:flex; align-items:center; justify-content:center; font-size:28px; transform:rotate(-8deg); box-shadow:0 6px 16px rgba(0,0,0,0.25); }
@keyframes bounceIn { 0%{transform:scale(0.8);opacity:0} 60%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }
.reveal.visible { animation:bounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
@keyframes wiggle { 0%,100%{transform:rotate(-2deg)} 50%{transform:rotate(2deg)} }
.wiggle-hover:hover { animation:wiggle 0.3s ease-in-out; }`,
        spacing: "Energetic, tightly packed with personality. 80-100px section padding. Rounded everything.",
        motionStyle:       "Bouncy spring-easing reveals (0.5s, overshoot). Buttons press down physically on click. Icons wiggle on hover. High energy throughout.",
        imageDirection:    "Bright saturated colors. Illustration or 3D-render style icons over photography. Fun, high-energy, never corporate-serious.",
        componentDensity:  "generous",
        premiumLevel:      6,
        colorTemperature:  "warm",
        typographyScale:   "display",
        borderRadius:      "rounded",
        shadowDepth:       "dramatic",
      };

    // ── CLEAN (SaaS, Tech) — "Apple" style
    case "clean":
    default:
      return {
        name: "Apple Clean",
        cardStyle: `background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:20px; backdrop-filter:blur(20px);`,
        buttonStyle: `border-radius:50px; font-weight:600; padding:14px 32px; font-size:15px; letter-spacing:-0.01em;`,
        heroStyle: `background:var(--bg); min-height:100vh; display:flex; align-items:center; position:relative;`,
        sectionBg: [p.bg, p.surface, p.bg, p.card],
        effectsCSS: `
/* Apple: Ultra clean, precise spacing, subtle depth */
.glass-card { background:rgba(255,255,255,0.04); backdrop-filter:blur(40px) saturate(180%); border:1px solid rgba(255,255,255,0.08); border-radius:20px; }
.feature-icon { width:56px; height:56px; border-radius:16px; background:var(--grad); display:flex; align-items:center; justify-content:center; font-size:24px; box-shadow:0 8px 32px rgba(${hexToRgbValues(p.primary)},0.3); }
.pricing-card-featured { background:linear-gradient(135deg,rgba(${hexToRgbValues(p.primary)},0.15),rgba(${hexToRgbValues(p.secondary)},0.1)); border-color:var(--primary); }
.tag { font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:0.1em; color:var(--primary); }
.section-label { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.12em; color:var(--primary); margin-bottom:16px; display:block; }
.mockup-window { background:var(--surface); border:1px solid var(--border); border-radius:12px; overflow:hidden; box-shadow:0 40px 100px rgba(0,0,0,0.5); }
.mockup-bar { background:var(--card); padding:12px 16px; display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--border); }
.dot { width:12px; height:12px; border-radius:50%; }`,
        spacing: "Generous whitespace — Apple-level breathing room. 120px section padding.",
        motionStyle:       "Elegant reveals (0.65s). Blur+fade in on scroll (blur: 8px → 0). Card hover: translateY(-6px) with glass shadow spread. Feature icons: scale(1.08) on hover. Smooth everything.",
        imageDirection:    "Clean product photography on white or dark. Device mockups with UI screenshots. Abstract gradients as backgrounds. People: professional, diverse, smiling naturally.",
        componentDensity:  "balanced",
        premiumLevel:      8,
        colorTemperature:  "neutral",
        typographyScale:   "normal",
        borderRadius:      "rounded",
        shadowDepth:       "medium",
      };
  }
}

export function hexToRgbValues(hex: string): string {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `${r},${g},${b}`;
}
