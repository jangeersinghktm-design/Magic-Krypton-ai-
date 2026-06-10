// lib/branding.ts — Krypton AI Brand System
// Single source of truth for all brand tokens

export const BRAND = {
  name: "Krypton AI",
  tagline: "Build Anything. Ship Instantly.",

  colors: {
    // Primary gradient palette
    gold:       "#FFD700",
    amber:      "#FFB000",
    orange:     "#FF7A00",
    white:      "#FFFFFF",

    // Background palette
    bgDeep:     "#050816",
    bgDark:     "#080808",
    bgSurface:  "#0B1020",
    bgCard:     "#0D1530",

    // Text palette
    textPrimary: "#FFFFFF",
    textSecond:  "#94A3B8",
    textMuted:   "#4A5568",
    textDim:     "#2A2A2A",

    // Status
    success:  "#00D084",
    error:    "#EF4444",
    warning:  "#F59E0B",
    info:     "#3B82F6",
  },

  gradients: {
    primary:    "linear-gradient(135deg, #FFD700 0%, #FFB000 50%, #FF7A00 100%)",
    primaryH:   "linear-gradient(135deg, #FFE566 0%, #FFB000 50%, #FF5500 100%)",
    gold:       "linear-gradient(90deg,  #FFD700, #FFB000)",
    glow:       "radial-gradient(circle, rgba(255,215,0,0.15) 0%, transparent 70%)",
    surface:    "linear-gradient(135deg, rgba(255,215,0,0.06) 0%, rgba(255,122,0,0.02) 100%)",
    dark:       "linear-gradient(135deg, #0B1020 0%, #050816 100%)",
    cardBorder: "linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,122,0,0.1))",
  },

  borders: {
    subtle:  "rgba(255,215,0,0.08)",
    soft:    "rgba(255,215,0,0.15)",
    medium:  "rgba(255,215,0,0.25)",
    strong:  "rgba(255,215,0,0.45)",
  },

  shadows: {
    glow:    "0 0 24px rgba(255,215,0,0.2)",
    glowLg:  "0 0 48px rgba(255,215,0,0.15)",
    card:    "0 8px 32px rgba(0,0,0,0.4)",
    cardHov: "0 20px 56px rgba(0,0,0,0.6)",
    button:  "0 4px 20px rgba(255,176,0,0.35)",
  },

  typography: {
    heading:  "'Syne', 'DM Sans', system-ui, sans-serif",
    body:     "'DM Sans', 'Inter', system-ui, sans-serif",
    mono:     "'JetBrains Mono', 'DM Mono', monospace",
    tracking: {
      tight:  "-0.03em",
      normal: "0em",
      wide:   "0.08em",
      wider:  "0.15em",
    },
  },

  spacing: {
    xs: 4, sm: 8, md: 16, lg: 24,
    xl: 32, "2xl": 48, "3xl": 64, "4xl": 96,
  },

  radius: {
    sm: 6, md: 10, lg: 14,
    xl: 18, "2xl": 24, full: 9999,
  },

  animation: {
    fast:   "0.15s ease",
    normal: "0.25s ease",
    slow:   "0.4s ease",
    spring: "0.3s cubic-bezier(0.34,1.56,0.64,1)",
  },

  logo: {
    minSize:     14,
    defaultSize: 32,
    navSize:     34,
    heroSize:    56,
    iconPath:    "/favicon.svg",
  },
} as const;

// Helper to get CSS gradient string
export const gradient = (dir = "135deg") =>
  `linear-gradient(${dir}, ${BRAND.colors.gold} 0%, ${BRAND.colors.amber} 50%, ${BRAND.colors.orange} 100%)`;

// Gradient text style (inline style object)
export const gradientText = {
  background: BRAND.gradients.primary,
  WebkitBackgroundClip: "text" as const,
  WebkitTextFillColor:  "transparent" as const,
  backgroundClip:       "text" as const,
};

// Card style
export const cardStyle = (hover = false) => ({
  background:    BRAND.colors.bgCard,
  border:        `1px solid ${hover ? BRAND.borders.medium : BRAND.borders.subtle}`,
  borderRadius:  BRAND.radius.lg,
  boxShadow:     hover ? BRAND.shadows.cardHov : BRAND.shadows.card,
  transition:    BRAND.animation.normal,
});

// Button style
export const buttonStyle = {
  primary: {
    background:   BRAND.gradients.primary,
    border:       "none",
    color:        "#050816",
    fontWeight:   700,
    borderRadius: BRAND.radius.md,
    cursor:       "pointer",
    transition:   BRAND.animation.normal,
    boxShadow:    BRAND.shadows.button,
  },
  ghost: {
    background:   "transparent",
    border:       `1px solid ${BRAND.borders.soft}`,
    color:        BRAND.colors.textSecond,
    fontWeight:   500,
    borderRadius: BRAND.radius.md,
    cursor:       "pointer",
    transition:   BRAND.animation.normal,
  },
};
      
