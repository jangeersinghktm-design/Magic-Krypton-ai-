// lib/component-library/footer.ts
// KRYPTON AI Component Library — Footer Variants
// Every variant guarantees Quality Gate 2.0's "missing footer" check passes
// AND includes real columns/links — fixes the recurring "thin footer" bug.

import { ComponentContext, SPACING, RADIUS } from "./tokens";

export interface FooterLinkColumn {
  title: string;
  links: { label: string; href: string }[];
}

export interface FooterContent {
  logoText: string;
  tagline?: string;
  columns: FooterLinkColumn[];
  socialLinks?: { label: string; href: string }[];
  email?: string;
  copyrightName: string;
}

function copyrightBar(c: FooterContent): string {
  return `<div style="border-top:1px solid var(--border);padding-top:${SPACING.md};margin-top:${SPACING.md};display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
    <p style="font-size:13px;color:var(--text-2);">&copy; 2026 ${c.copyrightName}. All rights reserved.</p>
    ${c.socialLinks?.length ? `<div style="display:flex;gap:18px;">${c.socialLinks.map(s => `<a href="${s.href}" style="color:var(--text-2);text-decoration:none;font-size:13px;">${s.label}</a>`).join("")}</div>` : ""}
  </div>`;
}

// ── Variant 1: Four Column — the gold standard rich footer ──
export function footerFourColumn(ctx: ComponentContext, c: FooterContent): string {
  return `<footer style="padding:${SPACING.xl} ${SPACING.md} ${SPACING.md};border-top:1px solid var(--border);">
  <div class="container" style="max-width:1200px;margin:0 auto;">
    <div style="display:grid;grid-template-columns:1.4fr repeat(${Math.min(c.columns.length, 3)},1fr);gap:${SPACING.lg};margin-bottom:${SPACING.md};" class="footer-grid">
      <div>
        <div style="font-family:var(--heading-font);font-weight:800;font-size:20px;color:var(--text);margin-bottom:10px;">${c.logoText}</div>
        ${c.tagline ? `<p style="font-size:13px;color:var(--text-2);max-width:240px;line-height:1.6;">${c.tagline}</p>` : ""}
      </div>
      ${c.columns.map(col => `
      <div>
        <p style="font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--text-2);margin-bottom:14px;">${col.title}</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${col.links.map(l => `<a href="${l.href}" style="color:var(--text-2);text-decoration:none;font-size:13px;">${l.label}</a>`).join("")}
        </div>
      </div>`).join("")}
    </div>
    ${copyrightBar(c)}
  </div>
  <style>@media(max-width:768px){.footer-grid{grid-template-columns:repeat(2,1fr) !important;}}</style>
</footer>`;
}

// ── Variant 2: Minimal Centered — single row, logo+links+social (portfolio/minimal brands) ──
export function footerMinimalCentered(ctx: ComponentContext, c: FooterContent): string {
  const allLinks = c.columns.flatMap(col => col.links);
  return `<footer style="padding:${SPACING.lg} ${SPACING.md};border-top:1px solid var(--border);text-align:center;">
  <div class="container" style="max-width:800px;margin:0 auto;">
    <div style="font-family:var(--heading-font);font-weight:800;font-size:18px;color:var(--text);margin-bottom:${SPACING.sm};">${c.logoText}</div>
    <div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;margin-bottom:${SPACING.sm};">
      ${allLinks.map(l => `<a href="${l.href}" style="color:var(--text-2);text-decoration:none;font-size:13px;">${l.label}</a>`).join("")}
    </div>
    <p style="font-size:13px;color:var(--text-2);">&copy; 2026 ${c.copyrightName}. All rights reserved.</p>
  </div>
</footer>`;
}

// ── Variant 3: Newsletter Rich — CTA email-capture built into footer (content/SaaS) ──
export function footerNewsletterRich(ctx: ComponentContext, c: FooterContent): string {
  return `<footer style="padding:${SPACING.xl} ${SPACING.md} ${SPACING.md};border-top:1px solid var(--border);">
  <div class="container" style="max-width:1200px;margin:0 auto;">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:${SPACING.md};background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.lg};padding:${SPACING.md} ${SPACING.lg};margin-bottom:${SPACING.lg};">
      <div>
        <h3 style="font-size:18px;font-weight:700;color:var(--text);margin-bottom:4px;">Stay updated</h3>
        <p style="font-size:13px;color:var(--text-2);">Get the latest news straight to your inbox.</p>
      </div>
      <form style="display:flex;gap:10px;" onsubmit="event.preventDefault();this.querySelector('button').textContent='✓';">
        <input type="email" required placeholder="${c.email || "you@email.com"}" aria-label="Email" style="background:rgba(255,255,255,0.04);border:1px solid var(--border);border-radius:${RADIUS.md};padding:10px 16px;color:var(--text);font-size:13px;min-width:180px;">
        <button type="submit" style="background:var(--grad);color:#fff;border:none;border-radius:${RADIUS.md};padding:10px 22px;font-weight:700;font-size:13px;cursor:pointer;">Subscribe</button>
      </form>
    </div>
    <div style="display:grid;grid-template-columns:repeat(${Math.min(c.columns.length, 4)},1fr);gap:${SPACING.md};" class="footer-grid">
      ${c.columns.map(col => `
      <div>
        <p style="font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--text-2);margin-bottom:14px;">${col.title}</p>
        <div style="display:flex;flex-direction:column;gap:10px;">
          ${col.links.map(l => `<a href="${l.href}" style="color:var(--text-2);text-decoration:none;font-size:13px;">${l.label}</a>`).join("")}
        </div>
      </div>`).join("")}
    </div>
    ${copyrightBar(c)}
  </div>
  <style>@media(max-width:768px){.footer-grid{grid-template-columns:repeat(2,1fr) !important;}}</style>
</footer>`;
}

// ── Variant 4: Mega Social — large social icons row + columns, brand-forward (agency/ecommerce) ──
export function footerMegaSocial(ctx: ComponentContext, c: FooterContent): string {
  return `<footer style="padding:${SPACING.xl} ${SPACING.md} ${SPACING.md};border-top:1px solid var(--border);">
  <div class="container" style="max-width:1200px;margin:0 auto;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:${SPACING.lg};margin-bottom:${SPACING.lg};">
      <div style="max-width:280px;">
        <div style="font-family:var(--heading-font);font-weight:800;font-size:22px;color:var(--text);margin-bottom:10px;">${c.logoText}</div>
        ${c.tagline ? `<p style="font-size:13px;color:var(--text-2);line-height:1.6;margin-bottom:16px;">${c.tagline}</p>` : ""}
        ${c.socialLinks?.length ? `<div style="display:flex;gap:12px;">${c.socialLinks.map(s => `<a href="${s.href}" aria-label="${s.label}" style="width:36px;height:36px;border-radius:${RADIUS.full};background:var(--card);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--text-2);text-decoration:none;font-size:13px;">${s.label[0]}</a>`).join("")}</div>` : ""}
      </div>
      <div style="display:flex;gap:${SPACING.xl};flex-wrap:wrap;" class="footer-cols">
        ${c.columns.map(col => `
        <div>
          <p style="font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--text-2);margin-bottom:14px;">${col.title}</p>
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${col.links.map(l => `<a href="${l.href}" style="color:var(--text-2);text-decoration:none;font-size:13px;">${l.label}</a>`).join("")}
          </div>
        </div>`).join("")}
      </div>
    </div>
    ${copyrightBar(c)}
  </div>
</footer>`;
}

export const FOOTER_VARIANTS = {
  "four-column":     footerFourColumn,
  "minimal-centered": footerMinimalCentered,
  "newsletter-rich": footerNewsletterRich,
  "mega-social":     footerMegaSocial,
} as const;

export type FooterVariant = keyof typeof FOOTER_VARIANTS;
