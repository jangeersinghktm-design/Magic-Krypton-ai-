// lib/component-library/dashboard.ts
// KRYPTON AI Component Library — Dashboard Layout Variants

import { ComponentContext, SPACING, RADIUS, SHADOW } from "./tokens";

export interface StatCard { label: string; value: string; trend?: string; trendUp?: boolean; }
export interface NavItem { label: string; icon?: string; active?: boolean; }
export interface TableRow { cells: string[]; }

export interface DashboardContent {
  title: string;
  navItems: NavItem[];
  stats: StatCard[];
  tableHeaders?: string[];
  tableRows?: TableRow[];
}

function statCardHtml(s: StatCard, ctx: ComponentContext): string {
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.md};padding:${SPACING.sm};">
    <p style="font-size:12px;color:var(--text-2);margin-bottom:8px;">${s.label}</p>
    <div style="display:flex;align-items:baseline;gap:8px;">
      <span style="font-size:24px;font-weight:800;color:var(--text);">${s.value}</span>
      ${s.trend ? `<span style="font-size:12px;font-weight:600;color:${s.trendUp ? "#7CFFB2" : "#FF7A7A"};">${s.trend}</span>` : ""}
    </div>
  </div>`;
}

// ── Variant 1: Sidebar + Stats — classic admin layout with left nav ──
export function dashboardSidebarStats(ctx: ComponentContext, c: DashboardContent): string {
  return `<div style="display:flex;min-height:600px;background:var(--bg);" class="dash-layout">
  <aside style="width:220px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);padding:${SPACING.sm};" class="dash-sidebar">
    <div style="font-weight:800;font-size:16px;color:var(--text);margin-bottom:${SPACING.md};">${c.title}</div>
    ${c.navItems.map(n => `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:${RADIUS.sm};margin-bottom:4px;background:${n.active ? "rgba(var(--primary-rgb),0.1)" : "transparent"};color:${n.active ? "var(--primary)" : "var(--text-2)"};font-size:14px;cursor:pointer;">${n.icon || "○"} ${n.label}</div>`).join("")}
  </aside>
  <main style="flex:1;padding:${SPACING.md};overflow-x:hidden;">
    <div style="display:grid;grid-template-columns:repeat(${Math.min(c.stats.length, 4)},1fr);gap:${SPACING.sm};margin-bottom:${SPACING.md};" class="dash-stats">
      ${c.stats.map(s => statCardHtml(s, ctx)).join("")}
    </div>
    ${c.tableRows ? dashboardTableHtml(c) : ""}
  </main>
  </div>
  <style>@media(max-width:768px){.dash-layout{flex-direction:column;}.dash-sidebar{width:100%;display:flex;overflow-x:auto;}.dash-stats{grid-template-columns:repeat(2,1fr) !important;}}</style>`;
}

function dashboardTableHtml(c: DashboardContent): string {
  if (!c.tableHeaders || !c.tableRows) return "";
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.md};overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;min-width:480px;">
      <thead><tr style="border-bottom:1px solid var(--border);">${c.tableHeaders.map(h => `<th style="text-align:left;padding:12px 16px;font-size:12px;color:var(--text-2);">${h}</th>`).join("")}</tr></thead>
      <tbody>${c.tableRows.map(r => `<tr style="border-bottom:1px solid var(--border);">${r.cells.map(cell => `<td style="padding:12px 16px;font-size:13px;color:var(--text);">${cell}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  </div>`;
}

// ── Variant 2: Top Nav + Cards — horizontal nav, card-grid focus (lighter admin tools) ──
export function dashboardTopNavCards(ctx: ComponentContext, c: DashboardContent): string {
  return `<div style="background:var(--bg);">
  <nav style="display:flex;gap:24px;align-items:center;padding:16px ${SPACING.md};border-bottom:1px solid var(--border);overflow-x:auto;" class="dash-topnav">
    <span style="font-weight:800;color:var(--text);margin-right:12px;">${c.title}</span>
    ${c.navItems.map(n => `<span style="font-size:13px;color:${n.active ? "var(--primary)" : "var(--text-2)"};font-weight:${n.active ? "700" : "400"};white-space:nowrap;">${n.label}</span>`).join("")}
  </nav>
  <div style="padding:${SPACING.md};">
    <div style="display:grid;grid-template-columns:repeat(${Math.min(c.stats.length, 4)},1fr);gap:${SPACING.sm};" class="dash-stats">
      ${c.stats.map(s => statCardHtml(s, ctx)).join("")}
    </div>
  </div>
  </div>
  <style>@media(max-width:768px){.dash-stats{grid-template-columns:repeat(2,1fr) !important;}}</style>`;
}

// ── Variant 3: Kanban — column-based board (project mgmt / task tools) ──
export function dashboardKanban(ctx: ComponentContext, c: DashboardContent): string {
  const columns = c.navItems.length ? c.navItems : [{ label: "To Do" }, { label: "In Progress" }, { label: "Done" }];
  return `<div style="background:var(--bg);padding:${SPACING.md};">
  <div style="font-weight:800;font-size:18px;color:var(--text);margin-bottom:${SPACING.sm};">${c.title}</div>
  <div style="display:flex;gap:${SPACING.sm};overflow-x:auto;padding-bottom:8px;" class="dash-kanban">
    ${columns.map(col => `
    <div style="min-width:260px;background:var(--surface);border-radius:${RADIUS.md};padding:${SPACING.sm};flex-shrink:0;">
      <p style="font-size:13px;font-weight:700;color:var(--text-2);margin-bottom:12px;">${col.label}</p>
      ${[1, 2].map(() => `<div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.sm};padding:12px;margin-bottom:8px;font-size:13px;color:var(--text);">Task item</div>`).join("")}
    </div>`).join("")}
  </div>
  </div>`;
}

// ── Variant 4: Analytics Charts — large chart placeholders + stat row (analytics tools) ──
export function dashboardAnalyticsCharts(ctx: ComponentContext, c: DashboardContent): string {
  return `<div style="background:var(--bg);padding:${SPACING.md};">
  <div style="font-weight:800;font-size:18px;color:var(--text);margin-bottom:${SPACING.sm};">${c.title}</div>
  <div style="display:grid;grid-template-columns:repeat(${Math.min(c.stats.length, 4)},1fr);gap:${SPACING.sm};margin-bottom:${SPACING.md};" class="dash-stats">
    ${c.stats.map(s => statCardHtml(s, ctx)).join("")}
  </div>
  <div style="display:grid;grid-template-columns:2fr 1fr;gap:${SPACING.sm};" class="dash-charts">
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.md};padding:${SPACING.sm};min-height:280px;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:13px;">[Line chart: trend over time]</div>
    <div style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.md};padding:${SPACING.sm};min-height:280px;display:flex;align-items:center;justify-content:center;color:var(--text-2);font-size:13px;">[Donut: breakdown]</div>
  </div>
  </div>
  <style>@media(max-width:768px){.dash-stats{grid-template-columns:repeat(2,1fr) !important;}.dash-charts{grid-template-columns:1fr !important;}}</style>`;
}

// ── Variant 5: Table Heavy — data-grid focused (CRM/admin record management) ──
export function dashboardTableHeavy(ctx: ComponentContext, c: DashboardContent): string {
  return `<div style="background:var(--bg);padding:${SPACING.md};">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${SPACING.sm};flex-wrap:wrap;gap:12px;">
    <div style="font-weight:800;font-size:18px;color:var(--text);">${c.title}</div>
    <input type="search" placeholder="Search..." aria-label="Search records" style="background:var(--card);border:1px solid var(--border);border-radius:${RADIUS.sm};padding:8px 14px;color:var(--text);font-size:13px;">
  </div>
  ${dashboardTableHtml(c)}
  </div>`;
}

export const DASHBOARD_VARIANTS = {
  "sidebar-stats":     dashboardSidebarStats,
  "topnav-cards":      dashboardTopNavCards,
  "kanban":            dashboardKanban,
  "analytics-charts":  dashboardAnalyticsCharts,
  "table-heavy":       dashboardTableHeavy,
} as const;

export type DashboardVariant = keyof typeof DASHBOARD_VARIANTS;
