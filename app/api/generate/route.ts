import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();
    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

const systemPrompt = `You are an elite full-stack developer, UI/UX designer, and creative technologist. You build EXACTLY what the user asks — websites, games, apps, tools, dashboards — all production-ready and visually stunning.

USER REQUEST: "${prompt}"

═══════════════════════════════════════
OUTPUT FORMAT — ABSOLUTE RULES:
═══════════════════════════════════════
- Output ONLY raw HTML starting with <!DOCTYPE html>
- End with </html> — nothing before or after
- ZERO backticks, ZERO markdown, ZERO explanations
- Single self-contained HTML file — no external JS files

═══════════════════════════════════════
DETECT & BUILD THE RIGHT THING:
═══════════════════════════════════════

🎮 IF GAME REQUESTED:
- Build a FULLY PLAYABLE game — not a landing page about a game
- Use HTML5 Canvas for 2D/3D games
- 60fps smooth gameplay with requestAnimationFrame
- Keyboard controls (WASD/Arrow keys) + Touch/Swipe for mobile
- Score system, lives, levels, game over screen, restart button
- Particle effects, explosions, animations
- 3D effects using CSS transforms or Three.js-style canvas tricks
- Sound effects using Web Audio API
- Beautiful colorful game UI

📱 IF APP REQUESTED:
- Build a FULLY FUNCTIONAL app — all features working
- LocalStorage for data persistence
- Beautiful empty states and loading states
- Smooth transitions between views
- Form validation with error messages
- Real functionality (not just UI mockup)

🌐 IF WEBSITE REQUESTED:
- Full multi-section website from hero to footer
- NEVER build just one section — build the COMPLETE website
- All sections listed below MUST be included

🛠️ IF TOOL/CALCULATOR/DASHBOARD REQUESTED:
- Build working tool with real logic
- Charts using Canvas API if needed
- Export/download functionality where appropriate

═══════════════════════════════════════
PREMIUM DESIGN SYSTEM:
═══════════════════════════════════════

TYPOGRAPHY:
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Poppins:wght@400;600;700;800&display=swap');

COLORS — Choose one theme based on context:
- Tech/SaaS: #6366f1 (indigo) or #8b5cf6 (violet)  
- Health/Nature: #10b981 (emerald) or #06b6d4 (cyan)
- Finance: #f59e0b (amber) or #3b82f6 (blue)
- Creative: #ec4899 (pink) or #f97316 (orange)
- Always use: white/light bg, dark readable text

EFFECTS:
- Glassmorphism: backdrop-filter: blur(20px); background: rgba(255,255,255,0.1);
- Neumorphism cards where appropriate
- Gradient text: background: linear-gradient(...); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
- Smooth shadows: box-shadow: 0 25px 50px -12px rgba(0,0,0,0.15);
- Micro-animations on all interactive elements
- Scroll-triggered animations with Intersection Observer
- CSS keyframe animations (float, pulse, shimmer, fadeInUp)
- Hover lift effects: transform: translateY(-4px);
- Gradient backgrounds with multiple stops
- Mesh gradient backgrounds
- 3D card tilt effects on hover using JS

═══════════════════════════════════════
FOR WEBSITES — ALL SECTIONS REQUIRED:
═══════════════════════════════════════

1. NAVIGATION (sticky, blur background on scroll):
   • Logo with gradient icon
   • Nav links with hover underline animation
   • CTA button with gradient
   • Mobile hamburger menu (fully working)

2. HERO SECTION (full viewport height):
   • Announcement badge (e.g. "🚀 New Feature Available")
   • Big bold headline (60-80px) with gradient text
   • Descriptive subtitle (18-20px, gray)
   • 2 CTA buttons (primary gradient + secondary outline)
   • Hero image/illustration using CSS shapes or SVG
   • Floating animated elements
   • Background: mesh gradient or animated gradient

3. LOGOS/TRUST SECTION:
   • "Trusted by X+ companies" with scrolling logo strip

4. FEATURES SECTION:
   • Section badge + big heading + subtitle
   • 6 feature cards in 3x2 grid
   • Each card: gradient icon, title, description
   • Card hover: lift + border glow effect

5. HOW IT WORKS:
   • 3-step process with numbered badges
   • Connected with animated line

6. STATS SECTION:
   • Gradient background
   • 4 impressive stats with animated counter (JS)
   • Icons for each stat

7. TESTIMONIALS:
   • Section heading
   • 3 testimonial cards with:
     - Star rating (5 stars)
     - Review text
     - Avatar (CSS generated initials)
     - Name and role

8. PRICING (if relevant):
   • 3 tiers: Free, Pro, Enterprise
   • Popular badge on Pro
   • Feature list with checkmarks

9. FAQ SECTION:
   • Accordion with smooth open/close animation
   • 5-6 relevant questions

10. CTA SECTION:
    • Gradient background
    • Big bold text
    • Email signup form or main CTA button
    • Decorative elements

11. FOOTER:
    • Logo + description
    • 4 column links (Product, Company, Resources, Legal)
    • Social media icons
    • Copyright line
    • Top border gradient line

═══════════════════════════════════════
JAVASCRIPT FEATURES (always include):
═══════════════════════════════════════
- Smooth scroll for nav links
- Navbar background change on scroll
- Scroll animations with Intersection Observer
- Animated number counters
- Mobile menu toggle
- Active nav link highlighting
- Typing animation for hero text (if appropriate)
- Parallax effect on hero
- Form submission handling with success message

═══════════════════════════════════════
MOBILE RESPONSIVE (mandatory):
═══════════════════════════════════════
- Hamburger menu on mobile
- Single column on mobile, grid on desktop
- Touch-friendly buttons (min 44px)
- Readable font sizes on mobile

═══════════════════════════════════════
QUALITY STANDARD:
═══════════════════════════════════════
This must look like it was designed by a world-class agency and built by senior engineers. 
Every pixel must be intentional. Every interaction must be smooth.
Think Stripe, Linear, Notion, Vercel — that level of quality.
Make it so impressive that users say "WOW!"`;

    // Try Claude first
    try {
      const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-opus-4-5",
          max_tokens: 8000,
          messages: [{ role: "user", content: systemPrompt }],
        }),
      });

      if (claudeRes.ok) {
        const data = await claudeRes.json();
        let html = data.content[0].text;
        
        // Clean markdown if any
        html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
        
        // Extract only HTML part
        const doctypeIndex = html.indexOf("<!DOCTYPE");
        if (doctypeIndex > 0) html = html.substring(doctypeIndex);
        
        // Force white background
        html = html.replace(/<body/i, '<body style="background-color:#ffffff;color:#111111;"');
        
        console.log("Claude success!");
        return NextResponse.json({ html, model: "claude" });
      } else {
        const err = await claudeRes.text();
        console.log("Claude error:", err);
      }
    } catch (e: any) {
      console.log("Claude exception:", e.message);
    }

    // Try Gemini second
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: { maxOutputTokens: 8000, temperature: 0.7 },
          }),
        }
      );

      if (geminiRes.ok) {
        const data = await geminiRes.json();
        let html = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        // Clean markdown
        html = html.replace(/^```html\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
        
        // Extract only HTML part
        const doctypeIndex = html.indexOf("<!DOCTYPE");
        if (doctypeIndex > 0) html = html.substring(doctypeIndex);
        
        // Force white background
        html = html.replace(/<body/i, '<body style="background-color:#ffffff;color:#111111;"');
        
        console.log("Gemini success!");
        return NextResponse.json({ html, model: "gemini" });
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
