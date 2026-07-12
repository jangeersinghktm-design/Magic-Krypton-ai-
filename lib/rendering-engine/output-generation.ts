// lib/rendering-engine/output-generation.ts
// Shared Stage 3/4/5 output generation — CSS, JS, and final HTML assembly.
// Imported by BOTH orchestrate and generate routes so styling/scripting/
// combination logic is never duplicated.

import type { NicheProfile } from "./types";
import type { DesignLanguage } from "./design-language";
import { getPremiumEffects, FORCE_RULES, enforceResponsiveHeadings } from "./html-utils";
import { hexToRgbValues } from "./design-language";
import { kryptonGenerate } from "@/lib/ai-providers";
import { buildRootTokens } from "@/lib/component-library";

export async function generateCSS(niche: NicheProfile, dl: DesignLanguage, htmlStructure: string): Promise<string> {
  const p = niche.palette;
  const t = niche.typography;
  const rgb = hexToRgbValues(p.primary);
  const premiumEffects = getPremiumEffects(niche, rgb);

  const system = `You are Krypton AI's CSS specialist. You will be given exact HTML and must write a COMPLETE stylesheet that styles every class used in it. Output ONLY CSS — no markdown fences, no explanation.`;

  const user = `${FORCE_RULES}

HTML TO STYLE (style every class name that appears here — do not invent classes that aren't in this HTML):
${htmlStructure}

DESIGN SYSTEM — use exactly these values:
@import url('${t.googleFonts}');
:root {
  --primary: ${p.primary}; --secondary: ${p.secondary}; --grad: ${p.grad};
  --accent: ${p.accent}; --bg: ${p.bg}; --surface: ${p.surface}; --card: ${p.card};
  --text: #FFFFFF; --text-2: ${p.text2};
  --border: rgba(255,255,255,0.07); --border-accent: rgba(${rgb},0.3);
}
Heading font: ${t.headingFont}, weight ${t.headingWeight}, letter-spacing ${t.headingSpacing}
Body font: ${t.bodyFont}

CRITICAL RULES:
- ALL heading font-sizes MUST use clamp(min,vw,max) — NEVER a fixed px value (causes mobile wrapping)
- Mobile nav MUST collapse to hamburger below 768px (full pattern, not partial)
- Every button/card/link needs a hover state with transition
- Add scroll-reveal animation classes (.reveal) with @keyframes
${premiumEffects}

Output the complete CSS now.`;

  try {
    const { text } = await kryptonGenerate(system, user);
    let css = text.replace(/\`\`\`css|\`\`\`/g, "").trim();
    if (css.length < 200) throw new Error("CSS output too short");
    // Belt-and-suspenders: catch any fixed-px headings the CSS stage still produces
    css = enforceResponsiveHeadings(`<style>${css}</style>`).replace(/^<style>|<\/style>$/g, "");
    return css;
  } catch {
    // Fallback: a solid, working default stylesheet using the real niche palette —
    // not pretty, but guarantees the site is never unstyled if the CSS stage fails twice.
    return `
:root{--primary:${p.primary};--secondary:${p.secondary};--grad:${p.grad};--accent:${p.accent};
--bg:${p.bg};--surface:${p.surface};--card:${p.card};--text:#FFFFFF;--text-2:${p.text2};
--border:rgba(255,255,255,0.07);}
body{background:var(--bg);color:var(--text);font-family:${t.bodyFont};line-height:1.6;}
h1,h2,h3{font-family:${t.headingFont};font-weight:${t.headingWeight};}
h1{font-size:clamp(28px,6vw,56px);} h2{font-size:clamp(22px,4vw,38px);}
.container{max-width:1200px;margin:0 auto;padding:0 24px;}
section{padding:clamp(48px,8vw,96px) 0;}
nav{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;position:sticky;top:0;background:var(--surface);z-index:100;}
.hamburger{display:none;background:none;border:none;color:var(--text);font-size:24px;cursor:pointer;}
@media(max-width:768px){.nav-links{display:none;}.hamburger{display:block;}}
.btn,button,a.btn{background:var(--grad);color:#fff;border:none;padding:14px 28px;border-radius:10px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block;transition:transform .2s;}
.btn:hover{transform:translateY(-2px);}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;}
footer{background:var(--surface);padding:48px 24px;text-align:center;color:var(--text-2);}
.reveal{opacity:0;transform:translateY(20px);transition:opacity .6s,transform .6s;}
.reveal.visible{opacity:1;transform:none;}`;
  }
}


export async function generateJS(htmlStructure: string, projectType: string): Promise<string> {
  const system = `You are Krypton AI's JavaScript specialist. You will be given exact HTML and must write vanilla JS (no frameworks, no libraries) that makes every interactive element in it actually work. Output ONLY JS — no markdown fences, no explanation.`;

  const user = `${FORCE_RULES}

HTML TO MAKE INTERACTIVE:
${htmlStructure}

REQUIRED BEHAVIOR:
- Mobile hamburger menu: toggle .open class on click, close on link click or outside-click
- FAQ accordions (if present): expand/collapse, only one open at a time
- Scroll-reveal: IntersectionObserver adds .visible to .reveal elements as they enter viewport
- Smooth scroll for all anchor links (#section)
- Forms: prevent default, show a success message inline (no real backend call)
- Sticky header: add .scrolled class to nav after 50px scroll for shadow/bg change
- Any sliders/carousels referenced in the HTML must be fully functional

Output the complete JS now.`;

  try {
    const { text } = await kryptonGenerate(system, user);
    const cleaned = text.replace(/\`\`\`(javascript|js)?|\`\`\`/g, "").trim();
    if (cleaned.length < 50) throw new Error("JS output too short");
    return cleaned;
  } catch {
    // Fallback: minimal but genuinely functional JS — hamburger menu + smooth scroll +
    // scroll-reveal still work even if the JS stage fails. Better than zero interactivity.
    return `
document.querySelectorAll('.hamburger').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.nav-links').forEach(n=>n.classList.toggle('open'));
  });
});
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click',e=>{
    const t=document.querySelector(a.getAttribute('href'));
    if(t){e.preventDefault();t.scrollIntoView({behavior:'smooth'});}
  });
});
const revealObserver=new IntersectionObserver(entries=>{
  entries.forEach(e=>{if(e.isIntersecting)e.target.classList.add('visible');});
},{threshold:0.15});
document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));
window.addEventListener('scroll',()=>{
  document.querySelectorAll('nav').forEach(n=>n.classList.toggle('scrolled',window.scrollY>50));
});`;
  }
}


export function combineOutput(htmlStructure: string, css: string, js: string, niche: NicheProfile, title: string): string {
  // buildRootTokens() is deterministic (not AI-generated) — guarantees every
  // CSS variable the Component Library relies on (--heading-font,
  // --primary-rgb, etc.) is always correct, regardless of what the CSS
  // generation stage produced. AI-generated CSS layers on top of this.
  const rootTokens = buildRootTokens(niche);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
${rootTokens}
${css}
/* Krypton QA */img{max-width:100%;display:block;}img:not([style*="height"]){object-fit:cover;}[class*="hero"]{min-height:clamp(400px,60vh,800px);overflow:hidden;}section{padding:clamp(60px,8vw,120px) clamp(16px,5vw,80px);}@media(max-width:768px){[style*="grid-template-columns:repeat(3"]{grid-template-columns:1fr!important;}h1{font-size:clamp(28px,8vw,52px)!important;}section{padding:48px 16px!important;}img{width:100%!important;height:auto!important;}}
</style>
</head>
<body>
${htmlStructure}
<script>
${js}
</script>
</body>
</html>`;
}

