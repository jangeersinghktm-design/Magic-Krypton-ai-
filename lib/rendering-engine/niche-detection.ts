// lib/rendering-engine/niche-detection.ts
// Shared niche/industry detection — analyzes the user's prompt and
// returns a full NicheProfile (industry, audience, sections, palette,
// typography, brand voice, etc). Imported by BOTH orchestrate and
// generate routes so industry detection never diverges between them.

import type { NicheProfile } from "./types";

export function detectNiche(prompt: string): NicheProfile {
  // Normalize common typos/misspellings before matching (Hinglish users often
  // misspell English niche words — "parfume", "jewellry", "rstaurant" etc.)
  const TYPO_FIXES: [RegExp, string][] = [
    [/\bparfume\b/gi, "perfume"], [/\bperfum\b/gi, "perfume"],
    [/\bjewellry\b/gi, "jewellery"], [/\bjewlery\b/gi, "jewellery"],
    [/\brestrant\b/gi, "restaurant"], [/\brestaurent\b/gi, "restaurant"],
    [/\bfitnes\b/gi, "fitness"], [/\bfitnss\b/gi, "fitness"],
    [/\beducaton\b/gi, "education"], [/\btravell?ing\b/gi, "travel"],
  ];
  let p = prompt.toLowerCase();
  for (const [re, fix] of TYPO_FIXES) p = p.replace(re, fix);

  // ── LUXURY / FASHION / PERFUME / JEWELRY ──────────────────────
  if (/(perfume|fragrance|luxury|jewel|jewellery|jewelry|haute|couture|fashion|designer|bespoke|artisan|premium brand|exclusive)/.test(p)) {
    return {
      industry: "Luxury & Fashion",
      businessType: "product",
      marketLevel: "luxury",
      reach: "global",
      audience: "b2c",
      tone: "editorial",
      imageKeyword: "luxury+perfume+elegant",
      imageKeyword2: "fashion+editorial",
      sectionOrder: ["hero", "product-showcase", "brand-story", "craftsmanship", "collection", "testimonials", "newsletter"],
      conversionGoal: "purchase",
      competitorStyle: "Bottega Veneta Editorial",
      brandPositioning: "luxury",
      audienceDimensions: { gender:"feminine", age:"professional (30-50)", sophistication:"aspirational", motivation:"status" },
      sectionImageMap: { hero:"luxury+perfume+dark+elegant", showcase:"product+luxury+photography", story:"atelier+craftsmanship+artisan", testimonials:"luxury+lifestyle+portrait" },
      objectionHandling: ["Is it worth the price?","What makes it unique?","Will it last?"],
      trustElements: ["As seen in Vogue/Harper's Bazaar","Handcrafted since [year]","Limited edition"],
      palette: {
        primary: "#C9A84C", secondary: "#8B6914",
        bg: "#050400", surface: "#0A0900", card: "#100E00",
        text2: "#C8B98A", accent: "#F0D080",
        grad: "linear-gradient(135deg,#C9A84C,#8B6914)",
        heroGrad: "linear-gradient(135deg,#0A0800 0%,#1A1400 40%,#0F0C00 100%)",
      },
      typography: {
        headingFont: "'Cormorant Garamond', serif",
        bodyFont: "'Jost', sans-serif",
        headingWeight: "300",
        headingSpacing: "0.08em",
        headingStyle: "editorial",
        googleFonts: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600&family=Jost:wght@300;400;500&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Poetic, 3-5 words max, evoke desire — 'The Art of Desire' / 'Born from Silence'",
        ctaPrimary: "Discover the Collection",
        ctaSecondary: "Our Story",
        emotionalHook: "Aspiration and exclusivity — make them feel they deserve this",
        socialProofStyle: "Press mentions: 'As seen in Vogue, Harper's Bazaar, GQ'",
      },
    };
  }

  // ── FITNESS / GYM / WELLNESS ───────────────────────────────────
  if (/(fitness|gym|workout|training|muscle|bodybuilding|crossfit|yoga|pilates|wellness|health club|personal trainer|weight loss|transformation)/.test(p)) {
    return {
      industry: "Fitness & Wellness",
      businessType: "service",
      marketLevel: "mid",
      reach: "local",
      audience: "b2c",
      tone: "energetic",
      imageKeyword: "fitness+workout+gym",
      imageKeyword2: "athlete+training",
      sectionOrder: ["hero", "transformation", "programs", "why-us", "trainers", "testimonials", "pricing", "cta"],
      conversionGoal: "enrollment",
      competitorStyle: "Nike",
      brandPositioning: "results-driven",
      audienceDimensions: { gender:"neutral", age:"young (18-30)", sophistication:"practical", motivation:"results" },
      sectionImageMap: { hero:"athlete+gym+training+dark", transformation:"fitness+transformation+body", programs:"workout+exercise+gym", trainers:"personal+trainer+professional", testimonials:"fitness+success+portrait" },
      objectionHandling: ["I don't have time","I've tried before and failed","Is it too hard for beginners?"],
      trustElements: ["Before/after transformations","Member count","Certified trainers"],
      palette: {
        primary: "#22C55E", secondary: "#16A34A",
        bg: "#020B04", surface: "#041308", card: "#071A0C",
        text2: "#86EFAC", accent: "#4ADE80",
        grad: "linear-gradient(135deg,#22C55E,#0EA5E9)",
        heroGrad: "linear-gradient(135deg,#020B04 0%,#041A0A 50%,#020B04 100%)",
      },
      typography: {
        headingFont: "'Barlow Condensed', sans-serif",
        bodyFont: "'Barlow', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.02em",
        headingStyle: "bold",
        googleFonts: "https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800;900&family=Barlow:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Powerful, all-caps energy — 'TRANSFORM YOUR BODY. TRANSFORM YOUR LIFE.'",
        ctaPrimary: "Start Your Transformation",
        ctaSecondary: "View Programs",
        emotionalHook: "Pain point first — 'Tired of feeling weak? Tired of failing?'",
        socialProofStyle: "Before/after results, member count: '2,847 transformations and counting'",
      },
    };
  }

  // ── RESTAURANT / FOOD / CAFE ───────────────────────────────────
  if (/(restaurant|cafe|bistro|food|dining|cuisine|chef|menu|pizza|sushi|bakery|coffee|bar|grill|eatery|breakfast|brunch|dinner|catering)/.test(p)) {
    return {
      industry: "Food & Dining",
      businessType: "service",
      marketLevel: "mid",
      reach: "local",
      audience: "b2c",
      tone: "warm",
      imageKeyword: "restaurant+food+gourmet",
      imageKeyword2: "chef+cooking+cuisine",
      sectionOrder: ["hero", "about", "menu-highlight", "gallery", "experience", "reviews", "reservation", "footer"],
      conversionGoal: "reservation",
      competitorStyle: "Airbnb",
      brandPositioning: "friendly",
      audienceDimensions: { gender:"neutral", age:"all ages", sophistication:"practical", motivation:"expression" },
      sectionImageMap: { hero:"restaurant+interior+atmospheric+dark", menu:"food+gourmet+photography+closeup", gallery:"chef+cooking+kitchen+professional", reviews:"happy+dining+restaurant+customers" },
      objectionHandling: ["Is it worth the price?","How hard is it to get a reservation?","Is the ambiance good?"],
      trustElements: ["TripAdvisor rating","Food critic reviews","Years in business"],
      palette: {
        primary: "#F97316", secondary: "#DC2626",
        bg: "#0A0400", surface: "#140800", card: "#1E0C00",
        text2: "#FED7AA", accent: "#FCD34D",
        grad: "linear-gradient(135deg,#F97316,#DC2626)",
        heroGrad: "linear-gradient(135deg,#0A0400 0%,#1A0800 50%,#0A0400 100%)",
      },
      typography: {
        headingFont: "'Playfair Display', serif",
        bodyFont: "'Lato', sans-serif",
        headingWeight: "700",
        headingSpacing: "-0.01em",
        headingStyle: "elegant",
        googleFonts: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lato:wght@300;400;700&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Sensory and inviting — 'Where Every Bite Tells a Story'",
        ctaPrimary: "Reserve a Table",
        ctaSecondary: "View Our Menu",
        emotionalHook: "Invoke the senses — smell, taste, warmth, togetherness",
        socialProofStyle: "Awards + reviews: 'Rated #1 on TripAdvisor · Featured in Food & Wine'",
      },
    };
  }

  // ── CRYPTO / WEB3 / BLOCKCHAIN / DeFi ─────────────────────────
  if (/(crypto|blockchain|web3|defi|nft|token|dao|ethereum|bitcoin|solana|wallet|dex|yield|staking)/.test(p)) {
    return {
      industry: "Crypto & Web3",
      businessType: "product",
      marketLevel: "premium",
      reach: "global",
      audience: "both",
      tone: "trust",
      imageKeyword: "blockchain+technology+crypto",
      imageKeyword2: "digital+finance+network",
      sectionOrder: ["hero", "stats", "how-it-works", "features", "security", "tokenomics", "roadmap", "community", "faq"],
      conversionGoal: "community",
      competitorStyle: "Stripe",
      brandPositioning: "innovative",
      audienceDimensions: { gender:"masculine", age:"young (18-30)", sophistication:"technical", motivation:"results" },
      sectionImageMap: { hero:"blockchain+network+dark+neon", stats:"crypto+chart+data+dashboard", security:"cybersecurity+shield+technology", community:"crypto+community+discord+web3" },
      objectionHandling: ["Is it safe?","Is it too late to invest?","How does it actually work?"],
      trustElements: ["Total Value Locked","Audit reports","Team credentials","Partnerships"],
      palette: {
        primary: "#3B82F6", secondary: "#8B5CF6",
        bg: "#020409", surface: "#04070F", card: "#070D1A",
        text2: "#93C5FD", accent: "#60A5FA",
        grad: "linear-gradient(135deg,#3B82F6,#8B5CF6)",
        heroGrad: "linear-gradient(135deg,#020409 0%,#060C1A 50%,#020409 100%)",
      },
      typography: {
        headingFont: "'Space Grotesk', sans-serif",
        bodyFont: "'Inter', sans-serif",
        headingWeight: "700",
        headingSpacing: "-0.03em",
        headingStyle: "clean",
        googleFonts: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Bold claim + metric — 'The Future of Finance. $2.4B in Transactions.'",
        ctaPrimary: "Launch App",
        ctaSecondary: "Read Whitepaper",
        emotionalHook: "Financial freedom, decentralization, early mover advantage",
        socialProofStyle: "TVL, users, transactions — hard numbers front and center",
      },
    };
  }

  // ── SAAS / SOFTWARE / TECH STARTUP ────────────────────────────
  if (/(saas|software|platform|tool|app|startup|productivity|automation|workflow|integration|api|dashboard|analytics|crm|erp|no.code|low.code)/.test(p)) {
    return {
      industry: "SaaS & Technology",
      businessType: "product",
      marketLevel: "premium",
      reach: "global",
      audience: "b2b",
      tone: "clean",
      imageKeyword: "saas+dashboard+software",
      imageKeyword2: "technology+workspace",
      sectionOrder: ["hero", "social-proof-logos", "features", "product-demo", "how-it-works", "testimonials", "pricing", "faq", "cta"],
      conversionGoal: "trial",
      competitorStyle: "Apple",
      brandPositioning: "innovative",
      audienceDimensions: { gender:"neutral", age:"professional (30-50)", sophistication:"technical", motivation:"results" },
      sectionImageMap: { hero:"saas+dashboard+interface+dark", demo:"software+ui+screenshot+laptop", features:"productivity+workflow+team+office", testimonials:"business+professional+office+portrait" },
      objectionHandling: ["Is it easy to use?","Will my team actually adopt it?","What does it integrate with?"],
      trustElements: ["G2/Capterra rating","Case studies with ROI","SOC2/security certifications","Free trial, no credit card"],
      palette: {
        primary: "#6366F1", secondary: "#8B5CF6",
        bg: "#030308", surface: "#07070F", card: "#0D0D1A",
        text2: "#94A3B8", accent: "#818CF8",
        grad: "linear-gradient(135deg,#6366F1,#8B5CF6)",
        heroGrad: "linear-gradient(135deg,#030308 0%,#080815 50%,#030308 100%)",
      },
      typography: {
        headingFont: "'Plus Jakarta Sans', sans-serif",
        bodyFont: "'Inter', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.04em",
        headingStyle: "clean",
        googleFonts: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;800&family=Inter:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Outcome-first — 'Ship 10x Faster. Build Without Limits.' (max 8 words)",
        ctaPrimary: "Start Free Trial",
        ctaSecondary: "See Demo",
        emotionalHook: "Pain: wasted time, broken tools. Relief: finally, a better way",
        socialProofStyle: "Logo bar: 'Trusted by 50,000+ teams at [logos]'",
      },
    };
  }

  // ── FINANCE / FINTECH / INVESTMENT ────────────────────────────
  if (/(finance|fintech|invest|wealth|fund|trading|bank|insurance|mortgage|accounting|tax|financial|advisor|portfolio|retire)/.test(p)) {
    return {
      industry: "Finance & Fintech",
      businessType: "service",
      marketLevel: "premium",
      reach: "national",
      audience: "both",
      tone: "trust",
      imageKeyword: "finance+investment+wealth",
      imageKeyword2: "business+professional",
      sectionOrder: ["hero", "stats", "services", "why-us", "how-it-works", "testimonials", "security", "cta"],
      conversionGoal: "lead",
      competitorStyle: "Stripe",
      brandPositioning: "professional",
      audienceDimensions: { gender:"neutral", age:"professional (30-50)", sophistication:"aspirational", motivation:"security" },
      sectionImageMap: { hero:"finance+wealth+investment+premium", stats:"financial+data+chart+growth", services:"business+meeting+professional", security:"bank+security+vault+trust" },
      objectionHandling: ["Can I trust them with my money?","What are the fees?","How experienced are they?"],
      trustElements: ["Regulatory certifications","Years in business","AUM numbers","Client retention rate"],
      palette: {
        primary: "#0EA5E9", secondary: "#0284C7",
        bg: "#020508", surface: "#040A10", card: "#070F18",
        text2: "#7DD3FC", accent: "#38BDF8",
        grad: "linear-gradient(135deg,#0EA5E9,#6366F1)",
        heroGrad: "linear-gradient(135deg,#020508 0%,#050D18 50%,#020508 100%)",
      },
      typography: {
        headingFont: "'Syne', sans-serif",
        bodyFont: "'DM Sans', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.03em",
        headingStyle: "bold",
        googleFonts: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Authority + promise — 'Your Wealth, Secured. Your Future, Clear.'",
        ctaPrimary: "Get Started Today",
        ctaSecondary: "Schedule a Call",
        emotionalHook: "Security, trust, expertise — reduce anxiety about money",
        socialProofStyle: "AUM, years experience, certifications: '$2.1B managed · 15 years · SEC registered'",
      },
    };
  }

  // ── MARKETING / AGENCY / CREATIVE ─────────────────────────────
  if (/(agency|marketing|brand|creative|design|seo|social media|advertising|content|growth|lead|campaign|pr|media|video|production)/.test(p)) {
    return {
      industry: "Creative Agency",
      businessType: "service",
      marketLevel: "premium",
      reach: "global",
      audience: "b2b",
      tone: "bold",
      imageKeyword: "creative+agency+design",
      imageKeyword2: "team+office+creative",
      sectionOrder: ["hero", "work-showcase", "services", "process", "results-stats", "team", "client-logos", "testimonials", "contact"],
      conversionGoal: "lead",
      competitorStyle: "Linear",
      brandPositioning: "creative",
      audienceDimensions: { gender:"neutral", age:"professional (30-50)", sophistication:"creative", motivation:"results" },
      sectionImageMap: { hero:"creative+agency+dark+bold", work:"portfolio+design+web+creative", team:"creative+team+office+diverse", results:"business+growth+chart+results" },
      objectionHandling: ["Will they understand our brand?","What ROI can we expect?","Are they too expensive?"],
      trustElements: ["Case study results with numbers","Client logos","Awards","Response time guarantee"],
      palette: {
        primary: "#EC4899", secondary: "#8B5CF6",
        bg: "#050208", surface: "#0A0410", card: "#100818",
        text2: "#F9A8D4", accent: "#F472B6",
        grad: "linear-gradient(135deg,#EC4899,#8B5CF6)",
        heroGrad: "linear-gradient(135deg,#050208 0%,#0C0520 50%,#050208 100%)",
      },
      typography: {
        headingFont: "'Syne', sans-serif",
        bodyFont: "'DM Sans', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.04em",
        headingStyle: "expressive",
        googleFonts: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Bold & provocative — 'We Don't Do Average.' or 'Results. Not Excuses.'",
        ctaPrimary: "Start a Project",
        ctaSecondary: "View Our Work",
        emotionalHook: "Challenge the status quo — boring agencies vs us",
        socialProofStyle: "Case study results: '+342% ROI for Client X in 90 days'",
      },
    };
  }

  // ── REAL ESTATE / PROPERTY ────────────────────────────────────
  if (/(real estate|property|house|home|apartment|villa|rent|buy|mortgage|realtor|housing|condo|listing|land)/.test(p)) {
    return {
      industry: "Real Estate",
      businessType: "service",
      marketLevel: "premium",
      reach: "local",
      audience: "b2c",
      tone: "trust",
      imageKeyword: "real+estate+luxury+home",
      imageKeyword2: "architecture+interior+design",
      sectionOrder: ["hero", "featured-listings", "search", "services", "stats", "about", "testimonials", "contact"],
      conversionGoal: "inquiry",
      competitorStyle: "Airbnb",
      brandPositioning: "professional",
      audienceDimensions: { gender:"neutral", age:"professional (30-50)", sophistication:"aspirational", motivation:"security" },
      sectionImageMap: { hero:"luxury+home+interior+architecture", listings:"real+estate+property+house", about:"realtor+professional+portrait", testimonials:"happy+homeowner+family+house" },
      objectionHandling: ["Can I trust this agent?","Is it the right time to buy?","What about the neighborhood?"],
      trustElements: ["Properties sold count","Years experience","Client testimonials with photos","Local market expertise"],
      palette: {
        primary: "#10B981", secondary: "#059669",
        bg: "#020A06", surface: "#041208", card: "#071A0D",
        text2: "#6EE7B7", accent: "#34D399",
        grad: "linear-gradient(135deg,#10B981,#0EA5E9)",
        heroGrad: "linear-gradient(135deg,#020A06 0%,#041810 50%,#020A06 100%)",
      },
      typography: {
        headingFont: "'Cormorant Garamond', serif",
        bodyFont: "'DM Sans', sans-serif",
        headingWeight: "600",
        headingSpacing: "0",
        headingStyle: "elegant",
        googleFonts: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;600;700&family=DM+Sans:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Aspirational home — 'Find Your Perfect Home. Live Your Dream Life.'",
        ctaPrimary: "Browse Properties",
        ctaSecondary: "Book a Viewing",
        emotionalHook: "The emotional journey of finding a home — belonging, safety, dreams",
        socialProofStyle: "Properties sold, years active, client satisfaction: '500+ homes sold · 98% client satisfaction'",
      },
    };
  }

  // ── EDUCATION / COURSE / E-LEARNING ───────────────────────────
  if (/(course|education|learn|teach|school|academy|university|training|bootcamp|certification|skill|study|tutor|class|lecture|e.learning|online course)/.test(p)) {
    return {
      industry: "Education & E-Learning",
      businessType: "product",
      marketLevel: "mid",
      reach: "global",
      audience: "b2c",
      tone: "energetic",
      imageKeyword: "education+learning+student",
      imageKeyword2: "online+course+laptop",
      sectionOrder: ["hero", "outcome-proof", "curriculum", "instructor", "what-youll-learn", "testimonials", "pricing", "faq", "enroll-cta"],
      conversionGoal: "enrollment",
      competitorStyle: "HubSpot",
      brandPositioning: "friendly",
      audienceDimensions: { gender:"neutral", age:"young (18-30)", sophistication:"practical", motivation:"results" },
      sectionImageMap: { hero:"online+learning+laptop+student", curriculum:"course+lessons+curriculum+learning", instructor:"teacher+educator+professional+portrait", testimonials:"student+success+graduation+career" },
      objectionHandling: ["Is this course worth it?","Will I actually complete it?","What if I already know some of this?"],
      trustElements: ["Student count","Completion rate","Career outcome stats","Money-back guarantee"],
      palette: {
        primary: "#F59E0B", secondary: "#EF4444",
        bg: "#080500", surface: "#120900", card: "#1C0E00",
        text2: "#FCD34D", accent: "#FDE68A",
        grad: "linear-gradient(135deg,#F59E0B,#EF4444)",
        heroGrad: "linear-gradient(135deg,#080500 0%,#180B00 50%,#080500 100%)",
      },
      typography: {
        headingFont: "'Nunito', sans-serif",
        bodyFont: "'Nunito Sans', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.02em",
        headingStyle: "bold",
        googleFonts: "https://fonts.googleapis.com/css2?family=Nunito:wght@700;800;900&family=Nunito+Sans:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Transformation promise — 'From Zero to [Skill] in 30 Days. Guaranteed.'",
        ctaPrimary: "Enroll Now — Limited Spots",
        ctaSecondary: "Preview the Course",
        emotionalHook: "Fear of missing out, career change, income improvement",
        socialProofStyle: "Student count + outcomes: '12,847 students enrolled · 94% completion rate'",
      },
    };
  }

  // ── TRAVEL / TOURISM ──────────────────────────────────────────
  if (/(travel|tour|vacation|holiday|trip|adventure|hotel|resort|destination|explore|trek|safari|cruise|booking|fly|airline)/.test(p)) {
    return {
      industry: "Travel & Tourism",
      businessType: "service",
      marketLevel: "mid",
      reach: "global",
      audience: "b2c",
      tone: "adventurous",
      imageKeyword: "travel+landscape+adventure",
      imageKeyword2: "destination+ocean+mountain",
      sectionOrder: ["hero", "featured-destinations", "why-choose-us", "experiences", "testimonials", "gallery", "booking-cta"],
      conversionGoal: "booking",
      competitorStyle: "Airbnb",
      brandPositioning: "friendly",
      audienceDimensions: { gender:"neutral", age:"young (18-30)", sophistication:"aspirational", motivation:"expression" },
      sectionImageMap: { hero:"travel+adventure+landscape+scenic", destinations:"travel+destination+city+landmark", experiences:"adventure+outdoor+travel+activity", gallery:"travel+photography+beautiful+places" },
      objectionHandling: ["Is it safe?","Is it within budget?","Will I feel out of place?"],
      trustElements: ["Trips completed","Countries covered","Safety rating","Traveler reviews"],
      palette: {
        primary: "#06B6D4", secondary: "#0891B2",
        bg: "#020709", surface: "#030D12", card: "#05131A",
        text2: "#67E8F9", accent: "#22D3EE",
        grad: "linear-gradient(135deg,#06B6D4,#7C3AED)",
        heroGrad: "linear-gradient(135deg,#020709 0%,#041018 50%,#020709 100%)",
      },
      typography: {
        headingFont: "'Poppins', sans-serif",
        bodyFont: "'Poppins', sans-serif",
        headingWeight: "700",
        headingSpacing: "-0.02em",
        headingStyle: "bold",
        googleFonts: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Wanderlust — 'The World is Calling. Are You Ready?' or 'Every Journey Starts Here'",
        ctaPrimary: "Explore Destinations",
        ctaSecondary: "Plan My Trip",
        emotionalHook: "Freedom, escape from routine, bucket list experiences",
        socialProofStyle: "Travelers served: '50,000+ adventures booked · 4.9★ average rating'",
      },
    };
  }

  // ── AFFILIATE / BLOGGING / CONTENT ────────────────────────────
  if (/(affiliate|blog|content|tips|guide|review|compare|best|top|rank|seo|article|newsletter|podcast|youtube|influencer)/.test(p)) {
    return {
      industry: "Content & Affiliate",
      businessType: "personal",
      marketLevel: "mid",
      reach: "global",
      audience: "b2c",
      tone: "helpful",
      imageKeyword: "content+creator+blog",
      imageKeyword2: "marketing+digital+laptop",
      sectionOrder: ["hero", "what-youll-get", "featured-posts", "about", "newsletter", "testimonials", "cta"],
      conversionGoal: "email-capture",
      competitorStyle: "HubSpot",
      brandPositioning: "community",
      audienceDimensions: { gender:"neutral", age:"young (18-30)", sophistication:"practical", motivation:"results" },
      sectionImageMap: { hero:"content+creator+laptop+workspace", posts:"blog+marketing+digital+success", about:"personal+brand+professional+portrait", newsletter:"email+marketing+newsletter+success" },
      objectionHandling: ["Is this free?","Will this actually work for me?","How long before I see results?"],
      trustElements: ["Monthly reader count","Email subscriber count","Income proof/screenshots","Press mentions"],
      palette: {
        primary: "#A855F7", secondary: "#7C3AED",
        bg: "#04020A", surface: "#080414", card: "#0C071E",
        text2: "#C4B5FD", accent: "#DDD6FE",
        grad: "linear-gradient(135deg,#A855F7,#EC4899)",
        heroGrad: "linear-gradient(135deg,#04020A 0%,#0A0520 50%,#04020A 100%)",
      },
      typography: {
        headingFont: "'Syne', sans-serif",
        bodyFont: "'DM Sans', sans-serif",
        headingWeight: "800",
        headingSpacing: "-0.03em",
        headingStyle: "bold",
        googleFonts: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap",
      },
      brandVoice: {
        heroHeadlineStyle: "Value-first — 'I Made $12,000 Last Month. Here's Exactly How.' (specific numbers)",
        ctaPrimary: "Get the Free Guide",
        ctaSecondary: "Read the Blog",
        emotionalHook: "Income potential, passive money, freedom from 9-5",
        socialProofStyle: "Earnings proof, audience size: '47,000 monthly readers · Featured in Forbes'",
      },
    };
  }

  // ── DEFAULT: Premium Business ──────────────────────────────────
  return {
    industry: "Business",
    businessType: "service",
    marketLevel: "premium",
    reach: "global",
    audience: "both",
    tone: "clean",
    imageKeyword: "business+professional+modern",
    imageKeyword2: "office+team+success",
    sectionOrder: ["hero", "features", "how-it-works", "testimonials", "pricing", "faq", "cta"],
    conversionGoal: "lead",
    competitorStyle: "Apple",
    brandPositioning: "professional",
    audienceDimensions: { gender:"neutral", age:"all ages", sophistication:"practical", motivation:"results" },
    sectionImageMap: { hero:"business+professional+modern", features:"team+office+work", testimonials:"professional+portrait+business" },
    objectionHandling: ["Is it right for our needs?","What is the ROI?","How long to implement?"],
    trustElements: ["Client count","Years in business","Case studies","Certifications"],
    palette: {
      primary: "#6366F1", secondary: "#8B5CF6",
      bg: "#030308", surface: "#07070F", card: "#0D0D1A",
      text2: "#94A3B8", accent: "#818CF8",
      grad: "linear-gradient(135deg,#6366F1,#8B5CF6)",
      heroGrad: "linear-gradient(135deg,#030308 0%,#080815 50%,#030308 100%)",
    },
    typography: {
      headingFont: "'Syne', sans-serif",
      bodyFont: "'DM Sans', sans-serif",
      headingWeight: "800",
      headingSpacing: "-0.03em",
      headingStyle: "bold",
      googleFonts: "https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap",
    },
    brandVoice: {
      heroHeadlineStyle: "Clear value proposition in 6-8 words with strong emotional pull",
      ctaPrimary: "Get Started Today",
      ctaSecondary: "Learn More",
      emotionalHook: "Problem → Solution → Transformation arc",
      socialProofStyle: "Numbers that matter: users, revenue, years, ratings",
    },
  };
}
