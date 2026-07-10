// lib/theme-tokens.ts
// Single source of truth for the premium Black + Rich Yellow + White
// palette, for components using inline styles (which can't reference
// CSS custom properties as easily as class-based styling). Mirrors the
// --primary/--primary-hover/--primary-glow tokens in app/globals.css —
// keep both in sync if either changes.

export const PRIMARY       = "#FFD84D";
export const PRIMARY_HOVER = "#FFE57A";
export const PRIMARY_GLOW  = "rgba(255,216,77,0.25)";
export const WHITE         = "#FFFFFF";
export const SOFT_GRAY     = "#9AA3AF";
export const BORDER        = "rgba(255,216,77,0.12)";

// Single-color gradient-look for existing components that expect a
// `background: G` gradient string — solid primary, no green, no gradient
// banding, matches "Primary buttons: Solid #FFD84D" requirement while
// staying a drop-in replacement for the old `G` gradient constant.
export const PRIMARY_SOLID = PRIMARY;

// Text-gradient (gold → white) — only for decorative headline text
// where a two-tone effect reads as premium rather than for buttons.
export const HEADLINE_GRADIENT = `linear-gradient(135deg, ${PRIMARY} 0%, ${WHITE} 100%)`;

