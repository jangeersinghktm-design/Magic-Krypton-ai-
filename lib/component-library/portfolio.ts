// lib/component-library/portfolio.ts
// KRYPTON AI Component Library — Portfolio Layout Variants

import { ComponentContext, SPACING, RADIUS, SHADOW, wrapSection } from "./tokens";

export interface PortfolioItem {
  title: string;
  category: string;
  description?: string;
  imageUrl?: string;
  tags?: string[];
  url?: string;
  year?: string;
}

export interface PortfolioContent {
  eyebrow?: string;
  headline: string;
  items: PortfolioItem[];
}

function sectionHeader(c: PortfolioContent, align: "center" | "left" = "center"): string {
  return `<div style="text-align:${align};${align === "center" ? "max-width:560px;margin:0 auto" : ""} ${SPACING.lg};">
    ${c.eyebrow ? `<p style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--primary);margin-bottom:12px;">${c.eyebrow}</p>` : ""}
    <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(26px,4vw,42px);color:var(--text);margin-bottom:${SPACING.lg};">${c.headline}</h2>
  </div>`;
}

// ── Variant 1: Masonry Grid — variable height cards (creative agencies) ──
export function portfolioMasonry(ctx: ComponentContext, c: PortfolioContent): string {
  const inner = `${sectionHeader(c)}
  <div style="columns:3;column-gap:16px;" class="portfolio-masonry">
    ${c.items.map(p => `
    <div style="break-inside:avoid;margin-bottom:16px;background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};overflow:hidden;transition:all .3s;cursor:pointer;" onclick="window.open('${p.url || "#"}','_blank')" onmouseenter="this.querySelector('.pf-overlay').style.opacity='1'" onmouseleave="this.querySelector('.pf-overlay').style.opacity='0'">
      <div style="position:relative;">
        <img src="${p.imageUrl || ""}" alt="${p.title}" loading="lazy" style="width:100%;height:auto;display:block;min-height:160px;object-fit:cover;background:var(--surface);">
        <div class="pf-overlay" style="position:absolute;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .3s;">
          <span style="color:#fff;font-weight:700;font-size:14px;">View Project →</span>
        </div>
      </div>
      <div style="padding:16px;">
        <p style="font-size:11px;color:var(--primary);font-weight:600;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:6px;">${p.category}</p>
        <h3 style="font-size:16px;font-weight:700;color:var(--text);">${p.title}</h3>
        ${p.description ? `<p style="font-size:13px;color:var(--text-2);margin-top:6px;line-height:1.6;">${p.description}</p>` : ""}
      </div>
    </div>`).join("")}
  </div>
  <style>@media(max-width:768px){.portfolio-masonry{columns:1 !important;}}</style>`;
  return wrapSection("portfolio", inner);
}

// ── Variant 2: List Projects — numbered editorial list (developer/minimal) ──
export function portfolioList(ctx: ComponentContext, c: PortfolioContent): string {
  const inner = `${sectionHeader(c, "left")}
  <div style="display:flex;flex-direction:column;">
    ${c.items.map((p, i) => `
    <a href="${p.url || "#"}" style="display:grid;grid-template-columns:60px 1fr auto;align-items:center;gap:${SPACING.md};padding:${SPACING.md} 0;border-top:1px solid var(--border);text-decoration:none;transition:all .2s;" class="pf-list-item" onmouseenter="this.style.paddingLeft='16px'" onmouseleave="this.style.paddingLeft='0'">
      <span style="font-family:var(--heading-font);font-size:36px;font-weight:700;color:var(--primary);opacity:0.2;line-height:1;">${String(i + 1).padStart(2, "0")}</span>
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
          <h3 style="font-size:18px;font-weight:700;color:var(--text);">${p.title}</h3>
          <span style="font-size:11px;color:var(--primary);background:rgba(var(--primary-rgb),0.1);padding:2px 10px;border-radius:${RADIUS.full};font-weight:600;">${p.category}</span>
        </div>
        ${p.description ? `<p style="font-size:13px;color:var(--text-2);">${p.description}</p>` : ""}
        ${p.tags?.length ? `<div style="display:flex;gap:6px;margin-top:8px;">${p.tags.map(t => `<span style="font-size:11px;color:var(--text-2);padding:2px 8px;border:1px solid var(--border);border-radius:${RADIUS.full};">${t}</span>`).join("")}</div>` : ""}
      </div>
      <div style="text-align:right;flex-shrink:0;">
        ${p.year ? `<span style="font-size:13px;color:var(--text-2);">${p.year}</span>` : ""}
        <div style="color:var(--primary);font-size:20px;margin-top:4px;">→</div>
      </div>
    </a>`).join("")}
    <div style="border-top:1px solid var(--border);"></div>
  </div>`;
  return wrapSection("portfolio", inner);
}

// ── Variant 3: Featured + Grid — 1 large hero + 4 smaller (classic) ──
export function portfolioFeaturedGrid(ctx: ComponentContext, c: PortfolioContent): string {
  const [hero, ...rest] = c.items;
  const inner = `${sectionHeader(c)}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;" class="pf-main-grid">
    <!-- Hero item -->
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.xl};overflow:hidden;cursor:pointer;transition:all .3s;" onclick="window.open('${hero?.url || "#"}','_blank')">
      <img src="${hero?.imageUrl || ""}" alt="${hero?.title || ""}" loading="lazy" style="width:100%;height:280px;object-fit:cover;background:var(--surface);">
      <div style="padding:20px;">
        <p style="font-size:11px;color:var(--primary);font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;">${hero?.category || ""}</p>
        <h3 style="font-size:20px;font-weight:700;color:var(--text);margin-bottom:8px;">${hero?.title || ""}</h3>
        ${hero?.description ? `<p style="font-size:13px;color:var(--text-2);line-height:1.6;">${hero.description}</p>` : ""}
      </div>
    </div>
    <!-- Small grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;" class="pf-sub-grid">
      ${rest.slice(0, 4).map(p => `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};overflow:hidden;cursor:pointer;transition:all .3s;" onclick="window.open('${p.url || "#"}','_blank')">
        <img src="${p.imageUrl || ""}" alt="${p.title}" loading="lazy" style="width:100%;height:120px;object-fit:cover;background:var(--surface);">
        <div style="padding:12px;">
          <p style="font-size:10px;color:var(--primary);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:4px;">${p.category}</p>
          <h3 style="font-size:13px;font-weight:700;color:var(--text);">${p.title}</h3>
        </div>
      </div>`).join("")}
    </div>
  </div>
  <style>@media(max-width:768px){.pf-main-grid,.pf-sub-grid{grid-template-columns:1fr !important;}}</style>`;
  return wrapSection("portfolio", inner);
}

// ── Variant 4: Filter Gallery — category-filterable grid (most interactive) ──
export function portfolioFilterGallery(ctx: ComponentContext, c: PortfolioContent): string {
  const categories = ["All", ...Array.from(new Set(c.items.map(p => p.category)))];
  const inner = `${sectionHeader(c)}
  <!-- Filter buttons -->
  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:${SPACING.md};" id="pf-filters">
    ${categories.map((cat, i) => `
    <button onclick="filterPortfolio('${cat}')" style="padding:7px 18px;border-radius:${RADIUS.full};border:1px solid ${i === 0 ? "var(--primary)" : "var(--border)"};background:${i === 0 ? "rgba(var(--primary-rgb),0.1)" : "transparent"};color:${i === 0 ? "var(--primary)" : "var(--text-2)"};font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;" data-filter="${cat}">${cat}</button>`).join("")}
  </div>
  <!-- Gallery grid -->
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;" id="pf-gallery" class="pf-gallery">
    ${c.items.map(p => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};overflow:hidden;cursor:pointer;transition:all .3s;" data-category="${p.category}" onclick="window.open('${p.url || "#"}','_blank')">
      <img src="${p.imageUrl || ""}" alt="${p.title}" loading="lazy" style="width:100%;height:180px;object-fit:cover;background:var(--surface);">
      <div style="padding:14px;">
        <p style="font-size:10px;color:var(--primary);font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:5px;">${p.category}</p>
        <h3 style="font-size:14px;font-weight:700;color:var(--text);">${p.title}</h3>
        ${p.description ? `<p style="font-size:12px;color:var(--text-2);margin-top:4px;line-height:1.5;">${p.description.slice(0, 80)}${p.description.length > 80 ? "…" : ""}</p>` : ""}
      </div>
    </div>`).join("")}
  </div>
  <style>@media(max-width:768px){.pf-gallery{grid-template-columns:1fr !important;}}</style>
  <script>
  function filterPortfolio(cat){
    document.querySelectorAll('#pf-gallery>[data-category]').forEach(el=>{
      el.style.display=(cat==='All'||el.dataset.category===cat)?'block':'none';
    });
    document.querySelectorAll('#pf-filters button').forEach(btn=>{
      const active=btn.dataset.filter===cat;
      btn.style.borderColor=active?'var(--primary)':'var(--border)';
      btn.style.background=active?'rgba(var(--primary-rgb),0.1)':'transparent';
      btn.style.color=active?'var(--primary)':'var(--text-2)';
    });
  }
  </script>`;
  return wrapSection("portfolio", inner);
}

export const PORTFOLIO_VARIANTS = {
  "masonry":        portfolioMasonry,
  "list":           portfolioList,
  "featured-grid":  portfolioFeaturedGrid,
  "filter-gallery": portfolioFilterGallery,
} as const;

export type PortfolioVariant = keyof typeof PORTFOLIO_VARIANTS;

