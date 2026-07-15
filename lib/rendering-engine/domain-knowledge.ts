// lib/rendering-engine/domain-knowledge.ts
// Shared Domain Knowledge Engine — 100+ pre-built industry blueprints
// (COMPACT_DOMAINS/DOMAIN_BLUEPRINTS) plus the AI Architect fallback for
// unknown domains. Imported by BOTH orchestrate and generate routes so
// "luxury car club" always gets fleet imagery (never perfume), etc,
// consistently across every generation path.

import type { NicheProfile } from "./types";

export interface SectionBlueprint {
  id:       string;
  category: string;
  variant:  string;
  headline: string;
  purpose:  string;
}


export interface DomainKnowledge {
  domain:         string;
  labels:         string[];
  projectType:    string;
  projectName:    string;
  tagline:        string;
  businessGoal:   string;
  targetAudience: string;
  pricingModel:   string;
  sections:       SectionBlueprint[];
  primaryCTA:     string;
  secondaryCTA:   string;
  copyTone:       string;
  keyBenefits:    string[];
  designMood:     string;
  colorHint:      string;
  typography:     string;
  spacing:        string;
  assetTheme:     string;
  avoid:          string[];
}


export type BasePattern = Omit<DomainKnowledge, 'domain'|'labels'|'projectName'|'targetAudience'|'assetTheme'|'avoid'>;


export const B: Record<string, BasePattern> = {

  // ── 1. HOSPITALITY — booking-driven service businesses ───────────────
  HOSPITALITY: {
    projectType:"website", tagline:"An Experience Worth Returning To",
    businessGoal:"booking", pricingModel:"none",
    sections:[
      {id:"hero",         category:"hero",         variant:"centered",          headline:"Welcome",          purpose:"Atmospheric hero with booking CTA"},
      {id:"about",        category:"features",     variant:"alternating",       headline:"Our Story",        purpose:"Authentic brand story builds trust"},
      {id:"services",     category:"features",     variant:"bento-grid",        headline:"What We Offer",    purpose:"Core service/product showcase"},
      {id:"gallery",      category:"features",     variant:"bento-grid",        headline:"Gallery",          purpose:"Visual proof — photography drives bookings"},
      {id:"testimonials", category:"testimonials", variant:"masonry",           headline:"What Guests Say",  purpose:"Social proof with real names"},
      {id:"booking",      category:"cta",          variant:"split-form",        headline:"Make a Reservation",purpose:"Date, party size, special requests"},
      {id:"footer",       category:"footer",       variant:"minimal-centered",  headline:"",                  purpose:"Address, hours, social, phone"},
    ],
    primaryCTA:"Book Now", secondaryCTA:"Learn More",
    copyTone:"Warm, sensory, and inviting. Make them feel the atmosphere before they arrive.",
    keyBenefits:["Exceptional quality","Memorable experiences","Dedicated service","Prime location","Outstanding reviews"],
    designMood:"warm elegant", colorHint:"", typography:"serif", spacing:"balanced",
  },

  // ── 2. PROFESSIONAL — trust-based service providers ──────────────────
  PROFESSIONAL: {
    projectType:"website", tagline:"Expert Guidance. Trusted Results.",
    businessGoal:"lead", pricingModel:"none",
    sections:[
      {id:"hero",         category:"hero",         variant:"split-image",       headline:"Expert Care",      purpose:"Professional credibility first impression"},
      {id:"services",     category:"features",     variant:"icon-grid",         headline:"Our Services",     purpose:"Clear service breakdown"},
      {id:"about",        category:"features",     variant:"alternating",       headline:"About Us",         purpose:"Credentials, experience, philosophy"},
      {id:"stats",        category:"features",     variant:"stat-highlight",    headline:"Track Record",     purpose:"Numbers: years, clients, certifications"},
      {id:"testimonials", category:"testimonials", variant:"featured",          headline:"Client Stories",   purpose:"Success stories with outcomes"},
      {id:"contact",      category:"cta",          variant:"split-form",        headline:"Get in Touch",     purpose:"Appointment or enquiry form"},
      {id:"footer",       category:"footer",       variant:"four-column",       headline:"",                  purpose:"Services, team, contact, location"},
    ],
    primaryCTA:"Book Consultation", secondaryCTA:"View Services",
    copyTone:"Authoritative yet approachable. Lead with outcomes, not process.",
    keyBenefits:["Qualified experts","Proven track record","Personalised service","Clear communication","Fast turnaround"],
    designMood:"clean professional", colorHint:"", typography:"sans", spacing:"balanced",
  },

  // ── 3. ECOMMERCE — product-selling experiences ───────────────────────
  ECOMMERCE: {
    projectType:"ecommerce", tagline:"Premium Products. Delivered Fast.",
    businessGoal:"ecommerce", pricingModel:"product-price",
    sections:[
      {id:"hero",         category:"hero",         variant:"product-showcase",  headline:"The Collection",   purpose:"Lifestyle hero with offer"},
      {id:"featured",     category:"ecommerce",    variant:"featured-product",  headline:"Featured",         purpose:"Hero product — full details + CTA"},
      {id:"categories",   category:"ecommerce",    variant:"category-showcase", headline:"Shop by Category", purpose:"Category grid with lifestyle imagery"},
      {id:"products",     category:"ecommerce",    variant:"product-grid",      headline:"New Arrivals",     purpose:"Product cards with add-to-cart"},
      {id:"benefits",     category:"features",     variant:"icon-grid",         headline:"Why Shop With Us", purpose:"Shipping, returns, warranty, security"},
      {id:"reviews",      category:"testimonials", variant:"masonry",           headline:"Customer Reviews",  purpose:"Star ratings + verified buyer badges"},
      {id:"cta",          category:"cta",          variant:"banner-strip",      headline:"Free Shipping Over $50", purpose:"Incentive banner"},
      {id:"footer",       category:"footer",       variant:"mega-social",       headline:"",                  purpose:"Policy, returns, track order, support"},
    ],
    primaryCTA:"Shop Now", secondaryCTA:"View Collection",
    copyTone:"Benefit-driven with urgency. Quality and value above all.",
    keyBenefits:["Free shipping over $50","30-day returns","Secure checkout","Same-day dispatch","Quality guarantee"],
    designMood:"clean minimal", colorHint:"", typography:"sans", spacing:"balanced",
  },

  // ── 4. SAAS — software / platform businesses ─────────────────────────
  SAAS: {
    projectType:"saas", tagline:"The Smarter Way to {action}",
    businessGoal:"lead", pricingModel:"saas-subscription",
    sections:[
      {id:"hero",         category:"hero",         variant:"product-showcase",  headline:"Ship Faster. Scale Smarter.", purpose:"Product screenshot + social proof"},
      {id:"logos",        category:"features",     variant:"stat-highlight",    headline:"Trusted by 10,000+ Teams",  purpose:"Company logos + user count"},
      {id:"features",     category:"features",     variant:"bento-grid",        headline:"Everything You Need",       purpose:"Core features in bento grid"},
      {id:"workflow",     category:"features",     variant:"alternating",       headline:"How It Works",              purpose:"3-step workflow section"},
      {id:"integrations", category:"features",     variant:"icon-grid",         headline:"Integrations",              purpose:"Slack, GitHub, Notion, etc."},
      {id:"pricing",      category:"pricing",      variant:"toggle",            headline:"Simple Pricing",            purpose:"Monthly/annual toggle tiers"},
      {id:"testimonials", category:"testimonials", variant:"logo-wall",         headline:"Loved by Top Teams",        purpose:"Logo wall + featured quotes"},
      {id:"faq",          category:"faq",          variant:"simple-list",       headline:"FAQ",                       purpose:"Billing, security, integrations"},
      {id:"cta",          category:"cta",          variant:"centered-gradient", headline:"Start Free. Scale as You Grow.", purpose:"Free trial — no credit card"},
      {id:"footer",       category:"footer",       variant:"newsletter-rich",   headline:"",                           purpose:"Product, company, docs, status"},
    ],
    primaryCTA:"Start Free Trial", secondaryCTA:"View Demo",
    copyTone:"Clear, confident, outcome-focused. ROI language. Show don't tell.",
    keyBenefits:["No credit card required","SOC 2 compliant","24/7 support","Scales to enterprise","Cancel anytime"],
    designMood:"clean modern", colorHint:"", typography:"sans", spacing:"balanced",
  },

  // ── 5. PORTFOLIO — creator / agency showcase ─────────────────────────
  PORTFOLIO: {
    projectType:"portfolio", tagline:"Work that speaks for itself.",
    businessGoal:"lead", pricingModel:"none",
    sections:[
      {id:"hero",         category:"hero",         variant:"minimal-statement", headline:"Hi, I'm {Name}",   purpose:"Bold personal intro"},
      {id:"work",         category:"portfolio",    variant:"featured-grid",     headline:"Selected Work",    purpose:"Best projects with outcomes"},
      {id:"about",        category:"features",     variant:"alternating",       headline:"About",            purpose:"Story, skills, process"},
      {id:"testimonials", category:"testimonials", variant:"grid",              headline:"What Clients Say", purpose:"Client recommendations"},
      {id:"contact",      category:"cta",          variant:"split-form",        headline:"Work Together",    purpose:"Project inquiry form"},
      {id:"footer",       category:"footer",       variant:"minimal-centered",  headline:"",                  purpose:"Social links, email, resume"},
    ],
    primaryCTA:"Start a Project", secondaryCTA:"View Work",
    copyTone:"Confident. Let the work lead. Personality in copy.",
    keyBenefits:["Expert in field","Available for projects","Fast delivery","Collaborative process","Proven results"],
    designMood:"clean minimal", colorHint:"", typography:"sans", spacing:"balanced",
  },

  // ── 6. LANDING — single conversion pages ─────────────────────────────
  LANDING: {
    projectType:"landing", tagline:"Be First. Get Access.",
    businessGoal:"lead", pricingModel:"none",
    sections:[
      {id:"hero",         category:"hero",         variant:"centered",          headline:"Your Promise Here", purpose:"Single headline + email capture"},
      {id:"benefits",     category:"features",     variant:"icon-grid",         headline:"Why You'll Love It", purpose:"3 core benefits — scannable"},
      {id:"features",     category:"features",     variant:"alternating",       headline:"Here's What You Get", purpose:"Feature walkthrough"},
      {id:"social-proof", category:"testimonials", variant:"grid",              headline:"Join 10,000+ Early Adopters", purpose:"Waitlist count + early testimonials"},
      {id:"cta",          category:"cta",          variant:"centered-gradient", headline:"Get Early Access",  purpose:"Final email capture with urgency"},
      {id:"footer",       category:"footer",       variant:"minimal-centered",  headline:"",                   purpose:"Privacy, terms, social"},
    ],
    primaryCTA:"Get Early Access", secondaryCTA:"Learn More",
    copyTone:"Exciting. Benefit-first. Urgency without pressure. Clear in 5 seconds.",
    keyBenefits:["Early access pricing","Founding member status","Shape the product","Exclusive community","Launch notification"],
    designMood:"bold modern", colorHint:"", typography:"sans", spacing:"balanced",
  },
};


export function patchSection(
  sections: SectionBlueprint[],
  id:       string,
  patch:    Partial<SectionBlueprint>
): SectionBlueprint[] {
  return sections.map(s => s.id === id ? { ...s, ...patch } : s);
}


export function addSectionAfter(
  sections:  SectionBlueprint[],
  afterId:   string,
  newSection: SectionBlueprint
): SectionBlueprint[] {
  const idx = sections.findIndex(s => s.id === afterId);
  if (idx < 0) return [...sections, newSection];
  return [...sections.slice(0, idx+1), newSection, ...sections.slice(idx+1)];
}


export interface CompactDomain {
  domain:       string;
  labels:       string[];
  base:         keyof typeof B;
  projectType?: string;
  projectName:  string;
  tagline?:     string;
  targetAudience: string;
  primaryCTA:   string;
  secondaryCTA?: string;
  assetTheme:   string;
  avoid:        string[];
  colorHint?:   string;
  typography?:  string;
  designMood?:  string;
  spacing?:     string;
  pricingModel?: string;
  businessGoal?: string;
  copyTone?:    string;
  keyBenefits?: string[];
  sectionPatch?:(sections: SectionBlueprint[]) => SectionBlueprint[];
}


export function resolveDomain(d: CompactDomain): DomainKnowledge {
  const base    = B[d.base];
  const sections = d.sectionPatch ? d.sectionPatch([...base.sections]) : [...base.sections];
  return {
    domain:         d.domain,
    labels:         d.labels,
    projectType:    d.projectType || base.projectType,
    projectName:    d.projectName,
    tagline:        d.tagline || base.tagline,
    businessGoal:   d.businessGoal || base.businessGoal,
    targetAudience: d.targetAudience,
    pricingModel:   d.pricingModel || base.pricingModel,
    sections,
    primaryCTA:     d.primaryCTA,
    secondaryCTA:   d.secondaryCTA || base.secondaryCTA,
    copyTone:       d.copyTone || base.copyTone,
    keyBenefits:    d.keyBenefits || base.keyBenefits,
    designMood:     d.designMood || base.designMood,
    colorHint:      d.colorHint || base.colorHint,
    typography:     d.typography || base.typography,
    spacing:        d.spacing || base.spacing,
    assetTheme:     d.assetTheme,
    avoid:          d.avoid,
  };
}


export const COMPACT_DOMAINS: CompactDomain[] = [

  // ── AUTOMOTIVE ───────────────────────────────────────────────────────
  {
    domain:"luxury-car-club", base:"HOSPITALITY",
    labels:["car club","supercar club","hypercar","exotic car","ferrari club","lamborghini club","automobile club","sports car membership","luxury car membership"],
    projectName:"{Brand} Car Club", tagline:"Drive the Extraordinary",
    businessGoal:"membership", pricingModel:"membership-tiers",
    targetAudience:"High-net-worth car enthusiasts aged 35–60",
    primaryCTA:"Apply for Membership", secondaryCTA:"View the Fleet",
    assetTheme:"luxury sports car studio photography dramatic dark",
    avoid:["perfume imagery","fashion photography","generic business stock"],
    colorHint:"#D4AF37", typography:"serif", designMood:"dark luxury",
    copyTone:"Aspirational and exclusive. Never pushy. Refined.",
    keyBenefits:["Curated fleet of 40+ supercars","White-glove concierge","Members-only events","No insurance hassle","Monthly new arrivals"],
    sectionPatch: s => addSectionAfter(
      patchSection(s, "services", {id:"fleet",    headline:"Curated Fleet",       purpose:"Showcase premium vehicles"}),
      "fleet", {id:"membership", category:"pricing", variant:"three-tier", headline:"Membership Tiers", purpose:"Bronze/Silver/Gold with benefits"}
    ),
  },
  {
    domain:"car-dealership", base:"ECOMMERCE",
    labels:["car dealership","auto dealership","car sales","used cars","new cars","vehicle sales","car showroom","automobile dealer"],
    projectName:"{Brand} Motors", tagline:"Your Perfect Car is Here",
    businessGoal:"lead", targetAudience:"Car buyers seeking new or used vehicles",
    primaryCTA:"Schedule Test Drive", secondaryCTA:"Browse Inventory",
    assetTheme:"car dealership showroom vehicles modern professional",
    avoid:["generic stock photos","dark luxury car club aesthetic"],
    sectionPatch: s => patchSection(
      patchSection(s, "products", {id:"inventory", headline:"Browse Inventory", purpose:"Vehicle cards with price, mileage, specs"}),
      "cta", {headline:"Finance from $199/month", purpose:"Finance calculator or enquiry form"}
    ),
  },
  {
    domain:"car-rental", base:"HOSPITALITY",
    labels:["car rental","vehicle rental","rent a car","car hire","fleet rental","van hire","truck rental"],
    projectName:"{Brand} Car Rental", tagline:"Freedom on Every Road",
    businessGoal:"booking", targetAudience:"Business and leisure travelers needing vehicle hire",
    primaryCTA:"Reserve a Vehicle", secondaryCTA:"View Fleet",
    assetTheme:"car rental fleet vehicles road modern clean",
    avoid:["luxury car club aesthetic","dark dramatic"],
    sectionPatch: s => patchSection(s, "services", {headline:"Our Fleet", purpose:"Vehicle categories: Economy, SUV, Luxury, Van"}),
  },
  {
    domain:"ev-charging", base:"SAAS",
    labels:["ev charging","electric vehicle charging","ev station","charging network","ev infrastructure","electric car charging"],
    projectName:"{Brand} Charging", tagline:"Charge Faster. Drive Further.",
    businessGoal:"lead", targetAudience:"EV owners and fleet operators",
    primaryCTA:"Find a Station", secondaryCTA:"Partner With Us",
    assetTheme:"electric vehicle EV charging station modern clean green",
    avoid:["fossil fuel imagery","complex tech jargon"],
    designMood:"clean modern green", colorHint:"#22C55E",
  },
  {
    domain:"taxi-transport", base:"HOSPITALITY",
    labels:["taxi","cab","rideshare","transport","shuttle","chauffeur","limo service","private hire","minibus"],
    projectName:"{Brand} Transport", tagline:"Safe. On Time. Every Time.",
    businessGoal:"booking", targetAudience:"Commuters and travellers needing reliable transport",
    primaryCTA:"Book a Ride", secondaryCTA:"Download App",
    assetTheme:"taxi transport vehicle city professional driver",
    avoid:["luxury car club aesthetic"],
    sectionPatch: s => patchSection(s, "booking", {headline:"Book Your Ride", purpose:"Pickup, destination, date/time form"}),
  },

  // ── FOOD & DRINK ─────────────────────────────────────────────────────
  {
    domain:"restaurant", base:"HOSPITALITY",
    labels:["restaurant","fine dining","dining","bistro","brasserie","steakhouse","seafood restaurant","italian restaurant","mexican restaurant","asian restaurant"],
    projectName:"{Brand} Restaurant", tagline:"An Unforgettable Dining Experience",
    businessGoal:"booking", targetAudience:"Food lovers, couples, groups celebrating occasions",
    primaryCTA:"Reserve a Table", secondaryCTA:"View Menu",
    assetTheme:"fine dining restaurant food photography plating elegant",
    avoid:["generic stock food photos","tech startup aesthetic"],
    typography:"serif",
    sectionPatch: s => addSectionAfter(
      patchSection(s,"services",{id:"menu", headline:"Our Menu", purpose:"Signature dishes with food photography"}),
      "menu", {id:"chef", category:"features", variant:"alternating", headline:"Meet the Chef", purpose:"Chef story and culinary philosophy"}
    ),
  },
  {
    domain:"cafe", base:"HOSPITALITY",
    labels:["cafe","coffee shop","coffee house","bakery cafe","brunch","tea room","specialty coffee","espresso bar"],
    projectName:"{Brand} Café", tagline:"Your Daily Ritual, Perfected.",
    businessGoal:"booking", targetAudience:"Coffee lovers and casual dining guests",
    primaryCTA:"Find Us", secondaryCTA:"View Menu",
    assetTheme:"cafe coffee latte art specialty coffee warm cozy interior",
    avoid:["fine dining formality","tech aesthetic"],
    designMood:"warm cozy", copyTone:"Friendly and inviting. Local and authentic. Celebrate the craft.",
    sectionPatch: s => patchSection(s,"services",{headline:"Our Menu", purpose:"Coffee, food, seasonal specials"}),
  },
  {
    domain:"bar-pub", base:"HOSPITALITY",
    labels:["bar","pub","cocktail bar","wine bar","sports bar","nightclub","brewery","taproom","speakeasy"],
    projectName:"{Brand} Bar", tagline:"Good Drinks. Great Nights.",
    businessGoal:"booking", targetAudience:"Adults seeking social drinking experiences",
    primaryCTA:"Book a Table", secondaryCTA:"View Drinks Menu",
    assetTheme:"bar cocktails drinks nightlife atmosphere dark moody",
    avoid:["family restaurant aesthetic","formal corporate"],
    designMood:"dark moody", typography:"sans",
    sectionPatch: s => patchSection(s,"services",{headline:"Our Drinks", purpose:"Cocktails, wines, beers — curated menu"}),
  },
  {
    domain:"bakery", base:"HOSPITALITY",
    labels:["bakery","bread","pastry","patisserie","cake shop","dessert shop","confectionery","artisan bread"],
    projectName:"{Brand} Bakery", tagline:"Baked Fresh Every Morning.",
    businessGoal:"ecommerce", targetAudience:"Local community and artisan food lovers",
    primaryCTA:"Order Now", secondaryCTA:"View Products",
    assetTheme:"artisan bakery bread pastry food photography warm",
    avoid:["fast food aesthetic","corporate restaurant look"],
    pricingModel:"product-price",
  },
  {
    domain:"food-delivery", base:"ECOMMERCE",
    labels:["food delivery","meal delivery","meal kit","meal prep","catering delivery","cloud kitchen"],
    projectName:"{Brand} Delivery", tagline:"Restaurant Quality. Delivered to Your Door.",
    businessGoal:"ecommerce", targetAudience:"Busy professionals and families",
    primaryCTA:"Order Now", secondaryCTA:"View Menu",
    assetTheme:"food delivery meal freshness photography modern",
    avoid:["stock restaurant imagery"],
    sectionPatch: s => patchSection(s,"products",{headline:"This Week's Menu", purpose:"Meal cards with allergens, cals, portion"}),
  },

  // ── HOSPITALITY & TRAVEL ─────────────────────────────────────────────
  {
    domain:"hotel", base:"HOSPITALITY",
    labels:["hotel","boutique hotel","luxury hotel","motel","inn","bed breakfast","accommodation"],
    projectName:"{Brand} Hotel", tagline:"Where Every Stay Tells a Story",
    businessGoal:"booking", targetAudience:"Leisure and business travellers",
    primaryCTA:"Book Your Stay", secondaryCTA:"View Rooms",
    assetTheme:"luxury hotel room interior pool elegant warm lighting",
    avoid:["stock office photography","tech startup aesthetic"],
    typography:"serif", designMood:"warm elegant",
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"centered",         headline:"A Retreat Unlike Any Other",    purpose:"Full-screen property hero"},
      {id:"rooms",      category:"features",     variant:"bento-grid",       headline:"Rooms & Suites",               purpose:"Room type cards with features"},
      {id:"amenities",  category:"features",     variant:"icon-grid",        headline:"Hotel Amenities",              purpose:"Pool, spa, restaurant, gym"},
      {id:"dining",     category:"features",     variant:"alternating",      headline:"Dining",                       purpose:"Restaurant and bar experience"},
      {id:"gallery",    category:"features",     variant:"bento-grid",       headline:"Gallery",                      purpose:"Property photography"},
      {id:"testimonials",category:"testimonials",variant:"masonry",          headline:"Guest Reviews",                purpose:"Real guest stories"},
      {id:"booking",    category:"cta",          variant:"split-form",       headline:"Reserve Your Stay",            purpose:"Check-in/out date form"},
      {id:"footer",     category:"footer",       variant:"four-column",      headline:"",                              purpose:"Rooms, dining, facilities, contact"},
    ],
  },
  {
    domain:"resort", base:"HOSPITALITY",
    labels:["resort","luxury resort","beach resort","mountain resort","spa resort","eco resort","all-inclusive","retreat center"],
    projectName:"{Brand} Resort", tagline:"Escape to Paradise",
    businessGoal:"booking", targetAudience:"Affluent leisure travellers and honeymooners",
    primaryCTA:"Book Your Escape", secondaryCTA:"Explore Experiences",
    assetTheme:"luxury resort pool beach destination paradise photography",
    avoid:["budget hotel aesthetic","business travel imagery"],
    typography:"serif", designMood:"warm luxury", spacing:"generous",
  },
  {
    domain:"travel-agency", base:"HOSPITALITY",
    labels:["travel agency","tour operator","travel company","holiday packages","guided tours","adventure travel","luxury travel","safari"],
    projectName:"{Brand} Travel", tagline:"Extraordinary Journeys Await",
    businessGoal:"booking", targetAudience:"Adventure seekers and leisure travellers",
    primaryCTA:"Plan My Trip", secondaryCTA:"Explore Destinations",
    assetTheme:"travel destination photography landscape adventure vibrant",
    avoid:["corporate business aesthetic","dark moody"],
    sectionPatch: s => [
      {id:"hero",        category:"hero",         variant:"centered",         headline:"The World is Waiting",         purpose:"Destination imagery with CTA"},
      {id:"destinations",category:"features",     variant:"bento-grid",       headline:"Popular Destinations",        purpose:"Destination cards"},
      {id:"packages",    category:"features",     variant:"alternating",      headline:"Our Travel Packages",         purpose:"Package details with price"},
      {id:"why-us",      category:"features",     variant:"icon-grid",        headline:"Why Travel With Us",          purpose:"Guides, routes, support"},
      {id:"testimonials",category:"testimonials", variant:"masonry",          headline:"Traveller Stories",           purpose:"Trip reviews"},
      {id:"booking",     category:"cta",          variant:"split-form",       headline:"Plan Your Perfect Trip",      purpose:"Destination inquiry form"},
      {id:"footer",      category:"footer",       variant:"four-column",      headline:"",                             purpose:"Destinations, packages, contact"},
    ],
  },
  {
    domain:"airline", base:"SAAS",
    labels:["airline","flights","aviation","air travel","charter flight","private jet","private aviation"],
    projectName:"{Brand} Airways", tagline:"Fly Without Limits",
    businessGoal:"booking", pricingModel:"none",
    targetAudience:"Business and leisure air travellers",
    primaryCTA:"Search Flights", secondaryCTA:"View Routes",
    assetTheme:"airline aircraft flight travel sky modern",
    avoid:["budget low-cost aesthetic","heavy animation"],
  },

  // ── HEALTH & WELLNESS ─────────────────────────────────────────────────
  {
    domain:"gym", base:"PROFESSIONAL",
    labels:["gym","fitness center","fitness club","crossfit box","powerlifting gym","bodybuilding gym","health club","athletic club"],
    projectName:"{Brand} Fitness", tagline:"Transform Your Body. Transform Your Life.",
    businessGoal:"membership", pricingModel:"membership-tiers",
    targetAudience:"Fitness-conscious adults 18–45 seeking real results",
    primaryCTA:"Start Free Trial", secondaryCTA:"View Programs",
    assetTheme:"gym fitness training athlete workout high energy dark",
    avoid:["soft spa aesthetic","luxury fashion"],
    designMood:"bold dark", typography:"sans", spacing:"tight",
    copyTone:"Energetic and motivational. Results-focused. Power words.",
    keyBenefits:["Expert certified coaches","State-of-art equipment","Flexible class schedule","Real community","Guaranteed results"],
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"split-image",     headline:"Unleash Your Potential",         purpose:"High-energy hero with athlete"},
      {id:"results",    category:"features",     variant:"stat-highlight",  headline:"Real Results",                   purpose:"Members lost, gained, transformed"},
      {id:"programs",   category:"features",     variant:"bento-grid",     headline:"Training Programs",              purpose:"Strength, HIIT, Yoga, Boxing"},
      {id:"coaches",    category:"features",     variant:"alternating",    headline:"Expert Coaches",                 purpose:"Coach profiles with credentials"},
      {id:"membership", category:"pricing",      variant:"three-tier",     headline:"Choose Your Plan",              purpose:"Basic/Pro/Elite tiers"},
      {id:"testimonials",category:"testimonials",variant:"grid",           headline:"Member Transformations",        purpose:"Before/after success stories"},
      {id:"cta",        category:"cta",          variant:"banner-strip",   headline:"Start Your Journey Today",      purpose:"Free trial or first class offer"},
      {id:"footer",     category:"footer",       variant:"four-column",    headline:"",                               purpose:"Schedule, classes, location"},
    ],
  },
  {
    domain:"yoga-studio", base:"HOSPITALITY",
    labels:["yoga studio","yoga","pilates","meditation","mindfulness","breathwork","hot yoga","vinyasa","barre"],
    projectName:"{Brand} Studio", tagline:"Find Your Inner Strength.",
    businessGoal:"membership", pricingModel:"membership-tiers",
    targetAudience:"Wellness-focused adults seeking balance and mindfulness",
    primaryCTA:"Try a Free Class", secondaryCTA:"View Schedule",
    assetTheme:"yoga studio calm serene natural light practice",
    avoid:["intense gym aesthetic","dark dramatic"],
    designMood:"calm natural", typography:"serif", spacing:"generous",
    copyTone:"Calm, centred, and inviting. Speak to the journey inward.",
  },
  {
    domain:"spa", base:"HOSPITALITY",
    labels:["spa","day spa","luxury spa","beauty spa","wellness spa","massage","facial","body treatment","medi-spa"],
    projectName:"{Brand} Spa", tagline:"Restore. Renew. Rejuvenate.",
    businessGoal:"booking", targetAudience:"Adults seeking relaxation and beauty treatments",
    primaryCTA:"Book a Treatment", secondaryCTA:"View Treatments",
    assetTheme:"luxury spa massage treatment wellness serene elegant",
    avoid:["gym energy","medical clinical aesthetic"],
    typography:"serif", designMood:"calm luxury", spacing:"generous",
    copyTone:"Serene and restorative. Sensory language. Make them feel relaxed reading the copy.",
  },
  {
    domain:"salon", base:"HOSPITALITY",
    labels:["hair salon","beauty salon","hairdresser","hair studio","blow dry bar","colour specialist","hair extensions"],
    projectName:"{Brand} Salon", tagline:"Look Good. Feel Amazing.",
    businessGoal:"booking", targetAudience:"Style-conscious individuals seeking expert hair services",
    primaryCTA:"Book Appointment", secondaryCTA:"View Services",
    assetTheme:"hair salon beauty professional styling photography",
    avoid:["generic beauty stock","corporate imagery"],
    designMood:"modern chic",
  },
  {
    domain:"barber", base:"HOSPITALITY",
    labels:["barber","barber shop","barbershop","men's grooming","beard trim","men haircut","shave"],
    projectName:"{Brand} Barbershop", tagline:"Sharp Cuts. Clean Lines.",
    businessGoal:"booking", targetAudience:"Style-conscious men seeking premium grooming",
    primaryCTA:"Book a Cut", secondaryCTA:"View Services",
    assetTheme:"barbershop men grooming vintage modern clean",
    avoid:["women's salon aesthetic","soft spa imagery"],
    designMood:"dark vintage modern", typography:"sans",
  },
  {
    domain:"dental", base:"PROFESSIONAL",
    labels:["dental","dentist","dental clinic","orthodontist","dental surgery","teeth whitening","cosmetic dentistry","orthodontics"],
    projectName:"{Brand} Dental", tagline:"A Healthier Smile Starts Here.",
    businessGoal:"booking", targetAudience:"Patients seeking quality dental care",
    primaryCTA:"Book Dental Appointment", secondaryCTA:"View Treatments",
    assetTheme:"dental clinic teeth whitening modern clean professional",
    avoid:["dark dramatic aesthetic","luxury car imagery"],
    sectionPatch: s => addSectionAfter(s,"services",{id:"treatments",category:"features",variant:"bento-grid",headline:"Our Treatments",purpose:"Whitening, Implants, Braces, Invisalign"}),
  },
  {
    domain:"healthcare", base:"PROFESSIONAL",
    labels:["hospital","clinic","doctor","medical","healthcare","general practice","gp","specialist","physiotherapy","therapy","mental health"],
    projectName:"{Brand} Clinic", tagline:"Your Health. Our Priority.",
    businessGoal:"booking", targetAudience:"Patients seeking quality medical care",
    primaryCTA:"Book an Appointment", secondaryCTA:"View Services",
    assetTheme:"medical clinic doctor healthcare clean professional bright",
    avoid:["dark aesthetic","luxury imagery","startup look"],
    designMood:"clean light", copyTone:"Warm, reassuring, and professional. Patient-first language.",
  },
  {
    domain:"pharmacy", base:"ECOMMERCE",
    labels:["pharmacy","chemist","drugstore","online pharmacy","prescription","health products","vitamins","supplements"],
    projectName:"{Brand} Pharmacy", tagline:"Your Health. Delivered.",
    businessGoal:"ecommerce", targetAudience:"Health-conscious consumers and patients",
    primaryCTA:"Shop Now", secondaryCTA:"Upload Prescription",
    assetTheme:"pharmacy health products clean professional modern",
    avoid:["dark moody","luxury aesthetic"],
    designMood:"clean professional",
  },
  {
    domain:"veterinary", base:"PROFESSIONAL",
    labels:["vet","veterinary","animal clinic","pet clinic","veterinarian","animal hospital","pet care"],
    projectName:"{Brand} Veterinary", tagline:"Exceptional Care for Every Pet.",
    businessGoal:"booking", targetAudience:"Pet owners seeking trusted veterinary care",
    primaryCTA:"Book Pet Appointment", secondaryCTA:"Our Services",
    assetTheme:"veterinary clinic pets animals professional caring",
    avoid:["human medical aesthetic","dark imagery"],
    copyTone:"Warm and caring. Speak to both pet and owner. Reassuring and expert.",
  },
  {
    domain:"nutritionist", base:"PROFESSIONAL",
    labels:["nutritionist","dietitian","nutrition coach","meal planner","weight loss coach","health coach"],
    projectName:"{Brand} Nutrition", tagline:"Eat Well. Live Better.",
    businessGoal:"lead", targetAudience:"Health-conscious adults seeking dietary guidance",
    primaryCTA:"Book Free Consultation", secondaryCTA:"View Programs",
    assetTheme:"nutrition healthy food lifestyle professional clean",
    avoid:["medical clinical aesthetic","gym aggressive energy"],
  },
  {
    domain:"mental-health", base:"PROFESSIONAL",
    labels:["therapist","psychologist","counsellor","mental health","therapy","life coach","mindfulness coach","CBT"],
    projectName:"{Brand} Therapy", tagline:"Helping You Thrive.",
    businessGoal:"booking", targetAudience:"Adults seeking mental health support",
    primaryCTA:"Book a Session", secondaryCTA:"Learn More",
    assetTheme:"therapy counselling calm office professional warm",
    avoid:["clinical cold aesthetic","dark imagery"],
    designMood:"calm warm", typography:"serif",
    copyTone:"Empathetic, non-clinical, and accessible. Safe and supportive language.",
  },

  // ── BEAUTY & FASHION ─────────────────────────────────────────────────
  {
    domain:"fashion", base:"ECOMMERCE",
    labels:["fashion","clothing","apparel","fashion brand","streetwear","luxury fashion","designer clothing","boutique clothing"],
    projectName:"{Brand}", tagline:"Wear Your Story",
    businessGoal:"ecommerce", targetAudience:"Fashion-forward shoppers",
    primaryCTA:"Shop the Collection", secondaryCTA:"Explore Looks",
    assetTheme:"fashion clothing lifestyle editorial model photography",
    avoid:["generic product stock","tech startup aesthetic"],
    designMood:"bold editorial", typography:"display", spacing:"generous",
  },
  {
    domain:"jewelry", base:"ECOMMERCE",
    labels:["jewelry","jewellery","diamonds","rings","necklaces","watches","luxury jewelry","engagement rings","fine jewelry"],
    projectName:"{Brand}", tagline:"Crafted to Last a Lifetime",
    businessGoal:"ecommerce", targetAudience:"Discerning buyers seeking quality jewelry",
    primaryCTA:"Shop Collection", secondaryCTA:"Book Consultation",
    assetTheme:"jewelry luxury diamonds close-up macro photography elegant dark",
    avoid:["casual fashion aesthetic","generic product grid"],
    designMood:"dark luxury", typography:"serif", spacing:"generous",
    colorHint:"#D4AF37",
  },
  {
    domain:"watch-brand", base:"ECOMMERCE",
    labels:["watch","timepiece","luxury watch","watch brand","horology","smartwatch","watch collection"],
    projectName:"{Brand}", tagline:"Time, Perfected.",
    businessGoal:"ecommerce", targetAudience:"Watch enthusiasts and collectors",
    primaryCTA:"Explore Collection", secondaryCTA:"Find a Dealer",
    assetTheme:"luxury watch timepiece photography macro detail dramatic",
    avoid:["generic product grid","tech startup aesthetic"],
    designMood:"dark luxury", typography:"serif", colorHint:"#1a1a1a",
  },
  {
    domain:"beauty-brand", base:"ECOMMERCE",
    labels:["beauty","cosmetics","skincare","makeup","beauty brand","lipstick","foundation","serum","beauty products"],
    projectName:"{Brand} Beauty", tagline:"Your Ritual. Your Glow.",
    businessGoal:"ecommerce", targetAudience:"Beauty enthusiasts aged 18–45",
    primaryCTA:"Shop Now", secondaryCTA:"Take the Quiz",
    assetTheme:"beauty skincare cosmetics model photography clean modern",
    avoid:["dark moody","tech aesthetic"],
    designMood:"clean minimal feminine",
  },
  {
    domain:"perfume", base:"ECOMMERCE",
    labels:["perfume","fragrance","cologne","eau de parfum","scent","luxury fragrance","perfumery"],
    projectName:"{Brand}", tagline:"Scent is Memory.",
    businessGoal:"ecommerce", targetAudience:"Fragrance connoisseurs and gift buyers",
    primaryCTA:"Shop Fragrances", secondaryCTA:"Find Your Scent",
    assetTheme:"perfume fragrance bottle luxury photography dark dramatic",
    avoid:["car imagery","tech aesthetic","generic product grid"],
    designMood:"dark luxury", typography:"serif", spacing:"generous",
    copyTone:"Sensory and poetic. Evoke the fragrance experience through language.",
  },

  // ── HOME & PROPERTY ───────────────────────────────────────────────────
  {
    domain:"real-estate", base:"PROFESSIONAL",
    labels:["real estate","property","homes","realtor","estate agent","house sales","property developer","lettings","property management"],
    projectName:"{Brand} Real Estate", tagline:"Find Your Perfect Home",
    businessGoal:"lead", targetAudience:"Home buyers, sellers, and investors",
    primaryCTA:"Book a Valuation", secondaryCTA:"Browse Properties",
    assetTheme:"luxury home interior modern architecture real estate",
    avoid:["generic handshake photos","dark dramatic"],
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"split-image",     headline:"Your Dream Home is Waiting",  purpose:"Property hero with search/CTA"},
      {id:"featured",   category:"features",     variant:"bento-grid",      headline:"Featured Properties",        purpose:"Property cards with price, beds"},
      {id:"services",   category:"features",     variant:"icon-grid",       headline:"Our Services",               purpose:"Buy, Sell, Rent, Manage, Value"},
      {id:"about",      category:"features",     variant:"alternating",     headline:"Why Choose Us",              purpose:"Agent expertise and local knowledge"},
      {id:"testimonials",category:"testimonials",variant:"featured",        headline:"Client Stories",             purpose:"Buyer/seller success stories"},
      {id:"stats",      category:"features",     variant:"stat-highlight",  headline:"Our Track Record",           purpose:"Properties sold, years, satisfaction"},
      {id:"contact",    category:"cta",          variant:"split-form",      headline:"Get a Free Valuation",       purpose:"Property valuation request form"},
      {id:"footer",     category:"footer",       variant:"four-column",     headline:"",                            purpose:"Areas, types, contact, social"},
    ],
  },
  {
    domain:"interior-design", base:"PORTFOLIO",
    labels:["interior design","interior designer","interior decorator","home design","space design","interior architecture"],
    projectName:"{Name} Interior Design", tagline:"Spaces That Tell Your Story",
    businessGoal:"lead", targetAudience:"Homeowners and developers seeking design services",
    primaryCTA:"Book Consultation", secondaryCTA:"View Portfolio",
    assetTheme:"interior design home architecture photography beautiful spaces modern",
    avoid:["generic office imagery","corporate look"],
    typography:"serif", designMood:"clean elegant", spacing:"generous",
  },
  {
    domain:"architecture", base:"PORTFOLIO",
    labels:["architect","architecture firm","architectural design","building design","structural design","urban design"],
    projectName:"{Brand} Architecture", tagline:"Buildings that Inspire.",
    businessGoal:"lead", targetAudience:"Developers, government, and private clients",
    primaryCTA:"Start a Project", secondaryCTA:"View Projects",
    assetTheme:"architecture building modern photography dramatic structural",
    avoid:["interior home design aesthetic","soft residential look"],
    designMood:"bold minimal", typography:"sans", spacing:"generous",
  },
  {
    domain:"construction", base:"PROFESSIONAL",
    labels:["construction","builder","building company","contractor","civil engineering","renovation","fit-out","home builder"],
    projectName:"{Brand} Construction", tagline:"Built to Last.",
    businessGoal:"lead", targetAudience:"Property developers and homeowners needing construction",
    primaryCTA:"Get a Quote", secondaryCTA:"View Projects",
    assetTheme:"construction building site modern professional quality",
    avoid:["luxury aesthetic","soft design portfolio look"],
    copyTone:"Reliable and expert. Lead with quality and track record. Practical language.",
  },
  {
    domain:"furniture", base:"ECOMMERCE",
    labels:["furniture","furniture brand","home furniture","office furniture","bespoke furniture","custom furniture","sofas","beds"],
    projectName:"{Brand} Furniture", tagline:"Live in Style.",
    businessGoal:"ecommerce", targetAudience:"Homeowners and interior designers",
    primaryCTA:"Shop Collection", secondaryCTA:"Visit Showroom",
    assetTheme:"furniture interior home lifestyle photography modern elegant",
    avoid:["generic product grid","tech aesthetic"],
    designMood:"warm minimal", typography:"serif",
  },

  // ── TECHNOLOGY & SOFTWARE ─────────────────────────────────────────────
  {
    domain:"saas", base:"SAAS",
    labels:["saas","software as a service","subscription software","b2b platform","software platform","business software"],
    projectName:"{Brand}", tagline:"The Smarter Way to {action}",
    targetAudience:"Teams and businesses improving efficiency",
    primaryCTA:"Start Free Trial", secondaryCTA:"View Demo",
    assetTheme:"saas software product dashboard clean modern professional",
    avoid:["stock business handshake","generic office imagery"],
  },
  {
    domain:"ai-startup", base:"SAAS",
    labels:["ai startup","ai company","ai product","ai platform","machine learning","gpt","llm","generative ai","ai tool"],
    projectName:"{Brand} AI", tagline:"Intelligence at Scale.",
    targetAudience:"Developers and product teams building with AI",
    primaryCTA:"Start Building Free", secondaryCTA:"View API Docs",
    assetTheme:"ai artificial intelligence abstract data neural network modern",
    avoid:["stock robot imagery","sci-fi cliche aesthetic"],
    designMood:"dark tech", colorHint:"#6D28D9",
  },
  {
    domain:"cybersecurity", base:"SAAS",
    labels:["cybersecurity","security company","information security","network security","penetration testing","soc","threat detection","endpoint security"],
    projectName:"{Brand} Security", tagline:"Stay Protected. Stay Ahead.",
    targetAudience:"CTOs and IT security teams at mid-to-enterprise companies",
    primaryCTA:"Get Security Assessment", secondaryCTA:"View Solutions",
    assetTheme:"cybersecurity data protection technology dark abstract",
    avoid:["hacker cliche imagery","generic shield icons"],
    designMood:"dark professional", copyTone:"Authoritative and confident. Lead with threats and protection.",
  },
  {
    domain:"crm", base:"SAAS",
    labels:["crm","customer relationship","lead management","sales crm","sales platform","pipeline management","contact management"],
    projectName:"{Brand} CRM", tagline:"Close More. Build More. Grow More.",
    targetAudience:"Sales teams and business development managers",
    primaryCTA:"Try Free for 14 Days", secondaryCTA:"Watch Demo",
    assetTheme:"crm sales dashboard pipeline modern clean professional",
    avoid:["generic handshake stock","luxury aesthetic"],
    sectionPatch: s => patchSection(s,"workflow",{headline:"Your Sales Pipeline, Simplified"}),
  },
  {
    domain:"erp", base:"SAAS",
    labels:["erp","enterprise resource planning","business management system","inventory management","supply chain","manufacturing software"],
    projectName:"{Brand} ERP", tagline:"One System. Total Control.",
    targetAudience:"Operations directors and C-suite at manufacturing and enterprise companies",
    primaryCTA:"Request a Demo", secondaryCTA:"View Modules",
    assetTheme:"erp enterprise software dashboard professional management",
    avoid:["consumer app aesthetic","startup look"],
    copyTone:"Enterprise-grade and ROI-focused. Speak to efficiency and control.",
  },
  {
    domain:"developer-tool", base:"SAAS",
    labels:["developer tool","devtool","api","developer platform","open source","cli tool","sdk","coding tool","dev platform"],
    projectName:"{Brand}", tagline:"Built for Developers. Loved by Teams.",
    targetAudience:"Software engineers and engineering teams",
    primaryCTA:"Start Building Free", secondaryCTA:"View Docs",
    assetTheme:"developer tool code terminal dark modern professional",
    avoid:["corporate enterprise aesthetic","soft design"],
    designMood:"dark code", colorHint:"#1E293B",
    copyTone:"Developer-first. Technical but accessible. Show the code.",
  },
  {
    domain:"dashboard-analytics", base:"SAAS",
    labels:["dashboard","analytics platform","reporting tool","data platform","metrics","bi tool","business intelligence","data analytics","data visualization"],
    projectName:"{Brand} Analytics", tagline:"Your Data. Your Decisions.",
    targetAudience:"Data analysts and business operators",
    primaryCTA:"Start Free — No Credit Card", secondaryCTA:"View Live Demo",
    assetTheme:"analytics dashboard data visualization modern clean dark",
    avoid:["lifestyle photography","luxury aesthetic"],
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"product-showcase", headline:"All Your Metrics in One Place",  purpose:"Dashboard screenshot hero"},
      {id:"stats",      category:"dashboard",    variant:"topnav-cards",    headline:"Key KPIs",                       purpose:"Revenue, users, conversion cards"},
      {id:"analytics",  category:"dashboard",    variant:"analytics-charts",headline:"Advanced Analytics",             purpose:"Charts, maps, funnels"},
      {id:"features",   category:"features",     variant:"bento-grid",      headline:"Powerful Features",              purpose:"Real-time, exports, API, alerts"},
      {id:"tables",     category:"dashboard",    variant:"table-heavy",     headline:"Detailed Reporting",             purpose:"Sortable data tables"},
      {id:"pricing",    category:"pricing",      variant:"comparison-table",headline:"Plans for Every Team",           purpose:"Free/Pro/Enterprise comparison"},
      {id:"testimonials",category:"testimonials",variant:"logo-wall",       headline:"Trusted by Data Teams",          purpose:"Logos + quotes"},
      {id:"cta",        category:"cta",          variant:"centered-gradient",headline:"Start Analyzing Free",          purpose:"Free account CTA"},
      {id:"footer",     category:"footer",       variant:"newsletter-rich", headline:"",                                purpose:"Product, API, security, status"},
    ],
  },

  // ── FINANCE & LEGAL ───────────────────────────────────────────────────
  {
    domain:"law-firm", base:"PROFESSIONAL",
    labels:["law firm","lawyer","solicitor","barrister","attorney","legal services","legal advice","employment law","family law","corporate law"],
    projectName:"{Brand} Law", tagline:"Trusted Legal Counsel.",
    businessGoal:"lead", targetAudience:"Individuals and businesses needing legal representation",
    primaryCTA:"Book Free Consultation", secondaryCTA:"Our Practice Areas",
    assetTheme:"law firm professional office legal modern confident",
    avoid:["stock court imagery","generic handshake photos"],
    typography:"serif", designMood:"dark professional",
    copyTone:"Authoritative, confident, and clear. Client outcomes first.",
  },
  {
    domain:"accounting", base:"PROFESSIONAL",
    labels:["accounting","accountant","bookkeeping","tax","audit","financial accounting","cpa","chartered accountant"],
    projectName:"{Brand} Accounting", tagline:"Your Numbers. Our Expertise.",
    targetAudience:"SMEs and individuals needing accounting services",
    primaryCTA:"Book Free Consultation", secondaryCTA:"Our Services",
    assetTheme:"accounting finance professional office modern clean",
    avoid:["dark moody","complex graphics"],
  },
  {
    domain:"finance", base:"PROFESSIONAL",
    labels:["financial advisor","wealth management","financial planning","investment advisor","IFA","financial services","pension","investment management"],
    projectName:"{Brand} Financial", tagline:"Your Wealth. Your Future.",
    targetAudience:"Professionals and HNWIs planning financial futures",
    primaryCTA:"Book a Strategy Call", secondaryCTA:"Our Services",
    assetTheme:"wealth finance professional modern confident clean",
    avoid:["stock money imagery","generic handshake"],
    designMood:"dark professional", typography:"serif",
  },
  {
    domain:"insurance", base:"PROFESSIONAL",
    labels:["insurance","insurance broker","life insurance","car insurance","home insurance","business insurance","health insurance"],
    projectName:"{Brand} Insurance", tagline:"Protected for What Matters Most.",
    targetAudience:"Individuals and businesses seeking insurance coverage",
    primaryCTA:"Get a Quote", secondaryCTA:"Our Products",
    assetTheme:"insurance protection family home professional clean",
    avoid:["dark moody","complex jargon visuals"],
    copyTone:"Reassuring and clear. Lead with protection and peace of mind.",
  },
  {
    domain:"bank-fintech", base:"SAAS",
    labels:["bank","neobank","fintech","digital bank","online bank","challenger bank","financial app","payment platform","money app"],
    projectName:"{Brand}", tagline:"Banking Built for the Modern World.",
    targetAudience:"Consumers and SMEs seeking better banking",
    primaryCTA:"Open Account Free", secondaryCTA:"View Features",
    assetTheme:"fintech banking app modern clean minimal phone mockup",
    avoid:["traditional bank imagery","stock briefcase photos"],
    designMood:"clean modern", colorHint:"#4F46E5",
  },
  {
    domain:"crypto", base:"SAAS",
    labels:["crypto","cryptocurrency","blockchain","defi","nft","web3","token","exchange","trading","staking"],
    projectName:"{Brand}", tagline:"The Future of Finance is Here.",
    targetAudience:"Crypto enthusiasts, traders, and DeFi participants",
    primaryCTA:"Start Trading", secondaryCTA:"View Markets",
    assetTheme:"cryptocurrency blockchain defi modern abstract dark neon",
    avoid:["traditional bank imagery","physical cash photos"],
    designMood:"dark tech neon", colorHint:"#22D3EE",
    copyTone:"Bold, forward-looking, community-first. Speak the language of Web3.",
  },

  // ── MEDIA & CONTENT ───────────────────────────────────────────────────
  {
    domain:"blog-magazine", base:"LANDING",
    labels:["blog","magazine","online publication","news","media","editorial","newsletter","content site","journal"],
    projectName:"{Brand}", tagline:"Stories That Matter.",
    businessGoal:"lead", projectType:"blog",
    targetAudience:"Curious readers seeking quality content",
    primaryCTA:"Subscribe Free", secondaryCTA:"Read Latest",
    assetTheme:"magazine editorial photography modern clean content",
    avoid:["corporate business aesthetic","dark tech look"],
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"centered",        headline:"Latest Stories",             purpose:"Featured article hero"},
      {id:"featured",   category:"features",     variant:"bento-grid",     headline:"Editor's Picks",             purpose:"Featured article grid"},
      {id:"categories", category:"features",     variant:"icon-grid",      headline:"Topics",                     purpose:"Category navigation"},
      {id:"about",      category:"features",     variant:"alternating",    headline:"About Us",                   purpose:"Publication mission and team"},
      {id:"cta",        category:"cta",          variant:"split-form",     headline:"Subscribe for Free",         purpose:"Email newsletter signup"},
      {id:"footer",     category:"footer",       variant:"newsletter-rich",headline:"",                            purpose:"Topics, authors, social, rss"},
    ],
  },
  {
    domain:"podcast", base:"LANDING",
    labels:["podcast","podcast show","audio show","radio show","interview show","business podcast"],
    projectName:"{Brand} Podcast", tagline:"Listen. Learn. Grow.",
    targetAudience:"Listeners seeking valuable audio content",
    primaryCTA:"Listen Now", secondaryCTA:"Subscribe",
    assetTheme:"podcast microphone studio recording modern professional",
    avoid:["generic office imagery","corporate stock"],
  },

  // ── PROFESSIONAL SERVICES ─────────────────────────────────────────────
  {
    domain:"marketing-agency", base:"PORTFOLIO",
    labels:["marketing agency","digital marketing","growth agency","ppc agency","seo agency","content marketing","social media agency","performance marketing"],
    projectName:"{Brand} Marketing", tagline:"Growth Marketing That Delivers.",
    businessGoal:"lead", targetAudience:"D2C brands and startups seeking growth",
    primaryCTA:"Get Growth Strategy", secondaryCTA:"View Case Studies",
    assetTheme:"marketing agency results growth modern bold",
    avoid:["generic corporate handshake","dark luxury"],
    sectionPatch: s => addSectionAfter(s,"work",{id:"results",category:"features",variant:"stat-highlight",headline:"Results We're Proud Of",purpose:"ROAS, revenue generated, leads"}),
  },
  {
    domain:"creative-agency", base:"PORTFOLIO",
    labels:["creative agency","design agency","branding agency","brand agency","advertising agency","creative studio","brand design"],
    projectName:"{Brand} Studio", tagline:"We Build Brands That Matter.",
    targetAudience:"Startups and scale-ups seeking brand identity",
    primaryCTA:"Start a Project", secondaryCTA:"View Our Work",
    assetTheme:"creative agency branding design work bold editorial modern",
    avoid:["generic handshake stock","corporate blue"],
    designMood:"bold editorial", typography:"display",
  },
  {
    domain:"consultancy", base:"PROFESSIONAL",
    labels:["consultant","consultancy","management consulting","strategy consulting","business consultant","advisory","management advisory"],
    projectName:"{Brand} Consulting", tagline:"Strategy That Moves Business.",
    targetAudience:"C-suite and senior leaders at growth-stage companies",
    primaryCTA:"Book Strategy Call", secondaryCTA:"Our Services",
    assetTheme:"consulting strategy business professional confident modern",
    avoid:["stock handshake","generic office photos"],
    typography:"serif",
  },
  {
    domain:"hr-recruiting", base:"SAAS",
    labels:["hr","human resources","recruiting","talent acquisition","staffing","recruitment agency","job board","ats","hrms"],
    projectName:"{Brand}", tagline:"Hire Smarter. Build Better Teams.",
    targetAudience:"HR directors and hiring managers",
    primaryCTA:"Start Hiring Free", secondaryCTA:"View Platform",
    assetTheme:"hr recruiting team people professional modern office",
    avoid:["dark tech aesthetic","generic stock handshake"],
  },
  {
    domain:"ngo-charity", base:"LANDING",
    labels:["ngo","charity","non-profit","nonprofit","foundation","cause","humanitarian","social impact","fundraising"],
    projectName:"{Brand}", tagline:"Together We Change Lives.",
    businessGoal:"lead", targetAudience:"Donors, volunteers, and beneficiaries",
    primaryCTA:"Donate Now", secondaryCTA:"Learn More",
    assetTheme:"charity impact people community humanitarian photography",
    avoid:["corporate business aesthetic","dark moody"],
    designMood:"warm human", colorHint:"#F59E0B",
    copyTone:"Heartfelt and impactful. Human stories. Show real impact with numbers.",
  },

  // ── EDUCATION ────────────────────────────────────────────────────────
  {
    domain:"school-university", base:"PROFESSIONAL",
    labels:["school","university","college","academy","institution","educational institution","private school","boarding school"],
    projectName:"{Brand} Academy", tagline:"Education That Opens Doors.",
    targetAudience:"Students and parents seeking quality education",
    primaryCTA:"Apply Now", secondaryCTA:"Book Open Day",
    assetTheme:"school university campus students learning modern",
    avoid:["startup aesthetic","dark corporate"],
    sectionPatch: s => addSectionAfter(s,"services",{id:"outcomes",category:"features",variant:"stat-highlight",headline:"Student Outcomes",purpose:"Employment rate, salary, awards"}),
  },
  {
    domain:"online-course", base:"SAAS",
    labels:["online course","e-learning","lms","course platform","learning platform","mooc","udemy","teachable","online education","training platform"],
    projectName:"{Brand} Academy", tagline:"Learn Without Limits.",
    businessGoal:"lead", targetAudience:"Professionals seeking skill development",
    primaryCTA:"Enroll Now", secondaryCTA:"Browse Courses",
    assetTheme:"online learning education laptop courses modern clean",
    avoid:["dark academic aesthetic","generic stock study"],
    sectionPatch: s => [
      {id:"hero",       category:"hero",         variant:"split-image",     headline:"Master New Skills. Change Your Future.",  purpose:"Student success imagery"},
      {id:"courses",    category:"features",     variant:"bento-grid",      headline:"Our Courses",                            purpose:"Course cards with duration, level"},
      {id:"why-us",     category:"features",     variant:"icon-grid",       headline:"Why Learn With Us",                      purpose:"Instructors, certificates, jobs"},
      {id:"outcomes",   category:"features",     variant:"stat-highlight",  headline:"Graduate Outcomes",                      purpose:"Job placement, salary increase"},
      {id:"instructors",category:"features",     variant:"alternating",     headline:"Learn From Experts",                     purpose:"Instructor profiles"},
      {id:"testimonials",category:"testimonials",variant:"masonry",         headline:"Student Success Stories",                purpose:"Graduate stories"},
      {id:"pricing",    category:"pricing",      variant:"three-tier",      headline:"Choose Your Path",                       purpose:"Free/Student/Pro tiers"},
      {id:"cta",        category:"cta",          variant:"split-form",      headline:"Start Learning Today",                   purpose:"Course interest signup"},
      {id:"footer",     category:"footer",       variant:"newsletter-rich", headline:"",                                        purpose:"Courses, blog, community, support"},
    ],
  },
  {
    domain:"coaching", base:"PROFESSIONAL",
    labels:["coach","coaching","life coach","executive coach","business coach","career coach","performance coach","mindset coach"],
    projectName:"{Name} Coaching", tagline:"Unlock Your Full Potential.",
    targetAudience:"Ambitious professionals seeking transformational growth",
    primaryCTA:"Book Discovery Call", secondaryCTA:"View Programs",
    assetTheme:"coaching professional success confidence portrait photography",
    avoid:["clinical therapy aesthetic","corporate consulting look"],
    copyTone:"Inspiring and outcome-focused. Personal transformation language.",
  },

  // ── CREATIVE PROFESSIONALS ────────────────────────────────────────────
  {
    domain:"photography", base:"PORTFOLIO",
    labels:["photographer","photography","photoshoot","photo studio","portrait photographer","wedding photographer","commercial photographer","product photographer"],
    projectName:"{Name} Photography", tagline:"Every Moment, Perfectly Captured.",
    targetAudience:"Couples, families, brands seeking professional photography",
    primaryCTA:"Book a Shoot", secondaryCTA:"View Portfolio",
    assetTheme:"photography portfolio editorial beautiful lighting professional",
    avoid:["stock photos","corporate office imagery"],
    designMood:"clean minimal", typography:"serif", spacing:"generous",
    sectionPatch: s => patchSection(s,"work",{id:"gallery",variant:"filter-gallery",headline:"Portfolio",purpose:"Filterable: Wedding/Commercial/Portrait/Events"}),
  },
  {
    domain:"videography", base:"PORTFOLIO",
    labels:["videographer","videography","video production","video company","film production","content creator","filmmaker"],
    projectName:"{Name} Films", tagline:"Stories Worth Telling.",
    targetAudience:"Brands, events, and individuals seeking video content",
    primaryCTA:"Get a Quote", secondaryCTA:"Watch Showreel",
    assetTheme:"videography film production professional camera cinematic",
    avoid:["photography-only aesthetic","stock video stills"],
    designMood:"dark cinematic",
  },
  {
    domain:"wedding", base:"HOSPITALITY",
    labels:["wedding","wedding venue","wedding planner","wedding photographer","bridal","wedding supplier","wedding florist"],
    projectName:"{Brand} Weddings", tagline:"Your Perfect Day, Perfectly Planned.",
    businessGoal:"lead", targetAudience:"Couples planning their wedding",
    primaryCTA:"Plan Your Wedding", secondaryCTA:"View Gallery",
    assetTheme:"wedding flowers bride ceremony photography elegant romantic",
    avoid:["dark moody","corporate aesthetic","tech startup look"],
    typography:"serif", designMood:"romantic elegant", spacing:"generous",
    copyTone:"Romantic and aspirational. Make them feel the magic of their day.",
  },
  {
    domain:"event-company", base:"HOSPITALITY",
    labels:["event company","event planner","events management","corporate events","event venue","party planner","conference organiser"],
    projectName:"{Brand} Events", tagline:"Events Worth Remembering.",
    businessGoal:"lead", targetAudience:"Businesses and individuals needing event services",
    primaryCTA:"Plan Your Event", secondaryCTA:"View Portfolio",
    assetTheme:"events conference gala dinner corporate photography",
    avoid:["wedding only aesthetic","dark intimate"],
  },

  // ── PORTFOLIO TYPES ───────────────────────────────────────────────────
  {
    domain:"portfolio-developer", base:"PORTFOLIO",
    labels:["developer portfolio","software engineer portfolio","fullstack developer","frontend developer","backend developer","web developer"],
    projectName:"{Name} — Developer", tagline:"Building the Web, One Line at a Time.",
    targetAudience:"Tech companies and startups hiring engineers",
    primaryCTA:"Hire Me", secondaryCTA:"View Projects",
    assetTheme:"developer workspace code dark minimal macbook",
    avoid:["stock business photos","formal corporate"],
    designMood:"dark minimal",
    sectionPatch: s => [
      {id:"hero",      category:"hero",         variant:"minimal-statement",headline:"Hi, I build things for the web.",  purpose:"Bold personal intro with stack"},
      {id:"about",     category:"features",     variant:"alternating",      headline:"About Me",                         purpose:"Story, stack, years, values"},
      {id:"skills",    category:"features",     variant:"stat-highlight",   headline:"Tech Stack",                       purpose:"React, Node, Python — with levels"},
      {id:"projects",  category:"portfolio",    variant:"featured-grid",    headline:"Selected Work",                    purpose:"Projects with tech, links, GitHub"},
      {id:"experience",category:"features",     variant:"icon-grid",        headline:"Experience",                       purpose:"Work history with impact numbers"},
      {id:"testimonials",category:"testimonials",variant:"grid",            headline:"What Colleagues Say",             purpose:"Manager/peer recommendations"},
      {id:"contact",   category:"cta",          variant:"split-form",       headline:"Let's Work Together",             purpose:"Contact + GitHub/LinkedIn"},
      {id:"footer",    category:"footer",       variant:"minimal-centered", headline:"",                                  purpose:"Social, email, GitHub, resume"},
    ],
  },
  {
    domain:"portfolio-designer", base:"PORTFOLIO",
    labels:["designer portfolio","ui designer","ux designer","graphic designer","brand designer","product designer","visual designer"],
    projectName:"{Name} — Designer", tagline:"Design that moves people.",
    targetAudience:"Product companies and creative agencies hiring designers",
    primaryCTA:"Start a Project", secondaryCTA:"View Work",
    assetTheme:"ui design portfolio mockup clean white minimal modern",
    avoid:["dark coding aesthetic","corporate blue"],
    designMood:"clean editorial", typography:"display", spacing:"generous",
    sectionPatch: s => [
      {id:"hero",      category:"hero",         variant:"centered",         headline:"I design experiences people love.", purpose:"Strong typographic hero"},
      {id:"work",      category:"portfolio",    variant:"filter-gallery",   headline:"Selected Work",                    purpose:"Filterable: Branding/UI/Motion"},
      {id:"about",     category:"features",     variant:"alternating",      headline:"About",                           purpose:"Philosophy, process, tools"},
      {id:"services",  category:"features",     variant:"icon-grid",        headline:"Services",                        purpose:"Branding, UI, Systems, Prototyping"},
      {id:"testimonials",category:"testimonials",variant:"featured",        headline:"Client Love",                     purpose:"Client quotes with project context"},
      {id:"contact",   category:"cta",          variant:"floating-card",    headline:"Let's Create Something Great",    purpose:"Project inquiry form"},
      {id:"footer",    category:"footer",       variant:"minimal-centered", headline:"",                                  purpose:"Dribbble, Behance, LinkedIn"},
    ],
  },
  {
    domain:"influencer-creator", base:"PORTFOLIO",
    labels:["influencer","content creator","youtuber","tiktoker","instagrammer","social media influencer","brand ambassador","personal brand"],
    projectName:"{Name}", tagline:"Authentic Content. Real Influence.",
    targetAudience:"Brands seeking influencer partnerships and collaborations",
    primaryCTA:"Work With Me", secondaryCTA:"View Content",
    assetTheme:"content creator lifestyle social media photography vibrant modern",
    avoid:["corporate formal aesthetic","dark tech look"],
    designMood:"vibrant modern",
    copyTone:"Personal, authentic, and energetic. Community-first language.",
  },

  // ── E-COMMERCE VERTICALS ──────────────────────────────────────────────
  {
    domain:"electronics", base:"ECOMMERCE",
    labels:["electronics","tech products","gadgets","smartphones","laptops","headphones","smart home","consumer electronics"],
    projectName:"{Brand}", tagline:"Technology, Simplified.",
    targetAudience:"Tech-savvy consumers and early adopters",
    primaryCTA:"Shop Now", secondaryCTA:"View Deals",
    assetTheme:"electronics product photography clean white studio modern",
    avoid:["lifestyle fashion photography","dark luxury"],
    designMood:"clean tech minimal",
  },
  {
    domain:"pet-shop", base:"ECOMMERCE",
    labels:["pet shop","pet store","pet supplies","dog food","cat food","pet accessories","animal supplies","veterinary products"],
    projectName:"{Brand} Pet Shop", tagline:"Everything Your Pet Deserves.",
    targetAudience:"Pet owners seeking quality supplies and products",
    primaryCTA:"Shop for Your Pet", secondaryCTA:"View Categories",
    assetTheme:"pet shop animals dogs cats cute happy photography",
    avoid:["dark moody aesthetic","luxury brand look"],
    designMood:"warm friendly", colorHint:"#F59E0B",
    copyTone:"Warm and enthusiastic. Pet-parent language. Celebrate the joy of pets.",
  },
  {
    domain:"sports-equipment", base:"ECOMMERCE",
    labels:["sports equipment","sporting goods","gym equipment","outdoor gear","fitness equipment","sports shop","athletic gear"],
    projectName:"{Brand} Sport", tagline:"Gear Up. Perform Better.",
    targetAudience:"Athletes and sports enthusiasts",
    primaryCTA:"Shop Equipment", secondaryCTA:"Find Your Sport",
    assetTheme:"sports equipment fitness outdoor action photography bold",
    avoid:["spa wellness aesthetic","luxury fashion photography"],
    designMood:"bold energetic",
  },

  // ── LOGISTICS & OPERATIONS ────────────────────────────────────────────
  {
    domain:"logistics", base:"PROFESSIONAL",
    labels:["logistics","freight","shipping","supply chain","warehouse","3pl","courier","delivery service","haulage","transport company"],
    projectName:"{Brand} Logistics", tagline:"On Time. Every Time.",
    targetAudience:"Businesses needing reliable logistics and freight services",
    primaryCTA:"Get a Quote", secondaryCTA:"Track Shipment",
    assetTheme:"logistics warehouse trucks freight professional modern",
    avoid:["consumer e-commerce aesthetic","luxury imagery"],
    copyTone:"Reliable and efficient. Lead with on-time performance and network scale.",
  },
  {
    domain:"manufacturing", base:"PROFESSIONAL",
    labels:["manufacturing","factory","production","fabrication","industrial","engineering","precision engineering","contract manufacturing"],
    projectName:"{Brand} Manufacturing", tagline:"Precision Engineered.",
    targetAudience:"B2B buyers and procurement teams",
    primaryCTA:"Request a Quote", secondaryCTA:"View Capabilities",
    assetTheme:"manufacturing factory industrial precision engineering professional",
    avoid:["consumer brand aesthetic","soft design"],
  },
  {
    domain:"agriculture", base:"PROFESSIONAL",
    labels:["farm","agriculture","farming","agri-tech","agribusiness","crop","agricultural","food production","sustainable farming"],
    projectName:"{Brand} Agricultural", tagline:"Growing the Future.",
    targetAudience:"Agricultural businesses and food producers",
    primaryCTA:"Contact Us", secondaryCTA:"Our Products",
    assetTheme:"agriculture farm field crops landscape aerial photography",
    avoid:["urban tech aesthetic","dark corporate"],
    designMood:"natural earthy", colorHint:"#16A34A",
  },

  // ── LANDING PAGES ─────────────────────────────────────────────────────
  {
    domain:"landing-page", base:"LANDING",
    labels:["landing page","waitlist","coming soon","pre-launch","product launch","opt-in","squeeze page","lead generation page"],
    projectName:"{Brand}", tagline:"Be the First to Experience {Brand}",
    targetAudience:"Early adopters and interested prospects",
    primaryCTA:"Get Early Access", secondaryCTA:"Learn More",
    assetTheme:"product launch abstract modern gradient minimal",
    avoid:["multi-section complex layout","long content pages"],
  },
  {
    domain:"app-landing", base:"LANDING",
    labels:["app landing","mobile app landing","app download","app launch","ios app","android app","mobile app promotion"],
    projectName:"{Brand} App", tagline:"Everything You Need. In Your Pocket.",
    targetAudience:"Mobile users seeking a better experience",
    primaryCTA:"Download Free", secondaryCTA:"See How It Works",
    assetTheme:"mobile app phone mockup clean modern ui",
    avoid:["desktop software aesthetic","enterprise look"],
    designMood:"clean modern", colorHint:"",
  },
];


export const DOMAIN_BLUEPRINTS: DomainKnowledge[] = COMPACT_DOMAINS.map(resolveDomain);


export function matchDomain(prompt: string, projectType: string): DomainKnowledge | null {
  const p = prompt.toLowerCase();

  for (const d of DOMAIN_BLUEPRINTS) {
    if (d.projectType !== "website" &&
        d.projectType !== "portfolio" &&
        d.projectType !== projectType) continue;
    if (d.labels.some(label => p.includes(label))) return d;
  }

  // Project-type fallbacks
  const fallbacks: Record<string, string> = {
    ecommerce:"ecommerce", saas:"saas", dashboard:"dashboard-analytics",
    landing:"landing-page", portfolio:"portfolio-designer",
  };
  if (fallbacks[projectType]) {
    return DOMAIN_BLUEPRINTS.find(d => d.domain === fallbacks[projectType]) || null;
  }

  return null;
}


export function domainKnowledgeToBluePrint(
  dk: DomainKnowledge, prompt: string, niche: NicheProfile
): DomainBlueprint {
  const brandMatch = prompt.match(/(?:called|named|brand|for)\s+["']?([A-Z][a-zA-Z\s&]{2,30})["']?/i)
    || prompt.match(/^([A-Z][a-zA-Z\s&]{2,20})\s+(?:website|store|platform|app|gym|hotel|restaurant)/i);
  const brand = brandMatch?.[1]?.trim() || niche.industry || "Premium";

  return {
    projectName:   dk.projectName.replace(/\{Brand\}|\{Name\}/g, brand),
    tagline:       dk.tagline.replace(/\{Brand\}|\{Name\}/g, brand).replace(/\{action\}/g,"work"),
    businessGoal:  dk.businessGoal,
    targetAudience:dk.targetAudience,
    sectionOrder:  dk.sections.map(s => s.id),
    sectionPurpose:Object.fromEntries(dk.sections.map(s => [s.id, s.purpose])),
    designDirectives: {
      colorMood:     dk.designMood,
      imagingStyle:  dk.assetTheme,
      typographyFeel:dk.typography,
      spacingMood:   dk.spacing,
    },
    assetTheme:    dk.assetTheme,
    primaryCTA:    dk.primaryCTA,
    secondaryCTA:  dk.secondaryCTA,
    avoidMistakes: dk.avoid,
    copyTone:      dk.copyTone,
    keyBenefits:   dk.keyBenefits,
    pricingModel:  dk.pricingModel,
  };
}


export function getSectionVariants(dk: DomainKnowledge): Record<string, { category: string; variant: string }> {
  return Object.fromEntries(dk.sections.map(s => [s.id, { category: s.category, variant: s.variant }]));
}


export interface DomainBlueprint {
  projectName:      string;   // "Prestige Car Club"
  tagline:          string;   // "Drive the Extraordinary"
  businessGoal:     string;   // "membership" | "showcase" | "lead" | "booking" | "ecommerce"
  targetAudience:   string;   // "High net-worth car enthusiasts aged 35-60"
  sectionOrder:     string[]; // ["hero","fleet","membership","experience","gallery","testimonials","faq","contact","footer"]
  sectionPurpose:   Record<string, string>; // { fleet: "Showcase premium vehicles available", membership: "Drive joining" }
  designDirectives: {
    colorMood:      string;   // "Dark luxury — black + deep charcoal + gold accents"
    imagingStyle:   string;   // "Dramatic car photography — studio lighting, low angles"
    typographyFeel: string;   // "Editorial serif headlines, clean sans body"
    spacingMood:    string;   // "Generous — luxury feels unhurried"
  };
  assetTheme:       string;   // "luxury sports cars studio photography dramatic"
  primaryCTA:       string;   // "Apply for Membership"
  secondaryCTA:     string;   // "View the Fleet"
  avoidMistakes:    string[]; // ["No stock business photos", "No perfume imagery", "No generic 'Get Started'"]
  copyTone:         string;   // "Aspirational and exclusive — speak to those who have arrived"
  keyBenefits:      string[]; // ["Curated fleet of 40+ supercars", "White-glove concierge", "Members-only events"]
  pricingModel:     string;   // "membership tiers" | "one-time" | "booking-based" | "none"
}


export async function architectBlueprint(
  userPrompt:  string,
  projectType: string,
  niche:       NicheProfile,
  kryptonGen:  (sys: string, usr: string) => Promise<{ text: string }>
): Promise<DomainBlueprint | null> {

  // ── STEP 1: Static domain knowledge lookup (instant, no AI call) ────
  // For all known industries, return the pre-built blueprint directly.
  // This guarantees: luxury car club never gets perfume imagery,
  // restaurant always gets booking CTA, SaaS always gets product screenshot hero.
  const domainKnowledge = matchDomain(userPrompt, projectType);
  if (domainKnowledge) {
    const bp = domainKnowledgeToBluePrint(domainKnowledge, userPrompt, niche);
    // Attach the original DomainKnowledge so generateComponentContent
    // can access exact variant hints per section (no re-matching needed)
    (bp as any).__domainKnowledge = domainKnowledge;
    return bp;
  }

  // ── STEP 2: Genuinely unknown domain — no static match. ─────────────
  // Previously made a SEPARATE AI call here to invent a blueprint. That
  // responsibility now belongs to generateComponentContent's master-call
  // schema (see content-generation.ts), which asks for blueprint fields
  // in the SAME request as the component content — eliminating this as
  // a second planning call. Returns null; the caller extracts blueprint
  // fields from generateComponentContent's response instead.
  return null;
}
