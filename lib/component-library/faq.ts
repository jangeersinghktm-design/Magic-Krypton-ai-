// lib/component-library/faq.ts
// KRYPTON AI Component Library — FAQ Variants

import { ComponentContext, SPACING, RADIUS, wrapSection } from "./tokens";

export interface FAQItem {
  question: string;
  answer: string;
}

export interface FAQContent {
  eyebrow?: string;
  headline: string;
  items: FAQItem[];
  cta?: { text: string; href: string };
}

function sectionHeader(c: FAQContent): string {
  return `<div style="max-width:560px;margin-bottom:${SPACING.lg};">
    ${c.eyebrow ? `<p style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--primary);margin-bottom:12px;">${c.eyebrow}</p>` : ""}
    <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(26px,4vw,42px);color:var(--text);">${c.headline}</h2>
  </div>`;
}

function accordionScript(prefix: string): string {
  return `<script>
document.querySelectorAll('.faq-btn-${prefix}').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const panel=btn.nextElementSibling;
    const icon=btn.querySelector('.faq-icon-${prefix}');
    const isOpen=panel.style.maxHeight&&panel.style.maxHeight!=='0px';
    // Close all
    document.querySelectorAll('.faq-panel-${prefix}').forEach(p=>{p.style.maxHeight='0px';p.style.paddingTop='0';p.style.paddingBottom='0';});
    document.querySelectorAll('.faq-icon-${prefix}').forEach(i=>{i.style.transform='rotate(0deg)';});
    // Open this one
    if(!isOpen){panel.style.maxHeight=panel.scrollHeight+'px';panel.style.paddingTop='14px';panel.style.paddingBottom='14px';if(icon)icon.style.transform='rotate(45deg)';}
  });
});
</script>`;
}

// ── Variant 1: Accordion — classic expand/collapse (most common) ──
export function faqAccordion(ctx: ComponentContext, c: FAQContent): string {
  const id = "acc";
  const inner = `
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:${SPACING.xl};align-items:start;" class="faq-layout">
    <div>${sectionHeader(c)}
      ${c.cta ? `<a href="${c.cta.href}" style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:${RADIUS.md};background:var(--grad);color:#fff;text-decoration:none;font-weight:700;font-size:14px;">${c.cta.text}</a>` : ""}
    </div>
    <div>
      ${c.items.map((f, i) => `
      <div style="border-bottom:1px solid var(--border);${i === 0 ? "border-top:1px solid var(--border);" : ""}">
        <button class="faq-btn-${id}" style="width:100%;text-align:left;padding:18px 0;background:none;border:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;">
          <span style="font-size:15px;font-weight:600;color:var(--text);">${f.question}</span>
          <span class="faq-icon-${id}" style="font-size:20px;color:var(--primary);flex-shrink:0;transition:transform .25s;line-height:1;">+</span>
        </button>
        <div class="faq-panel-${id}" style="max-height:0;overflow:hidden;transition:all .3s;padding-top:0;padding-bottom:0;">
          <p style="font-size:14px;color:var(--text-2);line-height:1.75;">${f.answer}</p>
        </div>
      </div>`).join("")}
    </div>
  </div>
  <style>@media(max-width:768px){.faq-layout{grid-template-columns:1fr !important;}}</style>
  ${accordionScript(id)}`;
  return wrapSection("faq", inner);
}

// ── Variant 2: Simple List — clean single column, no split (minimal) ──
export function faqSimpleList(ctx: ComponentContext, c: FAQContent): string {
  const id = "list";
  const inner = `
  <div style="text-align:center;max-width:680px;margin:0 auto;">
    ${sectionHeader({ ...c })}
  </div>
  <div style="max-width:720px;margin:0 auto;">
    ${c.items.map((f, i) => `
    <div style="border-bottom:1px solid var(--border);${i === 0 ? "border-top:1px solid var(--border);" : ""}">
      <button class="faq-btn-${id}" style="width:100%;text-align:left;padding:20px 0;background:none;border:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;">
        <span style="font-size:15px;font-weight:600;color:var(--text);">${f.question}</span>
        <span class="faq-icon-${id}" style="width:24px;height:24px;border-radius:${RADIUS.full};background:var(--card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--primary);flex-shrink:0;transition:transform .25s;">+</span>
      </button>
      <div class="faq-panel-${id}" style="max-height:0;overflow:hidden;transition:all .3s;padding-top:0;padding-bottom:0;">
        <p style="font-size:14px;color:var(--text-2);line-height:1.8;">${f.answer}</p>
      </div>
    </div>`).join("")}
  </div>
  ${c.cta ? `<div style="text-align:center;margin-top:${SPACING.lg};"><a href="${c.cta.href}" style="display:inline-flex;align-items:center;gap:8px;padding:14px 32px;border-radius:${RADIUS.md};background:var(--grad);color:#fff;text-decoration:none;font-weight:700;">${c.cta.text}</a></div>` : ""}
  ${accordionScript(id)}`;
  return wrapSection("faq", inner);
}

// ── Variant 3: Numbered Cards — each question in its own card (technical/docs) ──
export function faqNumberedCards(ctx: ComponentContext, c: FAQContent): string {
  const inner = `${sectionHeader(c)}
  <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:16px;" class="faq-cards">
    ${c.items.map((f, i) => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};padding:${SPACING.md};transition:all .25s;" onmouseenter="this.style.borderColor='var(--border-accent)'" onmouseleave="this.style.borderColor='var(--border)'">
      <div style="font-family:var(--heading-font);font-size:32px;font-weight:700;color:var(--primary);opacity:0.25;margin-bottom:10px;line-height:1;">${String(i + 1).padStart(2, "0")}</div>
      <h3 style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:10px;">${f.question}</h3>
      <p style="font-size:13px;color:var(--text-2);line-height:1.7;">${f.answer}</p>
    </div>`).join("")}
  </div>
  <style>@media(max-width:768px){.faq-cards{grid-template-columns:1fr !important;}}</style>`;
  return wrapSection("faq", inner);
}

// ── Variant 4: Highlighted Accordion — colored left border on open ──
export function faqHighlighted(ctx: ComponentContext, c: FAQContent): string {
  const id = "hi";
  const inner = `${sectionHeader(c)}
  <div style="max-width:800px;display:flex;flex-direction:column;gap:10px;">
    ${c.items.map((f, i) => `
    <div class="faq-item-${id}" style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.md};overflow:hidden;transition:all .25s;border-left:3px solid transparent;">
      <button class="faq-btn-${id}" style="width:100%;text-align:left;padding:18px 20px;background:none;border:none;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:16px;">
        <span style="font-size:14px;font-weight:600;color:var(--text);">${f.question}</span>
        <span class="faq-icon-${id}" style="font-size:18px;color:var(--primary);flex-shrink:0;transition:transform .25s;font-weight:300;">+</span>
      </button>
      <div class="faq-panel-${id}" style="max-height:0;overflow:hidden;transition:all .3s;padding-left:20px;padding-right:20px;padding-top:0;padding-bottom:0;">
        <p style="font-size:14px;color:var(--text-2);line-height:1.75;">${f.answer}</p>
      </div>
    </div>`).join("")}
  </div>
  <script>
  document.querySelectorAll('.faq-btn-${id}').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const panel=btn.nextElementSibling;
      const icon=btn.querySelector('.faq-icon-${id}');
      const item=btn.closest('.faq-item-${id}');
      const isOpen=panel.style.maxHeight&&panel.style.maxHeight!=='0px';
      document.querySelectorAll('.faq-panel-${id}').forEach(p=>{p.style.maxHeight='0px';p.style.paddingTop='0';p.style.paddingBottom='0';});
      document.querySelectorAll('.faq-icon-${id}').forEach(i=>{i.style.transform='rotate(0deg)';});
      document.querySelectorAll('.faq-item-${id}').forEach(it=>{it.style.borderLeftColor='transparent';});
      if(!isOpen){
        panel.style.maxHeight=panel.scrollHeight+'px';panel.style.paddingTop='0';panel.style.paddingBottom='16px';
        if(icon)icon.style.transform='rotate(45deg)';
        if(item)item.style.borderLeftColor='var(--primary)';
      }
    });
  });
  </script>`;
  return wrapSection("faq", inner);
}

export const FAQ_VARIANTS = {
  "accordion":       faqAccordion,
  "simple-list":     faqSimpleList,
  "numbered-cards":  faqNumberedCards,
  "highlighted":     faqHighlighted,
} as const;

export type FAQVariant = keyof typeof FAQ_VARIANTS;

