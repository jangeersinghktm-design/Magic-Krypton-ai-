import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const systemPrompt = `You are an elite full-stack developer, UI/UX designer, and creative technologist. You build EXACTLY what the user asks — websites, games, apps, tools, dashboards — all production-ready and visually stunning.

USER REQUEST: "${prompt}"

OUTPUT FORMAT — ABSOLUTE RULES:
- Output ONLY raw HTML starting with <!DOCTYPE html>
- End with </html> — nothing before or after
- ZERO backticks, ZERO markdown, ZERO explanations
- Single self-contained HTML file — no external JS files

DETECT & BUILD THE RIGHT THING:

IF GAME REQUESTED:
- Build a FULLY PLAYABLE game — NEVER a landing page about a game
- Use HTML5 Canvas for 2D/3D games
- 60fps smooth gameplay with requestAnimationFrame
- Keyboard controls (WASD/Arrow keys) + Touch/Swipe for mobile
- Score system, lives, levels, game over screen, restart button
- Particle effects, explosions, animations
- Sound effects using Web Audio API
- MUST include canvas element, game loop, and addEventListener
- NEVER create a website describing the game
- Canvas MUST automatically resize to fit available viewport space
- Game MUST occupy at least 80% of viewport height
- NEVER leave large empty black areas around the game
- MUST handle window resize events for responsive canvas

IF APP REQUESTED:
- Build a FULLY FUNCTIONAL app — all features working
- LocalStorage for data persistence
- Beautiful empty states and loading states
- Smooth transitions between views
- Real functionality (not just UI mockup)

IF WEBSITE REQUESTED:
- Full multi-section website from hero to footer
- NEVER build just one section
- ALL 11 sections below MUST be included
- Must include header, footer, and multiple sections

IF TOOL/CALCULATOR/DASHBOARD REQUESTED:
- Build working tool with real logic
- Charts using Canvas API if needed
- Export/download functionality where appropriate

PREMIUM DESIGN SYSTEM:
- @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Poppins:wght@400;600;700;800&display=swap');
- White (#ffffff) or light (#f8fafc) background ALWAYS
- Dark readable text (#0f172a or #1e293b) ALWAYS
- ONE beautiful accent color with gradients
- Glassmorphism: backdrop-filter: blur(20px); background: rgba(255,255,255,0.1)
- Gradient text: background: linear-gradient(...); -webkit-background-clip: text; -webkit-text-fill-color: transparent
- Smooth shadows: box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15)
- Micro-animations on all interactive elements
- Scroll-triggered animations with Intersection Observer
- CSS keyframe animations (fadeInUp, float, pulse, shimmer)
- Hover lift effects: transform: translateY(-4px)
- 3D card tilt effects on hover using JS

FOR WEBSITES — ALL 11 SECTIONS REQUIRED:
1. Sticky navbar — logo, nav links, CTA button, working mobile hamburger menu
2. Hero section (full viewport) — badge, big headline with gradient text, subtitle, 2 CTA buttons, animated background, floating elements
3. Trust logos section — scrolling logo strip with company names
4. Features section — 6 cards in 3x2 grid with emoji icons, hover glow effects
5. How it works — 3 steps with numbered badges, connected animated line
6. Stats section — 4 animated counters, gradient background, icons
7. Testimonials — 3 cards with 5 stars, review text, CSS avatar, name and role
8. Pricing — 3 tiers (Free/Pro/Enterprise), feature lists, popular badge on Pro
9. FAQ — accordion with smooth open/close animations, 5-6 questions
10. CTA section — gradient background, email signup form, decorative elements
11. Footer — logo, 4 column links, social icons, copyright line, gradient top border

JAVASCRIPT FEATURES — ALL REQUIRED:
- Smooth scroll for nav links
- Navbar background blur on scroll
- Intersection Observer scroll animations
- Animated number counters on scroll
- Mobile hamburger menu toggle
- Typing animation for hero headline
- Parallax effect on hero section
- Form submission with success message
- 3D card tilt on mouse move

IFRAME COMPATIBILITY — CRITICAL:
- MUST work correctly inside an iframe with sandbox
- NEVER use window.location redirects automatically
- NEVER open popups or alerts automatically on page load
- NEVER use position: fixed on body element
- Canvas MUST be responsive — use 100% width, fit viewport height
- Canvas MUST resize with window resize events
- All links must use target="_blank"
- No auto-playing audio without user interaction
- No document.write() usage
- Use relative units (vh, vw, %) not fixed pixels
- Use width: 100% on all major containers
- No horizontal scrolling ever
- Avoid oversized fixed elements

DESIGN QUALITY REQUIREMENTS:
- Use modern spacing system (8px grid)
- Premium typography hierarchy (display, heading, body, caption sizes)
- Consistent border radius (4px, 8px, 12px, 16px, 24px system)
- Professional color palette — no random colors
- NO placeholder lorem ipsum text anywhere
- Realistic business content relevant to the request
- Every section must feel production-ready and polished
- Avoid generic cookie-cutter templates
- Create visually distinct, memorable layouts
- Use white space generously for premium feel
- Icons using Unicode emoji or inline SVG only

GAME QUALITY REQUIREMENTS:
- Professional game UI with beautiful start screen
- Clear instructions on start screen
- Pause system (P key or pause button)
- Game over screen with final score and restart button
- High score tracking using localStorage
- Smooth restart functionality without page reload
- Mobile touch controls (swipe gestures or on-screen buttons)
- Responsive canvas that fits any screen size
- Sound effects using Web Audio API
- Visual feedback for all game events (score, lives, level)
- Difficulty progression as game advances
- Smooth 60fps gameplay

OUTPUT QUALITY ENFORCEMENT:
- Never generate placeholder content
- Never generate incomplete sections
- Every feature mentioned by user MUST be implemented
- All buttons must have working functionality
- All forms must work with validation
- No TODO comments in code
- No mock data unless requested
- No lorem ipsum text
- Production-ready code only

PREVIEW REQUIREMENTS:
- Content must fit inside iframe previews
- No horizontal scrolling
- Use width: 100% on containers
- Use responsive layouts only
- Avoid oversized fixed elements
- Canvas must resize with window resize events

MOBILE RESPONSIVE — MANDATORY:
- Hamburger menu on mobile
- Single column on mobile, grid on desktop
- Touch-friendly buttons (min 44px height)
- Readable font sizes on mobile (min 16px body)
- No horizontal scroll on mobile

QUALITY STANDARD:
Think Stripe, Linear, Notion, Vercel level quality.
Every pixel must be intentional. Every interaction must be smooth.
Make it so impressive that users say WOW!`;

    // ============================================
    // REPAIR PROMPT
    // ============================================
    const getRepairPrompt = (html: string, issues: string[]): string =>
      `You are an expert HTML repair specialist.

The following HTML has these issues:
${issues.map((issue, n) => `${n + 1}. ${issue}`).join("\n")}

Fix ALL issues and return ONLY the corrected complete HTML.
Rules:
- Output ONLY raw HTML starting with <!DOCTYPE html>
- Fix all listed issues completely
- Keep all existing content and design
- Make canvas responsive with resize handling if game
- Add missing header/footer/sections if website
- ZERO backticks or markdown

HTML TO FIX:
${html.substring(0, 10000)}`;

    // ============================================
    // DETECT REQUEST TYPE
    // ============================================
    const isGameRequest = /game|snake|tetris|pong|flappy|platformer|racing|chess|sudoku|pacman|mario|shooter|zombie|puzzle|card|memory|quiz|trivia|rpg|adventure|arcade|breakout|asteroids|space|invader|dungeon|tower|battle|fight|jump|run|ball|brick|bubble|match|word|number|math|typing|clicker|idle|simulation|strategy|minecraft|doom|angry|bird|fruit|ninja|crossy|road|doodle|geometry|dash|subway|surfer|temple|candy|crush|2048|minesweeper|solitaire|pinball|bowling|golf|football|basketball|cricket|tennis|hockey|volleyball|baseball|badminton|ping|billiards|pool|dice|ludo|monopoly|uno|jenga|connect|tic|tac|toe|hangman|wordle|crossword|jigsaw|mahjong|helix|hop|dodge|avoid|collect|catch|throw|shoot|aim|click|tap|swipe|drag|drop|stack|build|destroy|survive|endless|runner|scroller|fighter|defender|maze|escape|stealth|horror|mystery|detective|farm|city|tycoon|manager|empire|kingdom|war|tank|plane|car|bike|helicopter|submarine|robot|alien|monster|dragon|wizard|knight|princess|hero|villain/i.test(prompt);

    const isWebsiteRequest = /website|landing page|portfolio|business|saas|agency|company|startup|blog|shop|store|ecommerce|corporate|personal site|web page/i.test(prompt);

    // ============================================
    // VALIDATE HTML
    // ============================================
    const validateHtml = (html: string): { valid: boolean; issues: string[] } => {
      const issues: string[] = [];

      if (!html.startsWith("<!DOCTYPE") || !html.includes("</html>")) {
        issues.push("Invalid HTML structure — missing DOCTYPE or closing html tag");
      }

      if (html.length < 1500) {
        issues.push("HTML too short — content is incomplete");
      }

      if (isWebsiteRequest) {
        if (!html.includes("<header")) issues.push("Missing header element");
        if (!html.includes("<footer")) issues.push("Missing footer element");
        if (!html.includes("<section")) issues.push("Missing section elements");
      }

      if (isGameRequest) {
        if (!html.includes("<canvas")) issues.push("Missing canvas element for game");
        if (!html.includes("requestAnimationFrame")) issues.push("Missing game loop (requestAnimationFrame)");
        if (!html.includes("addEventListener")) issues.push("Missing event listeners for controls");
        if (!html.includes("resize")) issues.push("Missing responsive resize handling for canvas");
      }

      return { valid: issues.length === 0, issues };
    };

    // ============================================
    // CLEAN HTML
    // ============================================
    const cleanHtml = (html: string): string => {
      html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
      const doctypeIndex = html.indexOf("<!DOCTYPE");
      if (doctypeIndex > 0) html = html.substring(doctypeIndex);
      html = html.replace(/<body(?![^>]*style)/i, '<body style="background-color:#ffffff;color:#111111;"');
      return html;
    };

    // ============================================
    // REPAIR HTML
    // ============================================
    const repairHtml = async (html: string, issues: string[]): Promise<string | null> => {
      try {
        console.log("Attempting repair pass, issues:", issues);
        const repairRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY!,
            "anthropic-version": "2023-06-01",
          },
           body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 12000,
              messages: [{ role: "user", content: getRepairPrompt(html, issues) }],
            }),
          });

          if (repairRes.ok) {
            const data = await repairRes.json();
            const repairedHtml = cleanHtml(data.content[0].text);
            console.log("Repair pass complete!");
            return repairedHtml;
          }
      } catch (e: any) {
        console.log("Repair failed:", e.message);
      }
      return null;
    };

    // ============================================
    // PROCESS — Generate → Validate → Repair
    // ============================================
    const processHtml = async (rawHtml: string): Promise<string | null> => {
      let html = cleanHtml(rawHtml);
      const { valid, issues } = validateHtml(html);

      if (valid) {
        console.log("HTML validation passed!");
        return html;
      }

      console.log("Validation failed, issues:", issues);

      const repaired = await repairHtml(html, issues);
      if (repaired) {
        const { valid: repairedValid } = validateHtml(repaired);
        if (repairedValid) {
          console.log("Repair successful!");
          return repaired;
        }
        if (repaired.length > 1500) {
          console.log("Returning partially repaired HTML");
          return repaired;
        }
      }

      return null;
    };

    // ============================================
    // TRY CLAUDE FIRST
    // ============================================
    try {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
         body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 12000,
          messages: [{ role: "user", content: systemPrompt }],
         }),

      if (claudeRes.ok) {
        const data = await claudeRes.json();
        const html = await processHtml(data.content[0].text);
        if (html) {
          console.log("Claude success!");
          return NextResponse.json({ html, model: "claude" });
        }
        console.log("Claude failed even after repair");
      } else {
        const err = await claudeRes.text();
        console.log("Claude error:", err);
      }
    } catch (e: any) {
      console.log("Claude exception:", e.message);
    }

    // ============================================
    // TRY GEMINI SECOND
    // ============================================
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
              maxOutputTokens: 12000,
              temperature: 0.9,
            },
          }),
        }
      );

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        const rawHtml = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const html = await processHtml(rawHtml);
        if (html) {
          console.log("Gemini success!");
          return NextResponse.json({ html, model: "gemini" });
        }
        console.log("Gemini failed even after repair");
      } else {
        const err = await geminiRes.text();
        console.log("Gemini error:", err);
      }
    } catch (e: any) {
      console.log("Gemini exception:", e.message);
    }

    return NextResponse.json({ error: "All AI services failed. Please try again." }, { status: 500 });

  } catch (error: any) {
    console.log("Server error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
