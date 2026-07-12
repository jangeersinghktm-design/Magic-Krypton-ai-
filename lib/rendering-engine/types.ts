// lib/rendering-engine/types.ts
// Shared type definitions for the Krypton AI rendering engine — used by
// BOTH app/api/orchestrate/route.ts and app/api/generate/route.ts so
// there is exactly one definition of each type, not two.

export interface NicheProfile {
  industry: string;
  businessType: string;          // product | service | personal | community
  marketLevel: string;           // luxury | premium | mid | budget
  reach: string;                 // local | national | global
  audience: string;              // b2b | b2c | both
  tone: string;                  // editorial | energetic | trust | warm | bold | clean
  imageKeyword: string;          // for unsplash (hero)
  imageKeyword2: string;         // secondary keyword
  sectionImageMap: Record<string,string>; // per-section image keywords
  sectionOrder: string[];        // conversion-optimized order
  conversionGoal: string;        // reservation | lead | trial | enrollment | purchase | inquiry | community
  competitorStyle: string;       // Apple | Stripe | Nike | Airbnb | Linear | Framer | Shopify | HubSpot
  brandPositioning: string;      // luxury | premium | creative | corporate | friendly | innovative | community
  audienceDimensions: AudienceDimensions;
  objectionHandling: string[];   // top 3 objections to address
  trustElements: string[];       // what trust signals matter most
  palette: NichePalette;
  typography: NicheTypography;
  brandVoice: BrandVoice;
}

export interface AudienceDimensions {
  gender: string;                // masculine | feminine | neutral
  age: string;                   // young (18-30) | professional (30-50) | mature (50+) | all
  sophistication: string;        // aspirational | practical | technical | creative
  motivation: string;            // status | results | security | expression | community
}

export interface NichePalette {
  primary: string;
  secondary: string;
  bg: string;
  surface: string;
  card: string;
  text2: string;
  accent: string;
  grad: string;
  heroGrad: string;              // multi-color animated gradient
}

export interface NicheTypography {
  headingFont: string;
  bodyFont: string;
  headingWeight: string;
  headingSpacing: string;
  headingStyle: string;          // editorial | bold | clean | expressive
  googleFonts: string;
}

export interface BrandVoice {
  heroHeadlineStyle: string;     // how to write the H1
  ctaPrimary: string;            // CTA button text style
  ctaSecondary: string;
  emotionalHook: string;         // opening emotional appeal
  socialProofStyle: string;      // what kind of social proof
}

