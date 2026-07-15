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

  // Deterministic CSS generation — no AI call. Composes the same real,
  // tone-driven design data (palette, typography, premium effects,
  // component-library CSS snippets) that was already proven complete
  // enough to serve as this function's AI-failure fallback; that
  // fallback is now the ONLY path, making rendering fully deterministic
  // after the single master AI call plans the page.
  const css = `
:root{--primary:${p.primary};--secondary:${p.secondary};--grad:${p.grad};--accent:${p.accent};
--bg:${p.bg};--surface:${p.surface};--card:${p.card};--text:#FFFFFF;--text-2:${p.text2};
--border:rgba(255,255,255,0.07);--border-accent:rgba(${rgb},0.3);}
@import url('${t.googleFonts}');
body{background:var(--bg);color:var(--text);font-family:${t.bodyFont};line-height:1.6;margin:0;}
h1,h2,h3{font-family:${t.headingFont};font-weight:${t.headingWeight};letter-spacing:${t.headingSpacing};}
h1{font-size:clamp(28px,6vw,56px);} h2{font-size:clamp(22px,4vw,38px);} h3{font-size:clamp(18px,3vw,26px);}
.container{max-width:1200px;margin:0 auto;padding:0 24px;}
section{padding:clamp(48px,8vw,96px) 0;overflow-x:hidden;}
nav{display:flex;justify-content:space-between;align-items:center;padding:16px 24px;position:sticky;top:0;background:var(--surface);z-index:100;transition:box-shadow .2s;}
nav.scrolled{box-shadow:0 2px 12px rgba(0,0,0,0.2);}
.hamburger{display:none;background:none;border:none;color:var(--text);font-size:24px;cursor:pointer;}
@media(max-width:768px){.nav-links{display:none;}.nav-links.open{display:flex;flex-direction:column;position:absolute;top:100%;left:0;right:0;background:var(--surface);padding:16px;}.hamburger{display:block;}}
.btn,button,a.btn{background:var(--grad);color:#fff;border:none;padding:14px 28px;border-radius:10px;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block;transition:transform .2s;}
.btn:hover{transform:translateY(-2px);}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:24px;}
footer{background:var(--surface);padding:48px 24px;text-align:center;color:var(--text-2);}
.reveal{opacity:0;transform:translateY(20px);transition:opacity .6s,transform .6s;}
.reveal.visible{opacity:1;transform:none;}
${getPremiumEffects(niche, rgb)}`;

  return enforceResponsiveHeadings(`<style>${css}</style>`).replace(/^<style>|<\/style>$/g, "");
}


export async function generateJS(htmlStructure: string, projectType: string): Promise<string> {
  // Deterministic JS generation — no AI call. Covers every behavior the
  // AI prompt used to request (mobile menu, FAQ accordions, scroll-
  // reveal, smooth scroll, sticky header, form submit) as fixed,
  // reliable vanilla JS — the same safety-net logic already proven
  // sufficient, now the only path, completing determinism after the
  // single master AI call.
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
});
// FAQ accordions — only one open at a time
document.querySelectorAll('.faq-item, [data-faq-item]').forEach(item=>{
  const q = item.querySelector('.faq-question, [data-faq-question]');
  if (!q) return;
  q.addEventListener('click', () => {
    const wasOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item, [data-faq-item]').forEach(i => i.classList.remove('open'));
    if (!wasOpen) item.classList.add('open');
  });
});
// Forms — prevent default, show an inline success message (no real backend call)
document.querySelectorAll('form').forEach(form=>{
  form.addEventListener('submit', e => {
    e.preventDefault();
    let msg = form.querySelector('.form-success-message');
    if (!msg) {
      msg = document.createElement('div');
      msg.className = 'form-success-message';
      msg.style.cssText = 'margin-top:12px;padding:12px;border-radius:8px;background:rgba(0,208,132,0.1);color:#00D084;font-weight:600;';
      form.appendChild(msg);
    }
    msg.textContent = "Thanks! We'll be in touch soon.";
  });
});`;
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
