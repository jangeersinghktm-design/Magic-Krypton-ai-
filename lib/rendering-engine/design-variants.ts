// lib/rendering-engine/design-variants.ts
// Shared Design Diversity Engine — the real, professionally-designed
// variant library (3+ per industry) plus the seeded picker/shuffler.
// Imported by BOTH orchestrate and generate routes so every generation
// path draws from the exact same variant data, never duplicated.

import type { NicheProfile, NichePalette, NicheTypography } from "./types";
import { createSeededRandom } from "@/lib/design-engine";

export interface DesignVariant {
  name: string;           // e.g. "Modern Black", "Apple Style"
  tone: string;           // feeds getDesignLanguage() — real structural variety (hero/card/button/motion), not just color
  palette: NichePalette;
  typography: NicheTypography;
}

// mulberry32 — compact, well-known deterministic PRNG. Seeded ONCE per
// generation (from crypto.randomUUID(), never Math.random() directly),
// then every variant-pick within that generation draws from this same
// deterministic sequence: same seed replayed = same design, every new
// generation = a fresh seed = a different design.

export const INDUSTRY_VARIANTS: Record<string, DesignVariant[]> = {
  "Luxury & Fashion": [
    { name: "Modern Black", tone: "editorial", palette: {
      primary:"#C9A84C", secondary:"#8B6914", bg:"#050400", surface:"#0A0900", card:"#100E00",
      text2:"#C8B98A", accent:"#F0D080", grad:"linear-gradient(135deg,#C9A84C,#8B6914)",
      heroGrad:"linear-gradient(135deg,#0A0800 0%,#1A1400 40%,#0F0C00 100%)" },
      typography: { headingFont:"'Cormorant Garamond', serif", bodyFont:"'Jost', sans-serif", headingWeight:"300", headingSpacing:"0.08em", headingStyle:"editorial",
        googleFonts:"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Jost:wght@300;400;500&display=swap" } },
    { name: "White Minimal", tone: "minimal-light", palette: {
      primary:"#1A1A1A", secondary:"#8A7355", bg:"#FDFCFA", surface:"#F5F3EF", card:"#FFFFFF",
      text2:"#6B6560", accent:"#B8935F", grad:"linear-gradient(135deg,#1A1A1A,#8A7355)",
      heroGrad:"linear-gradient(135deg,#FDFCFA 0%,#F5F1EA 50%,#FDFCFA 100%)" },
      typography: { headingFont:"'Cormorant Garamond', serif", bodyFont:"'Inter', sans-serif", headingWeight:"400", headingSpacing:"0.02em", headingStyle:"editorial-light",
        googleFonts:"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@300;400;500&display=swap" } },
    { name: "Emerald Premium", tone: "glass-premium", palette: {
      primary:"#0E6B4F", secondary:"#D4AF37", bg:"#040807", surface:"#081210", card:"#0D1815",
      text2:"#9FB8AE", accent:"#2ECC91", grad:"linear-gradient(135deg,#0E6B4F,#D4AF37)",
      heroGrad:"linear-gradient(135deg,#040807 0%,#0A1A14 45%,#050A08 100%)" },
      typography: { headingFont:"'Fraunces', serif", bodyFont:"'Work Sans', sans-serif", headingWeight:"400", headingSpacing:"0.01em", headingStyle:"editorial",
        googleFonts:"https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500;600&family=Work+Sans:wght@300;400;500&display=swap" } },
  ],
  "Fitness & Wellness": [
    { name: "Neon Athletic", tone: "energetic", palette: {
      primary:"#22C55E", secondary:"#16A34A", bg:"#020B04", surface:"#041308", card:"#071A0C",
      text2:"#8FBFA0", accent:"#4ADE80", grad:"linear-gradient(135deg,#22C55E,#16A34A)",
      heroGrad:"linear-gradient(135deg,#020B04 0%,#062010 45%,#020B04 100%)" },
      typography: { headingFont:"'Archivo Black', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"900", headingSpacing:"-0.01em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;700&display=swap" } },
    { name: "Minimal White", tone: "minimal-light", palette: {
      primary:"#0F172A", secondary:"#DC2626", bg:"#FAFAFA", surface:"#F1F1F1", card:"#FFFFFF",
      text2:"#525252", accent:"#EF4444", grad:"linear-gradient(135deg,#0F172A,#DC2626)",
      heroGrad:"linear-gradient(135deg,#FAFAFA 0%,#F0F0F0 100%)" },
      typography: { headingFont:"'Bebas Neue', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"400", headingSpacing:"0.02em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;500;600&display=swap" } },
    { name: "Red Performance", tone: "industrial", palette: {
      primary:"#EF4444", secondary:"#1F1F1F", bg:"#0A0505", surface:"#120808", card:"#180A0A",
      text2:"#C99", accent:"#FF6B6B", grad:"linear-gradient(135deg,#EF4444,#991B1B)",
      heroGrad:"linear-gradient(135deg,#0A0505 0%,#1A0808 45%,#0A0505 100%)" },
      typography: { headingFont:"'Oswald', sans-serif", bodyFont:"'Roboto', sans-serif", headingWeight:"700", headingSpacing:"0.03em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Oswald:wght@500;700&family=Roboto:wght@400;500&display=swap" } },
  ],
  "Food & Dining": [
    { name: "Elegant Fine Dining", tone: "editorial", palette: {
      primary:"#8B1A2B", secondary:"#C9A84C", bg:"#0A0605", surface:"#120A08", card:"#170D0B",
      text2:"#D4B8A8", accent:"#D4AF37", grad:"linear-gradient(135deg,#8B1A2B,#C9A84C)",
      heroGrad:"linear-gradient(135deg,#0A0605 0%,#1A0D0A 45%,#0A0605 100%)" },
      typography: { headingFont:"'Playfair Display', serif", bodyFont:"'Lato', sans-serif", headingWeight:"500", headingSpacing:"0.01em", headingStyle:"editorial",
        googleFonts:"https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Lato:wght@300;400&display=swap" } },
    { name: "Street Food Bold", tone: "playful", palette: {
      primary:"#F97316", secondary:"#EAB308", bg:"#0C0704", surface:"#160D06", card:"#1D1108",
      text2:"#E8C9A0", accent:"#FBBF24", grad:"linear-gradient(135deg,#F97316,#EAB308)",
      heroGrad:"linear-gradient(135deg,#0C0704 0%,#1F1206 45%,#0C0704 100%)" },
      typography: { headingFont:"'Baloo 2', sans-serif", bodyFont:"'Nunito', sans-serif", headingWeight:"700", headingSpacing:"0", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=Nunito:wght@400;600&display=swap" } },
    { name: "Modern Cafe Warm", tone: "warm", palette: {
      primary:"#B8703F", secondary:"#6B4226", bg:"#0B0806", surface:"#15100C", card:"#1C1510",
      text2:"#D9C4B0", accent:"#E0A868", grad:"linear-gradient(135deg,#B8703F,#6B4226)",
      heroGrad:"linear-gradient(135deg,#0B0806 0%,#1A140E 45%,#0B0806 100%)" },
      typography: { headingFont:"'Fraunces', serif", bodyFont:"'DM Sans', sans-serif", headingWeight:"500", headingSpacing:"0", headingStyle:"editorial",
        googleFonts:"https://fonts.googleapis.com/css2?family=Fraunces:wght@450;550&family=DM+Sans:wght@400;500&display=swap" } },
  ],
  "Crypto & Web3": [
    { name: "Neon Cyber", tone: "glass-premium", palette: {
      primary:"#8B5CF6", secondary:"#06B6D4", bg:"#05030A", surface:"#0A0714", card:"#0F0B1A",
      text2:"#B8ACD9", accent:"#A855F7", grad:"linear-gradient(135deg,#8B5CF6,#06B6D4)",
      heroGrad:"linear-gradient(135deg,#05030A 0%,#150A2A 45%,#05030A 100%)" },
      typography: { headingFont:"'Space Grotesk', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"-0.01em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500&display=swap" } },
    { name: "Dark Terminal", tone: "industrial", palette: {
      primary:"#00FF9C", secondary:"#00B8D9", bg:"#000502", surface:"#020A05", card:"#040F08",
      text2:"#7FBFA0", accent:"#00FFB2", grad:"linear-gradient(135deg,#00FF9C,#00B8D9)",
      heroGrad:"linear-gradient(135deg,#000502 0%,#001A0F 45%,#000502 100%)" },
      typography: { headingFont:"'JetBrains Mono', monospace", bodyFont:"'IBM Plex Sans', sans-serif", headingWeight:"600", headingSpacing:"0", headingStyle:"technical",
        googleFonts:"https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=IBM+Plex+Sans:wght@400;500&display=swap" } },
    { name: "Gold Blockchain", tone: "bold", palette: {
      primary:"#F5B942", secondary:"#1E293B", bg:"#050403", surface:"#0A0806", card:"#100D09",
      text2:"#C9B896", accent:"#FFCF6B", grad:"linear-gradient(135deg,#F5B942,#1E293B)",
      heroGrad:"linear-gradient(135deg,#050403 0%,#160F05 45%,#050403 100%)" },
      typography: { headingFont:"'Sora', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"700", headingSpacing:"-0.01em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500&display=swap" } },
  ],
  "SaaS & Technology": [
    { name: "Apple Style", tone: "clean", palette: {
      primary:"#0A84FF", secondary:"#5E5CE6", bg:"#000000", surface:"#0A0A0C", card:"#111114",
      text2:"#A1A1AA", accent:"#64D2FF", grad:"linear-gradient(135deg,#0A84FF,#5E5CE6)",
      heroGrad:"linear-gradient(135deg,#000000 0%,#0A0E1A 45%,#000000 100%)" },
      typography: { headingFont:"'Inter', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"-0.02em", headingStyle:"clean",
        googleFonts:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" } },
    { name: "Stripe Style", tone: "trust", palette: {
      primary:"#635BFF", secondary:"#0A2540", bg:"#0A0E17", surface:"#0F1420", card:"#141A28",
      text2:"#8792A2", accent:"#00D4FF", grad:"linear-gradient(135deg,#635BFF,#0A2540)",
      heroGrad:"linear-gradient(135deg,#0A0E17 0%,#141033 45%,#0A0E17 100%)" },
      typography: { headingFont:"'Söhne', 'Inter', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"-0.01em", headingStyle:"clean",
        googleFonts:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" } },
    { name: "Linear Style", tone: "bold", palette: {
      primary:"#5E6AD2", secondary:"#8B92B8", bg:"#08090A", surface:"#0C0D10", card:"#111216",
      text2:"#8A8F98", accent:"#7C89F9", grad:"linear-gradient(135deg,#5E6AD2,#8B92B8)",
      heroGrad:"linear-gradient(135deg,#08090A 0%,#0F0F1A 45%,#08090A 100%)" },
      typography: { headingFont:"'Inter', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"-0.02em", headingStyle:"clean",
        googleFonts:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" } },
    { name: "Framer Style", tone: "glass-premium", palette: {
      primary:"#FF3366", secondary:"#0055FF", bg:"#050505", surface:"#0A0A0C", card:"#111114",
      text2:"#A0A0A8", accent:"#FF6B9D", grad:"linear-gradient(135deg,#FF3366,#0055FF)",
      heroGrad:"linear-gradient(135deg,#050505 0%,#150818 45%,#050505 100%)" },
      typography: { headingFont:"'Inter', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"700", headingSpacing:"-0.03em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap" } },
    { name: "Enterprise Blue", tone: "minimal-light", palette: {
      primary:"#1D4ED8", secondary:"#0F172A", bg:"#FAFBFC", surface:"#F1F4F8", card:"#FFFFFF",
      text2:"#475569", accent:"#3B82F6", grad:"linear-gradient(135deg,#1D4ED8,#0F172A)",
      heroGrad:"linear-gradient(135deg,#FAFBFC 0%,#EEF2F9 100%)" },
      typography: { headingFont:"'Inter', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"-0.01em", headingStyle:"clean",
        googleFonts:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" } },
  ],
  "Finance & Fintech": [
    { name: "Trust Navy", tone: "trust", palette: {
      primary:"#2563EB", secondary:"#0F172A", bg:"#050810", surface:"#0A0F1C", card:"#0F1524",
      text2:"#94A3B8", accent:"#38BDF8", grad:"linear-gradient(135deg,#2563EB,#0F172A)",
      heroGrad:"linear-gradient(135deg,#050810 0%,#0A1428 45%,#050810 100%)" },
      typography: { headingFont:"'IBM Plex Sans', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"-0.01em", headingStyle:"clean",
        googleFonts:"https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@500;600;700&family=Inter:wght@400;500&display=swap" } },
    { name: "Emerald Wealth", tone: "minimal-light", palette: {
      primary:"#065F46", secondary:"#0F172A", bg:"#FAFCFB", surface:"#F0F5F2", card:"#FFFFFF",
      text2:"#475569", accent:"#10B981", grad:"linear-gradient(135deg,#065F46,#0F172A)",
      heroGrad:"linear-gradient(135deg,#FAFCFB 0%,#EEF7F1 100%)" },
      typography: { headingFont:"'Source Serif 4', serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"0", headingStyle:"clean",
        googleFonts:"https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500;600&family=Inter:wght@400;500&display=swap" } },
    { name: "Bold Fintech", tone: "bold", palette: {
      primary:"#7C3AED", secondary:"#F59E0B", bg:"#07050C", surface:"#0C0912", card:"#110D19",
      text2:"#A99FC2", accent:"#A78BFA", grad:"linear-gradient(135deg,#7C3AED,#F59E0B)",
      heroGrad:"linear-gradient(135deg,#07050C 0%,#160D28 45%,#07050C 100%)" },
      typography: { headingFont:"'Sora', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"700", headingSpacing:"-0.02em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500&display=swap" } },
  ],
  "Creative Agency": [
    { name: "Linear Bold", tone: "bold", palette: {
      primary:"#EC4899", secondary:"#8B5CF6", bg:"#050208", surface:"#0A050D", card:"#0F0812",
      text2:"#C4A9D9", accent:"#F472B6", grad:"linear-gradient(135deg,#EC4899,#8B5CF6)",
      heroGrad:"linear-gradient(135deg,#050208 0%,#180A28 45%,#050208 100%)" },
      typography: { headingFont:"'Clash Display', 'Sora', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"-0.02em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500&display=swap" } },
    { name: "Editorial Studio", tone: "editorial", palette: {
      primary:"#E8E8E8", secondary:"#8A8A8A", bg:"#0A0A0A", surface:"#121212", card:"#181818",
      text2:"#A8A8A8", accent:"#FF4D00", grad:"linear-gradient(135deg,#E8E8E8,#FF4D00)",
      heroGrad:"linear-gradient(135deg,#0A0A0A 0%,#141414 50%,#0A0A0A 100%)" },
      typography: { headingFont:"'Neue Haas Grotesk', 'Archivo', sans-serif", bodyFont:"'Archivo', sans-serif", headingWeight:"500", headingSpacing:"-0.01em", headingStyle:"editorial",
        googleFonts:"https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&display=swap" } },
    { name: "Playful Portfolio", tone: "playful", palette: {
      primary:"#FBBF24", secondary:"#EC4899", bg:"#0A0705", surface:"#120E09", card:"#18120C",
      text2:"#D9C4A0", accent:"#FDE047", grad:"linear-gradient(135deg,#FBBF24,#EC4899)",
      heroGrad:"linear-gradient(135deg,#0A0705 0%,#1C1005 45%,#0A0705 100%)" },
      typography: { headingFont:"'Fraunces', serif", bodyFont:"'Space Grotesk', sans-serif", headingWeight:"600", headingSpacing:"0", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600&family=Space+Grotesk:wght@400;500&display=swap" } },
  ],
  "Real Estate": [
    { name: "Luxury Estate", tone: "editorial", palette: {
      primary:"#8B7355", secondary:"#1F2937", bg:"#08070A", surface:"#0E0C10", card:"#141116",
      text2:"#B8ADA0", accent:"#C9A876", grad:"linear-gradient(135deg,#8B7355,#1F2937)",
      heroGrad:"linear-gradient(135deg,#08070A 0%,#14100A 45%,#08070A 100%)" },
      typography: { headingFont:"'Fraunces', serif", bodyFont:"'Inter', sans-serif", headingWeight:"450", headingSpacing:"0", headingStyle:"editorial",
        googleFonts:"https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500&family=Inter:wght@300;400;500&display=swap" } },
    { name: "Modern Minimal", tone: "minimal-light", palette: {
      primary:"#0F172A", secondary:"#B8935F", bg:"#FAFAF8", surface:"#F2F1ED", card:"#FFFFFF",
      text2:"#57534E", accent:"#A16207", grad:"linear-gradient(135deg,#0F172A,#B8935F)",
      heroGrad:"linear-gradient(135deg,#FAFAF8 0%,#F0EEE8 100%)" },
      typography: { headingFont:"'Inter', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"-0.01em", headingStyle:"clean",
        googleFonts:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" } },
    { name: "Trust Corporate", tone: "trust", palette: {
      primary:"#1E40AF", secondary:"#0F172A", bg:"#05070C", surface:"#0A0D16", card:"#0F1220",
      text2:"#94A3B8", accent:"#3B82F6", grad:"linear-gradient(135deg,#1E40AF,#0F172A)",
      heroGrad:"linear-gradient(135deg,#05070C 0%,#0A1024 45%,#05070C 100%)" },
      typography: { headingFont:"'IBM Plex Sans', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"0", headingStyle:"clean",
        googleFonts:"https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@500;600&family=Inter:wght@400;500&display=swap" } },
  ],
  "Education & E-Learning": [
    { name: "Friendly Playful", tone: "playful", palette: {
      primary:"#3B82F6", secondary:"#FBBF24", bg:"#06090F", surface:"#0B111C", card:"#101825",
      text2:"#A8B8CC", accent:"#60A5FA", grad:"linear-gradient(135deg,#3B82F6,#FBBF24)",
      heroGrad:"linear-gradient(135deg,#06090F 0%,#0A1428 45%,#06090F 100%)" },
      typography: { headingFont:"'Baloo 2', sans-serif", bodyFont:"'Nunito', sans-serif", headingWeight:"700", headingSpacing:"0", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700&family=Nunito:wght@400;500;600&display=swap" } },
    { name: "Clean Academic", tone: "minimal-light", palette: {
      primary:"#1E3A8A", secondary:"#B45309", bg:"#FAFBFC", surface:"#F0F3F7", card:"#FFFFFF",
      text2:"#475569", accent:"#2563EB", grad:"linear-gradient(135deg,#1E3A8A,#B45309)",
      heroGrad:"linear-gradient(135deg,#FAFBFC 0%,#EEF2F9 100%)" },
      typography: { headingFont:"'Source Serif 4', serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"0", headingStyle:"editorial",
        googleFonts:"https://fonts.googleapis.com/css2?family=Source+Serif+4:wght@500;600&family=Inter:wght@400;500&display=swap" } },
    { name: "Bold Modern Learning", tone: "bold", palette: {
      primary:"#7C3AED", secondary:"#06B6D4", bg:"#07050C", surface:"#0C0912", card:"#110D19",
      text2:"#B8ACD9", accent:"#A78BFA", grad:"linear-gradient(135deg,#7C3AED,#06B6D4)",
      heroGrad:"linear-gradient(135deg,#07050C 0%,#120A24 45%,#07050C 100%)" },
      typography: { headingFont:"'Sora', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"700", headingSpacing:"-0.01em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500&display=swap" } },
  ],
  "Travel & Tourism": [
    { name: "Warm Adventure", tone: "warm", palette: {
      primary:"#F97316", secondary:"#0891B2", bg:"#0A0705", surface:"#150F0A", card:"#1C140E",
      text2:"#D9C4A8", accent:"#FB923C", grad:"linear-gradient(135deg,#F97316,#0891B2)",
      heroGrad:"linear-gradient(135deg,#0A0705 0%,#1E1006 45%,#0A0705 100%)" },
      typography: { headingFont:"'Fraunces', serif", bodyFont:"'DM Sans', sans-serif", headingWeight:"500", headingSpacing:"0", headingStyle:"editorial",
        googleFonts:"https://fonts.googleapis.com/css2?family=Fraunces:wght@450;550&family=DM+Sans:wght@400;500&display=swap" } },
    { name: "Minimal Coastal", tone: "minimal-light", palette: {
      primary:"#0E7490", secondary:"#EA580C", bg:"#FAFDFE", surface:"#EEF6F8", card:"#FFFFFF",
      text2:"#475569", accent:"#06B6D4", grad:"linear-gradient(135deg,#0E7490,#EA580C)",
      heroGrad:"linear-gradient(135deg,#FAFDFE 0%,#EAF6F9 100%)" },
      typography: { headingFont:"'Fraunces', serif", bodyFont:"'Inter', sans-serif", headingWeight:"450", headingSpacing:"0", headingStyle:"editorial-light",
        googleFonts:"https://fonts.googleapis.com/css2?family=Fraunces:wght@400;500&family=Inter:wght@400;500&display=swap" } },
    { name: "Bold Explorer", tone: "energetic", palette: {
      primary:"#DC2626", secondary:"#EAB308", bg:"#0A0503", surface:"#150A06", card:"#1C0F09",
      text2:"#D9B8A0", accent:"#F87171", grad:"linear-gradient(135deg,#DC2626,#EAB308)",
      heroGrad:"linear-gradient(135deg,#0A0503 0%,#1E0A04 45%,#0A0503 100%)" },
      typography: { headingFont:"'Archivo Black', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"900", headingSpacing:"-0.01em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500&display=swap" } },
  ],
  "Content & Affiliate": [
    { name: "Clean Editorial", tone: "clean", palette: {
      primary:"#0A84FF", secondary:"#1F2937", bg:"#050608", surface:"#0A0D11", card:"#0F1318",
      text2:"#A1A1AA", accent:"#38BDF8", grad:"linear-gradient(135deg,#0A84FF,#1F2937)",
      heroGrad:"linear-gradient(135deg,#050608 0%,#0A0F1C 45%,#050608 100%)" },
      typography: { headingFont:"'Inter', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"-0.01em", headingStyle:"clean",
        googleFonts:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" } },
    { name: "Warm Blog", tone: "warm", palette: {
      primary:"#D97706", secondary:"#78350F", bg:"#0A0806", surface:"#14100C", card:"#1B1510",
      text2:"#D9C4A8", accent:"#F59E0B", grad:"linear-gradient(135deg,#D97706,#78350F)",
      heroGrad:"linear-gradient(135deg,#0A0806 0%,#1A0F06 45%,#0A0806 100%)" },
      typography: { headingFont:"'Fraunces', serif", bodyFont:"'DM Sans', sans-serif", headingWeight:"500", headingSpacing:"0", headingStyle:"editorial",
        googleFonts:"https://fonts.googleapis.com/css2?family=Fraunces:wght@450;550&family=DM+Sans:wght@400;500&display=swap" } },
    { name: "Bold Reviews", tone: "bold", palette: {
      primary:"#DC2626", secondary:"#1E293B", bg:"#07050C", surface:"#0C0912", card:"#110D19",
      text2:"#B8A8B8", accent:"#F87171", grad:"linear-gradient(135deg,#DC2626,#1E293B)",
      heroGrad:"linear-gradient(135deg,#07050C 0%,#180A0F 45%,#07050C 100%)" },
      typography: { headingFont:"'Sora', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"700", headingSpacing:"-0.01em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500&display=swap" } },
  ],
  "Business": [
    { name: "Corporate Trust", tone: "trust", palette: {
      primary:"#2563EB", secondary:"#0F172A", bg:"#050810", surface:"#0A0F1C", card:"#0F1524",
      text2:"#94A3B8", accent:"#38BDF8", grad:"linear-gradient(135deg,#2563EB,#0F172A)",
      heroGrad:"linear-gradient(135deg,#050810 0%,#0A1428 45%,#050810 100%)" },
      typography: { headingFont:"'Inter', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"-0.01em", headingStyle:"clean",
        googleFonts:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" } },
    { name: "Minimal Professional", tone: "minimal-light", palette: {
      primary:"#0F172A", secondary:"#475569", bg:"#FAFAFA", surface:"#F1F1F1", card:"#FFFFFF",
      text2:"#525252", accent:"#2563EB", grad:"linear-gradient(135deg,#0F172A,#475569)",
      heroGrad:"linear-gradient(135deg,#FAFAFA 0%,#F0F0F0 100%)" },
      typography: { headingFont:"'Inter', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"600", headingSpacing:"-0.01em", headingStyle:"clean",
        googleFonts:"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" } },
    { name: "Bold Startup", tone: "bold", palette: {
      primary:"#7C3AED", secondary:"#EC4899", bg:"#07050C", surface:"#0C0912", card:"#110D19",
      text2:"#B8ACD9", accent:"#A78BFA", grad:"linear-gradient(135deg,#7C3AED,#EC4899)",
      heroGrad:"linear-gradient(135deg,#07050C 0%,#160A24 45%,#07050C 100%)" },
      typography: { headingFont:"'Sora', sans-serif", bodyFont:"'Inter', sans-serif", headingWeight:"700", headingSpacing:"-0.02em", headingStyle:"display",
        googleFonts:"https://fonts.googleapis.com/css2?family=Sora:wght@600;700&family=Inter:wght@400;500&display=swap" } },
  ],
};

/**
 * Picks one design variant for the given industry using a deterministic
 * seed. Same seed → same variant (reproducible for repair-passes within
 * one generation). Different seed (every new generation) → different
 * variant, so 20 SaaS generations don't all get "Apple Style".
 */
export function pickDesignVariant(industry: string, seed: number): DesignVariant {
  const variants = INDUSTRY_VARIANTS[industry] || INDUSTRY_VARIANTS["Business"];
  const rng = createSeededRandom(seed);
  const index = Math.floor(rng() * variants.length);
  return variants[index];
}

/** Applies a picked variant's palette/typography/tone onto a NicheProfile —
 *  everything else (industry, sectionOrder, imageKeyword, brandVoice, etc,
 *  which are CONTENT decisions, not visual-style decisions) stays exactly
 *  as detectNiche() computed. */
export function applyDesignVariant(niche: NicheProfile, seed: number): NicheProfile {
  const variant = pickDesignVariant(niche.industry, seed);
  return { ...niche, tone: variant.tone, palette: variant.palette, typography: variant.typography };
}

/**
 * Picks a REAL component-library variant (hero/navbar/footer/cta/etc) for
 * this generation — deterministic per seed, so the same generation's
 * repair-pass stays visually consistent, but every NEW generation gets a
 * different structural layout, not just different colors. Uses a small
 * per-category offset so hero/navbar/footer don't all land on the same
 * relative index (e.g. always "variant #2") in lockstep.
 */


/** Shuffles only the MIDDLE sections (keeps index 0 = hero and the last
 *  index exactly where they are — downstream code does sectionOrder.slice(1,-1)
 *  assuming hero-first/cta-last, so only genuinely reorderable content
 *  sections like features/testimonials/pricing get shuffled). */
export function shuffleMiddleSections(sectionOrder: string[], seed: number): string[] {
  if (sectionOrder.length <= 3) return sectionOrder; // nothing meaningful to shuffle
  const rng = createSeededRandom((seed ^ 0x5EC7104) | 0);
  const first = sectionOrder[0];
  const last = sectionOrder[sectionOrder.length - 1];
  const middle = sectionOrder.slice(1, -1);
  for (let i = middle.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [middle[i], middle[j]] = [middle[j], middle[i]];
  }
  return [first, ...middle, last];
}
