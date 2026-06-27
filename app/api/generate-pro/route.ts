// app/api/generate-pro/route.ts
// Krypton AI — Multi-Generator Engine
// 8 Specialized Generators: Website / Landing / App / Game / Dashboard / Tool / E-Commerce / Portfolio
// Each has its own dedicated system prompt + phase steps

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const maxDuration = 300;
export const runtime = "nodejs"; // FIX: edge→nodejs for AI calls

// ── AI Providers ─────────────────────────────────────────────────
async function callClaude(system: string, prompt: string, maxTokens = 12000): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("No Claude key");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(80000),
  });
  if (!res.ok) throw new Error(`Claude ${res.status}`);
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

async function callOpenAI(system: string, prompt: string, maxTokens = 12000): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("No OpenAI key");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4o", max_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(80000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const d = await res.json();
  return d.choices?.[0]?.message?.content || "";
}

async function callGemini(system: string, prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("No Gemini key");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: `${system}\n\n${prompt}` }] }], generationConfig: { maxOutputTokens: 14000 } }),
    signal: AbortSignal.timeout(80000),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

async function generate(system: string, prompt: string): Promise<{ text: string; provider: string }> {
  for (const [fn, name] of [[callClaude, "claude"], [callOpenAI, "openai"], [callGemini, "gemini"]] as const) {
    try {
      const text = await (fn as Function)(system, prompt);
      if (text?.trim().length > 200) return { text, provider: name };
    } catch { continue; }
  }
  throw new Error("All AI providers failed");
}

// ── HTML Cleaner ──────────────────────────────────────────────────
function cleanHTML(raw: string): string {
  let h = raw.trim();
  // Strip markdown code fences
  h = h.replace(/^```html\s*/i, "").replace(/```\s*$/i, "").trim();
  const idx = h.indexOf("<!DOCTYPE");
  if (idx > 0) h = h.substring(idx);
  // Self-close fix
  if (!h.includes("</html>") && h.includes("<html")) h += "\n</html>";
  return h;
}

// ── Credit Cost ───────────────────────────────────────────────────
function creditCost(type: string): number {
  const costs: Record<string, number> = {
    website: 3, landing: 2, app: 3, game: 4,
    dashboard: 4, tool: 2, ecommerce: 4, portfolio: 2,
  };
  return costs[type] ?? 3;
}

// ── 8 Specialized System Prompts ─────────────────────────────────

const BASE_RULES = `
## 🚨 CRITICAL OUTPUT RULES — NEVER BREAK:
1. Start with EXACTLY: <!DOCTYPE html>
2. End with EXACTLY: </html>
3. Zero markdown, zero backticks, zero explanations
4. ALL CSS inside <style> in <head>
5. ALL JS inside <script> before </body>
6. ALL text content in ENGLISH (understand any language, output English)
7. Minimum 700 lines of complete, working code
8. ZERO placeholder text, ZERO "Lorem ipsum", ZERO "Coming soon", ZERO "TODO"
9. Every button, tab, accordion, modal MUST be functional
10. Mobile responsive: 320px → 768px → 1280px → 1920px

## 🎨 MANDATORY DESIGN SYSTEM:
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --primary: #FFD700; --primary-2: #FF7A00;
  --bg: #050505; --surface: #0D0D0D; --card: #111111;
  --border: rgba(255,215,0,0.1); --border-2: rgba(255,255,255,0.08);
  --text: #FFFFFF; --text-2: #94A3B8; --text-3: #64748B;
  --grad: linear-gradient(135deg,#FFD700,#FF7A00);
  --success: #10B981; --error: #EF4444; --info: #3B82F6;
}

- Headings: font-family:'Syne',sans-serif; font-weight:800; letter-spacing:-0.02em
- Body: font-family:'DM Sans',sans-serif; font-weight:400; line-height:1.7
- Code/mono: font-family:'JetBrains Mono',monospace
- Typography scale: clamp() everywhere for fluid sizing
- 8px grid: 8/16/24/32/40/48/64/80/96/128px only
- Container: max-width:1280px; margin:0 auto; padding:0 clamp(20px,4vw,64px)
- All transitions: 0.25s ease on every interactive element
- IntersectionObserver scroll animations on ALL sections
- Every button: transform:translateY(-2px) + glow on hover
- Every card: transform:translateY(-6px) + border glow on hover
- cursor:pointer on all clickable elements
`;

const GENERATORS: Record<string, string> = {

  website: `${BASE_RULES}

## 🌐 WEBSITE GENERATOR — MANDATORY SECTIONS (in this order):

1. **NAVBAR** (sticky, backdrop-blur:20px, logo + 5 nav links + CTA button, hamburger menu mobile):
   - Logo: gradient text "Brand", font Syne 800
   - Links: smooth scroll to sections, active state
   - CTA: gradient button (#FFD700→#FF7A00)
   - Mobile: hamburger icon → full-height menu overlay

2. **HERO** (min-height:100vh, animated gradient background):
   - Animated gradient: background-size:400% + keyframe animation
   - Badge: "🚀 Now in Beta" pill with border glow
   - H1: clamp(40px,6vw,96px), Syne 800, gradient text for key word
   - Subheading: DM Sans 400, color:var(--text-2), max-width:600px
   - TWO CTA buttons (primary gradient + secondary outline)
   - Social proof: 5 avatar circles (overlapping) + star rating + "Join 10,000+ users"
   - Floating card element with glassmorphism effect

3. **MARQUEE** (infinite-scroll of logos/features using CSS animation):
   - 8+ items, left-to-right continuous scroll, pauses on hover

4. **FEATURES** (3-column grid on desktop, 1-col mobile):
   - 6 feature cards each with: gradient icon box, h3, description
   - Cards: background:var(--card), border:1px solid var(--border-2)
   - Hover: translateY(-6px), border-color:rgba(255,215,0,0.3), box-shadow glow

5. **HOW IT WORKS** (3 numbered steps with connecting dotted line):
   - Large gradient number badges, step title, description
   - Center alignment, connecting line between steps

6. **SHOWCASE** (product/service visual):
   - Browser mockup or device frame containing a screenshot-style preview
   - Gradient border, inner glow

7. **TESTIMONIALS** (3 cards in a grid):
   - Each: avatar placeholder (gradient circle), name, role/company, star rating (5 stars), quote
   - Cards glassmorphism style

8. **PRICING** (3 plans: Free/Pro/Business):
   - Monthly/Yearly toggle (JS, yearly = 20% discount badge)
   - Pro plan: featured with gradient border + "Most Popular" badge
   - Each plan: price, feature list with ✓ icons, CTA button

9. **FAQ** (accordion, 7+ questions):
   - Click to expand/collapse with smooth height animation (max-height transition)
   - + / × icon toggle

10. **FINAL CTA** (full-width gradient section):
    - Large headline, subtext, primary button + secondary text link

11. **FOOTER** (4-column grid):
    - Logo + tagline, Links col 1, Links col 2, Social icons (GitHub/Twitter/Discord)
    - Copyright bar with separator line
`,

  landing: `${BASE_RULES}

## 🎯 LANDING PAGE GENERATOR — Conversion-Optimized:

Build a high-converting single-page marketing site.

**MANDATORY SECTIONS:**

1. **NAVBAR**: Logo + 3-4 links + CTA button (sticky, blur on scroll)

2. **HERO** (100vh):
   - Power headline (large, bold, Syne 800)
   - Benefit-focused subheadline
   - Primary CTA (gradient) + Secondary CTA (text with →)
   - Trust badge: "No credit card required • Free forever • Cancel anytime"
   - Hero image/mockup area (browser frame or phone mockup)

3. **SOCIAL PROOF BAR**: Company logos "Trusted by teams at..." (marquee)

4. **PROBLEM SECTION**: "Still dealing with X?" — 3 pain point cards with 😤 emoji icons

5. **SOLUTION SECTION**: "Meet [Product]" — 3 benefit cards with ✨ icons, gradient accent

6. **FEATURES DEEP DIVE**: 2-3 alternating text+visual rows (left text / right mock, then flip)

7. **HOW IT WORKS**: 3 steps numbered, with connecting arrow/line

8. **TESTIMONIALS**: 2-3 quote cards with avatar + name + company + stars

9. **SINGLE PRICING**: 1 featured plan OR free vs paid comparison

10. **FINAL CTA SECTION**: Big headline "Ready to get started?" + button + guarantee text

11. **FOOTER**: Minimal — logo + links + copyright
`,

  app: `${BASE_RULES}

## 📱 APP GENERATOR — Full-Featured Web Application:

Build a complete, functional web app with real interactivity.

**MANDATORY ARCHITECTURE:**

1. **APP SHELL**:
   - Left sidebar: logo + nav items with icons (active state highlighted)
   - Top header: breadcrumb + search bar + user avatar + notification bell
   - Main content area with responsive layout
   - Mobile: bottom tab bar (4 tabs), hidden sidebar

2. **CORE FEATURES** (based on the user's request):
   - Primary feature with full CRUD operations (Create/Read/Update/Delete)
   - Data stored in localStorage for persistence
   - Form with validation (required fields, email format, etc.)
   - Success/error toast notifications (slide in from top-right)

3. **DATA DISPLAY**:
   - Cards grid OR list view with toggle
   - Each item: relevant info + action buttons (edit/delete)
   - Empty state: illustration + "No items yet" message + CTA button

4. **SEARCH & FILTER**:
   - Live search (filters as you type)
   - Filter by category/status dropdown
   - Sort options (newest, oldest, alphabetical)

5. **MODALS**:
   - Add/Edit modal with form
   - Confirmation modal for destructive actions
   - Backdrop blur, slide-in animation

6. **STATS/OVERVIEW**:
   - 4 KPI cards at top: total items, active, completed, this week
   - Progress bars or mini charts using pure CSS/JS

7. **SETTINGS PAGE** (basic):
   - Theme toggle (dark/light)
   - Export data (JSON download)
   - Clear all data (with confirmation)
`,

  game: `${BASE_RULES}

## 🎮 GAME GENERATOR — Fully Playable Browser Game:

Build a COMPLETE, immediately playable browser game. NOT a demo. NOT a prototype.

**MANDATORY GAME ARCHITECTURE:**

\`\`\`
const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
window.addEventListener("resize", () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
let state = "menu"; // menu | playing | paused | gameover
let score = 0, level = 1, lives = 3, highScore = parseInt(localStorage.getItem("hs")||"0");
function gameLoop() { update(); render(); requestAnimationFrame(gameLoop); }
window.onload = () => gameLoop();
\`\`\`

**REQUIRED SYSTEMS (ALL mandatory):**
1. **GAMEPLAY**: Smooth movement, collision detection, real game mechanics
2. **PROGRESSION**: Levels 1-∞, difficulty increases (speed/quantity/complexity)
3. **SCORING**: Live score on canvas, high score (localStorage), combo multiplier
4. **LIVES**: 3 lives, respawn animation, invincibility frames
5. **POWERUPS**: 3+ types spawning randomly (speed, shield, multiplier, health)
6. **AUDIO**: Web Audio API — coin collect beep, death sound, level-up fanfare
7. **PARTICLES**: Burst particles on collect, death, level-up (CSS or canvas)
8. **ACHIEVEMENTS**: 5 achievements with localStorage persistence, popup notification

**HUD DESIGN** (on canvas overlay OR HTML overlay):
- Top-left: Score + High Score
- Top-center: Level badge
- Top-right: Lives (♥ hearts)
- Glassmorphism style HUD bars

**SCREENS:**
- MENU: Game title (neon glow), instructions, Start button, High Score display
- PLAYING: Full game, HUD active
- PAUSE: Overlay with Resume/Restart/Menu buttons
- GAME OVER: Score, New High Score detection, Restart button

**MOBILE CONTROLS** (MANDATORY):
- D-pad (← ↑ ↓ →) bottom-left, 60px buttons, touch events
- Action button (A/JUMP/SHOOT) bottom-right
- All touch targets 60px minimum

**VISUAL STYLE:**
- Dark background with gradient or star field
- Neon accent colors (#00FFFF, #FF00FF, #FFD700) 
- Canvas: anti-aliased graphics, smooth animations
- Particle effects for all major events

**SPECIFIC GAME MECHANICS (detect from prompt):**
- Snake: grid-based, growing snake, walls/self kill, fruit spawning
- Tetris: piece rotation, line clearing, hold queue, ghost piece, T-spin
- Platformer: gravity physics, platforms, enemy patrol AI, coin collecting
- Space Shooter: scrolling bg, enemy waves, bullet patterns, boss fights
- Puzzle: drag-and-drop or click mechanics, win condition detection
- Racing: track rendering, obstacle avoidance, speed/drift mechanics
`,

  dashboard: `${BASE_RULES}

## 📊 DASHBOARD GENERATOR — Premium Analytics Panel:

Build a complete admin/analytics dashboard.

**MANDATORY LAYOUT:**

1. **LEFT SIDEBAR** (260px fixed, collapsible on mobile):
   - Logo at top with gradient icon
   - Nav sections: Main (Dashboard, Analytics, Reports), Management (Users, Projects, Settings)
   - Each nav item: icon (emoji or SVG) + label + active state (gradient left border)
   - User profile at bottom: avatar + name + role + status dot
   - Collapse button for mobile

2. **TOP BAR**:
   - Page title + breadcrumb
   - Search bar (expandable)
   - Notification bell (badge count)
   - Date range picker (display only)
   - User avatar + dropdown

3. **KPI CARDS** (4 cards in grid):
   - Total Revenue: big number + % change + sparkline
   - Active Users: number + trend arrow
   - Conversion Rate: % + bar
   - Avg Session: time + change
   - Each card: gradient icon box + colored change indicator (green/red)

4. **CHARTS** (using Chart.js from CDN: https://cdn.jsdelivr.net/npm/chart.js):
   - Line chart: 30-day revenue trend (gradient fill under line)
   - Bar chart: weekly user activity (7 bars)
   - Doughnut chart: traffic sources (4 sources)
   - All charts: dark themed, tooltips, animations

5. **DATA TABLE**:
   - Columns: Avatar+Name, Email, Plan, Status, Revenue, Date, Actions
   - 8-10 rows of realistic data
   - Sort by column headers (click → arrow indicator)
   - Status badges: Active (green), Pending (yellow), Inactive (red)
   - Actions: Edit (pencil) + Delete (trash) icons

6. **ACTIVITY FEED** (right panel or below):
   - Recent events with timestamp: "User signed up", "Payment received", etc.
   - Each: colored dot indicator + event text + relative time

7. **QUICK ACTIONS**:
   - 4 action buttons: New Report, Export CSV, Send Email, Add User

8. **RESPONSIVE**:
   - Mobile: sidebar hidden, hamburger menu, cards stack vertically
   - Tablet: sidebar collapsed (icons only)
`,

  tool: `${BASE_RULES}

## 🔧 TOOL GENERATOR — Interactive Web Tool:

Build a complete, fully functional productivity tool.

**MANDATORY ELEMENTS:**

1. **CLEAN HEADER**:
   - Tool name + icon + short description
   - How-to-use instructions (collapsible)

2. **MAIN TOOL INTERFACE**:
   - Primary input area (text area, form, upload zone — based on tool type)
   - Clear, prominent action button (gradient)
   - Output/result display area
   - Copy result button with "Copied!" feedback

3. **TOOL-SPECIFIC FEATURES** (implement ALL relevant to the tool type):
   - Settings/options panel (sidebar or collapsible)
   - Presets or templates for quick start
   - History of recent results (localStorage, last 10)
   - Export options (copy, download TXT/JSON)
   - Character/word count or relevant metrics

4. **EXAMPLES SECTION**:
   - 3-5 clickable example inputs
   - Click to auto-fill and generate

5. **KEYBOARD SHORTCUTS**:
   - Ctrl+Enter to submit
   - Ctrl+C to copy result
   - Escape to clear
   - Visible shortcut hints in UI

6. **RESULT DISPLAY**:
   - Formatted output with syntax highlighting if code
   - Line numbers if multi-line
   - Comparison view (before/after) if transform tool

7. **FOOTER**:
   - "Built with Krypton AI" + tips
`,

  ecommerce: `${BASE_RULES}

## 🛒 E-COMMERCE GENERATOR — Complete Online Store:

Build a full-featured e-commerce store.

**MANDATORY SECTIONS:**

1. **HEADER**:
   - Logo + search bar (live filter) + cart icon (animated count badge) + user icon
   - Top announcement bar: "Free shipping on orders over $50 🚚"
   - Category nav below header: All / Clothing / Electronics / Home / Sports

2. **HERO BANNER**:
   - Full-width promotional banner with headline + CTA
   - Animated gradient background or image placeholder

3. **PRODUCT GRID**:
   - 8-12 product cards in responsive grid (4 col → 2 col → 1 col)
   - Each card: image placeholder (colored gradient), product name, category tag, price, original price (strikethrough), discount badge, star rating (★★★★★), review count, "Add to Cart" button
   - Quick View overlay on hover (shows name, price, size selector, Add button)
   - Wishlist heart icon (toggle, localStorage)

4. **FILTER SIDEBAR**:
   - Categories (checkboxes with count)
   - Price range slider (custom CSS)
   - Rating filter
   - In Stock toggle
   - Sort: Featured / Price Low-High / Price High-Low / Newest / Best Rated
   - Clear filters button

5. **CART DRAWER** (slides from right, overlay):
   - Cart items: image + name + variant + quantity controls (−/+) + remove button
   - Subtotal, shipping estimate, taxes
   - Promo code input
   - Checkout button (gradient)
   - Continue shopping link
   - Empty cart state with CTA

6. **PRODUCT CATEGORIES** (tab or scroll):
   - Featured / New Arrivals / Best Sellers / Sale tabs
   - Horizontal scroll on mobile

7. **TRUST SIGNALS**:
   - 4 badges: Free Shipping / Secure Checkout / Easy Returns / 24/7 Support

8. **FOOTER**:
   - Newsletter signup
   - Links: Shop, Company, Support, Legal
   - Payment icons, copyright
`,

  portfolio: `${BASE_RULES}

## 💼 PORTFOLIO GENERATOR — Premium Personal/Agency Portfolio:

Build a stunning portfolio website.

**MANDATORY SECTIONS:**

1. **NAVBAR**: Name/logo + smooth scroll links (Work/About/Skills/Contact) + "Hire Me" CTA

2. **HERO** (100vh):
   - Greeting: "Hello, I'm" in small text
   - Name: Large Syne 800 with gradient on surname
   - Role: Typing animation cycling through 3 roles ("Developer", "Designer", "Creator")
   - Short bio (1-2 sentences)
   - TWO buttons: "View My Work" + "Download CV"
   - Social links: GitHub, LinkedIn, Twitter, Dribbble icons
   - Floating animated shapes or particle background
   - Scroll indicator (bouncing arrow)

3. **ABOUT SECTION**:
   - Two columns: bio text + avatar placeholder
   - Years of experience, projects completed, happy clients (animated counters on scroll)
   - Fun fact or personal tagline

4. **SKILLS SECTION**:
   - Skill tags in a flex-wrap grid (colored pills)
   - OR skill bars with animated fill on scroll
   - Grouped by: Frontend / Backend / Tools / Design

5. **PROJECTS SECTION** (6 cards in grid):
   - Each: gradient image placeholder, project name, tech stack tags, brief description
   - Hover overlay: "View Project" + "GitHub" buttons
   - Filter tabs: All / Web / Mobile / Design
   - Featured project: extra large card spanning 2 columns

6. **EXPERIENCE TIMELINE**:
   - Vertical timeline with left/right alternating cards
   - Each: Company, Role, Duration, 2-3 bullet points
   - Dot on timeline with company initial

7. **TESTIMONIALS** (2-3 cards):
   - Client photo placeholder, name, company, quote in italic

8. **CONTACT SECTION**:
   - Left: Contact info (email, phone, location with icons)
   - Right: Contact form (name, email, subject, message, Send button)
   - Form shows success message on submit (no backend needed)
   - Social links

9. **FOOTER**: Copyright + back to top button
`,
};

// ── Phase Steps Per Generator ────────────────────────────────────
const PHASES: Record<string, Array<{ icon: string; action: string }>> = {
  website:   [
    { icon: "🔍", action: "Analyzing your website requirements..." },
    { icon: "🧠", action: "Planning 11-section architecture..." },
    { icon: "🎨", action: "Designing premium UI system..." },
    { icon: "⚙️", action: "Building navbar & hero section..." },
    { icon: "📦", action: "Crafting features & showcase..." },
    { icon: "💬", action: "Adding testimonials & pricing..." },
    { icon: "📱", action: "Optimizing mobile responsiveness..." },
    { icon: "✨", action: "Applying animations & interactions..." },
    { icon: "🚀", action: "Finalizing CTAs & footer..." },
    { icon: "✅", action: "Website build complete!" },
  ],
  landing:   [
    { icon: "🔍", action: "Analyzing conversion goals..." },
    { icon: "🧠", action: "Planning persuasion architecture..." },
    { icon: "🎨", action: "Designing hero section..." },
    { icon: "⚙️", action: "Building problem/solution sections..." },
    { icon: "💎", action: "Crafting social proof & testimonials..." },
    { icon: "📱", action: "Optimizing for mobile conversions..." },
    { icon: "✨", action: "Adding micro-animations..." },
    { icon: "🚀", action: "Finalizing CTAs & copy..." },
    { icon: "✅", action: "Landing page complete!" },
  ],
  app:       [
    { icon: "🔍", action: "Analyzing app requirements..." },
    { icon: "🧠", action: "Designing component architecture..." },
    { icon: "⚙️", action: "Building app shell & navigation..." },
    { icon: "💾", action: "Implementing CRUD operations..." },
    { icon: "🔄", action: "Adding search, filter & sort..." },
    { icon: "📱", action: "Optimizing mobile layout..." },
    { icon: "✨", action: "Adding modals & notifications..." },
    { icon: "🧪", action: "Validating all interactions..." },
    { icon: "✅", action: "App build complete!" },
  ],
  game:      [
    { icon: "🎮", action: "Detecting game genre & mechanics..." },
    { icon: "🧠", action: "Designing game loop architecture..." },
    { icon: "🗺️", action: "Planning levels & progression..." },
    { icon: "⚙️", action: "Engineering core game engine..." },
    { icon: "🎯", action: "Building player controls & physics..." },
    { icon: "👾", action: "Creating enemies & obstacles..." },
    { icon: "🎨", action: "Designing HUD & game UI..." },
    { icon: "✨", action: "Adding particles & effects..." },
    { icon: "🔊", action: "Wiring audio & input events..." },
    { icon: "✅", action: "Game build complete!" },
  ],
  dashboard: [
    { icon: "🔍", action: "Analyzing dashboard requirements..." },
    { icon: "🧠", action: "Planning layout & data structure..." },
    { icon: "⚙️", action: "Building sidebar & navigation..." },
    { icon: "📊", action: "Creating KPI cards & metrics..." },
    { icon: "📈", action: "Integrating Chart.js visualizations..." },
    { icon: "📋", action: "Building data tables & sorting..." },
    { icon: "📱", action: "Optimizing responsive layout..." },
    { icon: "✨", action: "Adding animations & interactions..." },
    { icon: "✅", action: "Dashboard build complete!" },
  ],
  tool:      [
    { icon: "🔍", action: "Understanding tool requirements..." },
    { icon: "🧠", action: "Designing tool interface..." },
    { icon: "⚙️", action: "Building core tool functionality..." },
    { icon: "💾", action: "Adding history & export features..." },
    { icon: "📱", action: "Optimizing for mobile use..." },
    { icon: "✨", action: "Adding keyboard shortcuts & UX..." },
    { icon: "✅", action: "Tool build complete!" },
  ],
  ecommerce: [
    { icon: "🛍️", action: "Analyzing store requirements..." },
    { icon: "🧠", action: "Planning product architecture..." },
    { icon: "🎨", action: "Designing product cards & grid..." },
    { icon: "🛒", action: "Engineering cart & state system..." },
    { icon: "🔍", action: "Adding search, filter & sort..." },
    { icon: "💳", action: "Building checkout flow..." },
    { icon: "📱", action: "Optimizing mobile experience..." },
    { icon: "✨", action: "Adding hover effects & animations..." },
    { icon: "✅", action: "Store build complete!" },
  ],
  portfolio: [
    { icon: "💼", action: "Analyzing portfolio requirements..." },
    { icon: "🧠", action: "Planning personal brand architecture..." },
    { icon: "🎨", action: "Designing hero & about sections..." },
    { icon: "🖼️", action: "Building projects showcase..." },
    { icon: "⏱️", action: "Creating experience timeline..." },
    { icon: "📱", action: "Optimizing mobile layout..." },
    { icon: "✨", action: "Adding scroll animations & effects..." },
    { icon: "✅", action: "Portfolio build complete!" },
  ],
};

// ── Project Type Detector ─────────────────────────────────────────
function detectType(prompt: string, requestedType?: string): string {
  if (requestedType && GENERATORS[requestedType]) return requestedType;
  const p = prompt.toLowerCase();
  if (/\bgame\b|\bsnake\b|\btetris\b|\bpuzzle\b|\barcade\b|\bplatform\b|\bshooter\b/.test(p)) return "game";
  if (/\bshop\b|\bstore\b|\becommerce\b|\bcart\b|\bmarketplace\b|\bproduct catalog\b/.test(p)) return "ecommerce";
  if (/\bdashboard\b|\badmin panel\b|\banalytics\b|\bcrm\b|\bcontrol panel\b/.test(p)) return "dashboard";
  if (/\bportfolio\b|\bpersonal site\b|\bmy work\b|\bfreelance\b/.test(p)) return "portfolio";
  if (/\blanding page\b|\bconversion\b|\bwaitlist\b|\bleads\b/.test(p)) return "landing";
  if (/\btool\b|\bconverter\b|\bgenerator\b|\bcalculator\b|\bchecker\b|\bformatter\b/.test(p)) return "tool";
  if (/\bapp\b|\btracker\b|\bmanager\b|\bplanner\b|\borganizer\b|\bcrm\b/.test(p)) return "app";
  return "website";
}

// ── Main Handler ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let body: any = {};
  try { body = await req.json(); } catch {}

  const { prompt, type: requestedType, userId, accessToken } = body;

  if (!prompt?.trim()) {
    return NextResponse.json({ error: "Prompt required" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Auth
  let uid = userId;
  if (accessToken) {
    const { data: { user } } = await supabase.auth.getUser(accessToken);
    uid = user?.id || userId;
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: object) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {}
      };
      const finish = () => {
        if (closed) return;
        closed = true;
        try { controller.close(); } catch {}
      };

      try {
        // ── Credit Check ─────────────────────────────────────────
        if (uid) {
          const { data: pc } = await supabase.from("profiles")
            .select("total_credits, used_credits, plan, daily_reset_date")
            .eq("id", uid).single();

          if (pc) {
            const today = new Date().toISOString().split("T")[0];
            if (pc.plan === "free" && pc.daily_reset_date !== today) {
              await supabase.from("profiles").update({ used_credits: 0, daily_reset_date: today }).eq("id", uid);
              pc.used_credits = 0;
            }
            const rem = (pc.total_credits || 5) - (pc.used_credits || 0);
            if (rem < 1) {
              send("error", { message: "No credits remaining. Free plan resets daily.", code: "NO_CREDITS" });
              finish(); return;
            }
          }
        }

        // ── Detect Type ───────────────────────────────────────────
        const type = detectType(prompt, requestedType);
        const phases = PHASES[type] || PHASES.website;
        const systemPrompt = GENERATORS[type] || GENERATORS.website;
        const cost = creditCost(type);

        send("meta", { type, cost });

        // ── Stream Phases ─────────────────────────────────────────
        for (let i = 0; i < phases.length - 1; i++) {
          send("phase", {
            agent: `Step ${i + 1}`,
            icon: phases[i].icon,
            action: phases[i].action,
            pct: Math.round(((i + 1) / phases.length) * 85),
            done: false,
          });
          await new Promise(r => setTimeout(r, 600));
        }

        // ── Generate ──────────────────────────────────────────────
        send("phase", { agent: "Generating", icon: "⚡", action: "AI is building your project...", pct: 90, done: false });

        const { text: rawHTML, provider } = await generate(systemPrompt, prompt);
        const html = cleanHTML(rawHTML);

        if (!html.includes("<!DOCTYPE") || html.length < 500) {
          send("error", { message: "Generation failed. Please try again.", code: "BAD_OUTPUT" });
          finish(); return;
        }

        // ── Deduct Credits ────────────────────────────────────────
        let savedProjectId: string | null = null;
        if (uid) {
          try {
            const { error: rpcError } = await supabase.rpc("deduct_credits", { user_id: uid, amount: cost });
            if (rpcError) {
              const { data: pc2 } = await supabase.from("profiles").select("used_credits").eq("id", uid).single();
              await supabase.from("profiles").update({ used_credits: (pc2?.used_credits || 0) + cost }).eq("id", uid);
            }
          } catch {
            const { data: pc2 } = await supabase.from("profiles").select("used_credits").eq("id", uid).single();
            await supabase.from("profiles").update({ used_credits: (pc2?.used_credits || 0) + cost }).eq("id", uid);
          }

          // Save project
          try {
            const { data: proj } = await supabase.from("projects").insert({
              user_id: uid,
              title: prompt.slice(0, 60),
              name: prompt.slice(0, 60),
              prompt,
              html_code: html,
              status: "completed",
              project_type: type,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).select("id").single();
            savedProjectId = proj?.id || null;
          } catch {}
        }

        // ── Final Phase ───────────────────────────────────────────
        const lastPhase = phases[phases.length - 1];
        send("phase", { agent: "Done", icon: lastPhase.icon, action: lastPhase.action, pct: 100, done: true });

        send("complete", {
          html,
          projectId: savedProjectId,
          creditsUsed: cost,
          provider,
          type,
          canSave: true,
        });

      } catch (err: any) {
        console.error("[generate-pro]", err);
        send("error", { message: "Something went wrong. Please try again.", code: "FATAL" });
      } finally {
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    },
  });
}
