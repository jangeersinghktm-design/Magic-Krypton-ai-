// lib/component-library/ecommerce.ts
// KRYPTON AI Component Library — E-Commerce Component Variants

import { ComponentContext, SPACING, RADIUS, SHADOW, renderButton, wrapSection } from "./tokens";

export interface ProductCard {
  name: string;
  price: string;
  originalPrice?: string;
  category?: string;
  badge?: string;       // "New", "Sale", "Bestseller"
  description?: string;
  imageUrl?: string;
  rating?: number;
  reviewCount?: number;
}

export interface EcommerceContent {
  eyebrow?: string;
  headline: string;
  subheadline?: string;
  products: ProductCard[];
  ctaText?: string;
}

function stars(n: number = 5, count?: number): string {
  return `<div style="display:flex;align-items:center;gap:4px;">
    <div style="display:flex;gap:1px;">${Array.from({length: 5}, (_, i) => `<span style="color:${i < n ? "#F59E0B" : "rgba(255,255,255,0.15)"};" aria-hidden="true">★</span>`).join("")}</div>
    ${count ? `<span style="font-size:11px;color:var(--text-2);">(${count})</span>` : ""}
  </div>`;
}

function productBadge(badge: string): string {
  const colors: Record<string, string> = {
    "New": "var(--primary)", "Sale": "#EF4444", "Bestseller": "#F59E0B", "Hot": "#EF4444",
  };
  const color = colors[badge] || "var(--primary)";
  return `<div style="position:absolute;top:12px;left:12px;background:${color};color:#fff;font-size:10px;font-weight:700;padding:3px 10px;border-radius:${RADIUS.full};text-transform:uppercase;letter-spacing:0.06em;">${badge}</div>`;
}

function sectionHeader(c: EcommerceContent): string {
  return `<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:${SPACING.lg};flex-wrap:wrap;gap:16px;">
    <div>
      ${c.eyebrow ? `<p style="font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:var(--primary);margin-bottom:12px;">${c.eyebrow}</p>` : ""}
      <h2 style="font-family:var(--heading-font);font-weight:var(--heading-weight);font-size:clamp(24px,4vw,40px);color:var(--text);margin-bottom:${c.subheadline ? "8px" : "0"};">${c.headline}</h2>
      ${c.subheadline ? `<p style="font-size:15px;color:var(--text-2);">${c.subheadline}</p>` : ""}
    </div>
    ${c.ctaText ? `<a href="#" style="font-size:13px;color:var(--primary);text-decoration:none;font-weight:600;display:flex;align-items:center;gap:4px;white-space:nowrap;">${c.ctaText} →</a>` : ""}
  </div>`;
}

// ── Variant 1: Product Grid — clean 3-col product cards ──
export function ecommerceProductGrid(ctx: ComponentContext, c: EcommerceContent): string {
  const inner = `${sectionHeader(c)}
  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;" class="product-grid">
    ${c.products.map(p => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};overflow:hidden;transition:all .3s;cursor:pointer;" onmouseenter="this.style.transform='translateY(-4px)';this.style.borderColor='var(--border-accent)'" onmouseleave="this.style.transform='';this.style.borderColor='var(--border)'">
      <div style="position:relative;">
        <img src="${p.imageUrl || ""}" alt="${p.name}" loading="lazy" style="width:100%;height:220px;object-fit:cover;background:var(--surface);display:block;">
        ${p.badge ? productBadge(p.badge) : ""}
        <button style="position:absolute;bottom:12px;right:12px;background:var(--grad);color:#fff;border:none;border-radius:${RADIUS.full};width:36px;height:36px;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:18px;box-shadow:${SHADOW.md};transition:transform .2s;" onmouseenter="this.style.transform='scale(1.1)'" onmouseleave="this.style.transform=''">+</button>
      </div>
      <div style="padding:16px;">
        ${p.category ? `<p style="font-size:11px;color:var(--text-2);text-transform:uppercase;letter-spacing:0.08em;margin-bottom:6px;">${p.category}</p>` : ""}
        <h3 style="font-size:15px;font-weight:700;color:var(--text);margin-bottom:6px;">${p.name}</h3>
        ${p.rating ? `<div style="margin-bottom:8px;">${stars(p.rating, p.reviewCount)}</div>` : ""}
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:18px;font-weight:800;color:var(--text);">${p.price}</span>
          ${p.originalPrice ? `<span style="font-size:14px;color:var(--text-2);text-decoration:line-through;">${p.originalPrice}</span>` : ""}
        </div>
      </div>
    </div>`).join("")}
  </div>
  <style>@media(max-width:768px){.product-grid{grid-template-columns:repeat(2,1fr) !important;}}@media(max-width:480px){.product-grid{grid-template-columns:1fr !important;}}</style>`;
  return wrapSection("products", inner);
}

// ── Variant 2: Featured Product — large hero product showcase ──
export function ecommerceFeaturedProduct(ctx: ComponentContext, c: EcommerceContent): string {
  const p = c.products[0];
  const related = c.products.slice(1, 4);
  const inner = `${sectionHeader(c)}
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:${SPACING.xl};align-items:center;margin-bottom:${SPACING.lg};" class="feat-prod-grid">
    <div style="position:relative;border-radius:${RADIUS.xl};overflow:hidden;">
      <img src="${p?.imageUrl || ""}" alt="${p?.name || ""}" loading="lazy" style="width:100%;height:500px;object-fit:cover;background:var(--surface);display:block;">
      ${p?.badge ? productBadge(p.badge) : ""}
    </div>
    <div>
      ${p?.category ? `<p style="font-size:11px;color:var(--primary);font-weight:700;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:12px;">${p.category}</p>` : ""}
      <h2 style="font-family:var(--heading-font);font-size:clamp(28px,4vw,44px);font-weight:var(--heading-weight);color:var(--text);margin-bottom:16px;">${p?.name || ""}</h2>
      ${p?.rating ? `<div style="margin-bottom:16px;">${stars(p.rating, p.reviewCount)}</div>` : ""}
      ${p?.description ? `<p style="font-size:15px;color:var(--text-2);line-height:1.8;margin-bottom:${SPACING.md};">${p.description}</p>` : ""}
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:${SPACING.md};">
        <span style="font-family:var(--heading-font);font-size:36px;font-weight:700;color:var(--text);">${p?.price || ""}</span>
        ${p?.originalPrice ? `<span style="font-size:18px;color:var(--text-2);text-decoration:line-through;">${p.originalPrice}</span>` : ""}
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;">
        <a href="#" style="flex:1;display:block;text-align:center;padding:15px 28px;background:var(--grad);color:#fff;border-radius:${RADIUS.md};font-weight:700;text-decoration:none;font-size:15px;">Add to Cart</a>
        <a href="#" style="padding:15px 20px;background:transparent;color:var(--text);border:1px solid var(--border);border-radius:${RADIUS.md};text-decoration:none;font-size:18px;" title="Save">♡</a>
      </div>
    </div>
  </div>
  ${related.length > 0 ? `<div style="display:grid;grid-template-columns:repeat(${related.length},1fr);gap:12px;" class="related-grid">
    ${related.map(r => `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.md};overflow:hidden;cursor:pointer;display:flex;gap:12px;padding:12px;">
      <img src="${r.imageUrl || ""}" alt="${r.name}" loading="lazy" style="width:70px;height:70px;object-fit:cover;border-radius:${RADIUS.sm};background:var(--surface);flex-shrink:0;">
      <div><h3 style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px;">${r.name}</h3><span style="font-size:15px;font-weight:700;color:var(--text);">${r.price}</span></div>
    </div>`).join("")}
  </div>` : ""}
  <style>@media(max-width:768px){.feat-prod-grid,.related-grid{grid-template-columns:1fr !important;}}</style>`;
  return wrapSection("products", inner);
}

// ── Variant 3: Horizontal Scroll Cards — mobile-first swipeable (trending) ──
export function ecommerceScrollCards(ctx: ComponentContext, c: EcommerceContent): string {
  const inner = `${sectionHeader(c)}
  <div style="display:flex;gap:16px;overflow-x:auto;padding-bottom:8px;-webkit-overflow-scrolling:touch;scrollbar-width:none;" class="scroll-products">
    ${c.products.map(p => `
    <div style="min-width:240px;background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};overflow:hidden;flex-shrink:0;transition:all .25s;cursor:pointer;" onmouseenter="this.style.borderColor='var(--border-accent)'" onmouseleave="this.style.borderColor='var(--border)'">
      <div style="position:relative;">
        <img src="${p.imageUrl || ""}" alt="${p.name}" loading="lazy" style="width:100%;height:200px;object-fit:cover;background:var(--surface);display:block;">
        ${p.badge ? productBadge(p.badge) : ""}
      </div>
      <div style="padding:14px;">
        <h3 style="font-size:14px;font-weight:700;color:var(--text);margin-bottom:4px;">${p.name}</h3>
        ${p.rating ? `<div style="margin-bottom:8px;">${stars(p.rating)}</div>` : ""}
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:17px;font-weight:800;color:var(--text);">${p.price}</span>
          <button style="background:var(--grad);color:#fff;border:none;border-radius:${RADIUS.sm};padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;">Add</button>
        </div>
      </div>
    </div>`).join("")}
  </div>
  <style>.scroll-products::-webkit-scrollbar{display:none;}</style>`;
  return wrapSection("products", inner);
}

// ── Variant 4: Category Showcase — grouped by category with headers ──
export function ecommerceCategoryShowcase(ctx: ComponentContext, c: EcommerceContent): string {
  // Group products by category
  const grouped: Record<string, ProductCard[]> = {};
  c.products.forEach(p => {
    const cat = p.category || "Other";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });

  const inner = `${sectionHeader(c)}
  ${Object.entries(grouped).map(([cat, products]) => `
  <div style="margin-bottom:${SPACING.lg};">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${SPACING.md};">
      <h3 style="font-size:18px;font-weight:700;color:var(--text);">${cat}</h3>
      <a href="#" style="font-size:13px;color:var(--primary);text-decoration:none;font-weight:600;">View all →</a>
    </div>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(products.length, 4)},1fr);gap:14px;" class="cat-grid">
      ${products.slice(0, 4).map(p => `
      <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.md};overflow:hidden;cursor:pointer;transition:all .25s;" onmouseenter="this.style.transform='translateY(-3px)'" onmouseleave="this.style.transform=''">
        <img src="${p.imageUrl || ""}" alt="${p.name}" loading="lazy" style="width:100%;height:160px;object-fit:cover;background:var(--surface);display:block;">
        <div style="padding:12px;">
          <h4 style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:4px;">${p.name}</h4>
          <span style="font-size:15px;font-weight:800;color:var(--text);">${p.price}</span>
        </div>
      </div>`).join("")}
    </div>
  </div>`).join("")}
  <style>@media(max-width:768px){.cat-grid{grid-template-columns:repeat(2,1fr) !important;}}</style>`;
  return wrapSection("products", inner);
}

export const ECOMMERCE_VARIANTS = {
  "product-grid":      ecommerceProductGrid,
  "featured-product":  ecommerceFeaturedProduct,
  "scroll-cards":      ecommerceScrollCards,
  "category-showcase": ecommerceCategoryShowcase,
} as const;

export type EcommerceVariant = keyof typeof ECOMMERCE_VARIANTS;

