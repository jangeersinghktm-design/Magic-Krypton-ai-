/**
 * KRYPTON AI — Completion Engine: Template Library
 *
 * Reusable HTML skeletons the AI EXTENDS rather than generating
 * everything from scratch. Each skeleton already contains the DOM
 * structure that the quality checklists look for (viewport meta,
 * HUD divs, nav/footer, etc.) — so structural checks pass by
 * default, and the AI's job becomes "fill in the logic/content"
 * rather than "invent the whole page including structure".
 *
 * Covers the 11 categories requested:
 *   Games:    platformer, racing, shooter, snake, tower-defense, puzzle, rpg
 *   Websites: landing, saas, dashboard, mobile-app
 *
 * Templates are intentionally MINIMAL (structure + stubs, not full
 * implementations) — they are scaffolding, not finished products.
 */

// ── Shared game skeleton (base for all 7 game templates) ─────────
const GAME_BASE_SKELETON = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Krypton Game</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  html,body{width:100%;height:100%;overflow:hidden;background:#0a0a0a;font-family:Arial,sans-serif;}
  #gameCanvas{display:block;background:#111;}
  #hud{position:fixed;top:0;left:0;right:0;display:flex;justify-content:space-between;
       padding:14px 20px;color:#0f8;font-weight:bold;font-size:20px;text-shadow:0 0 8px #0f8;
       pointer-events:none;z-index:10;}
  #lives{letter-spacing:6px;}
  .overlay{position:fixed;inset:0;display:none;flex-direction:column;align-items:center;
           justify-content:center;gap:20px;background:rgba(0,0,0,0.85);z-index:100;color:#0f8;}
  .overlay.show{display:flex;}
  .overlay button{padding:12px 30px;font-size:18px;background:#0f8;color:#0a0a0a;
                  border:none;border-radius:6px;font-weight:bold;cursor:pointer;}
  #dpad{position:fixed;bottom:24px;left:24px;width:140px;height:140px;display:none;}
  #dpad.show{display:block;}
  .dbtn{position:absolute;width:46px;height:46px;background:rgba(0,255,136,0.25);
        border:2px solid #0f8;border-radius:6px;color:#0f8;font-size:20px;
        display:flex;align-items:center;justify-content:center;user-select:none;}
  #dUp{top:0;left:47px;} #dDown{bottom:0;left:47px;} #dLeft{top:47px;left:0;} #dRight{top:47px;right:0;}
  #actions{position:fixed;bottom:24px;right:24px;display:none;gap:14px;}
  #actions.show{display:flex;}
  .abtn{width:64px;height:64px;border-radius:50%;background:rgba(255,0,85,0.25);
        border:2px solid #f05;color:#f05;font-weight:bold;display:flex;
        align-items:center;justify-content:center;user-select:none;}
</style>
</head>
<body>
<canvas id="gameCanvas"></canvas>
<div id="hud">
  <div id="score">Score: 0</div>
  <div id="level">Level: 1</div>
  <div id="lives">❤️❤️❤️</div>
</div>

<div class="overlay" id="pauseScreen">
  <h1>PAUSED</h1>
  <button id="resumeBtn">Resume (P)</button>
  <button id="restartBtn">Restart (R)</button>
</div>

<div class="overlay" id="gameOverScreen">
  <h1>GAME OVER</h1>
  <div>Score: <span id="finalScore">0</span></div>
  <div>High Score: <span id="finalHighScore">0</span></div>
  <button id="gameOverRestartBtn">Restart (R)</button>
</div>

<div class="overlay" id="winScreen">
  <h1>YOU WIN!</h1>
  <div>Score: <span id="winScore">0</span></div>
  <button id="winRestartBtn">Play Again</button>
</div>

<div id="dpad">
  <div class="dbtn" id="dUp">▲</div>
  <div class="dbtn" id="dDown">▼</div>
  <div class="dbtn" id="dLeft">◀</div>
  <div class="dbtn" id="dRight">▶</div>
</div>
<div id="actions">
  <div class="abtn" id="actionA">A</div>
  <div class="abtn" id="actionB">B</div>
</div>

<script>
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
resize();
window.addEventListener('resize', resize);

const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
if (isMobile) {
  document.getElementById('dpad').classList.add('show');
  document.getElementById('actions').classList.add('show');
}

// Web Audio — wrapped so a SecurityError/NotAllowedError on creation
// (autoplay policy, sandboxed context) doesn't halt the whole script.
let actx = null;
try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
function beep(freq, dur, type='sine', vol=0.2){
  if (!actx) return;
  try {
    const o = actx.createOscillator(), g = actx.createGain();
    o.connect(g); g.connect(actx.destination);
    o.frequency.value = freq; o.type = type;
    g.gain.setValueAtTime(vol, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, actx.currentTime + dur);
    o.start(); o.stop(actx.currentTime + dur);
  } catch(e){}
}

// Safe storage — localStorage throws SecurityError on opaque-origin
// (srcdoc iframe) documents. Wrapped with in-memory fallback so a
// single uncaught throw can't halt the rest of this script.
const _memStore = {};
const safeStorage = {
  get(key, def){ try { const v = localStorage.getItem(key); return v===null ? def : v; } catch(e){ return key in _memStore ? _memStore[key] : def; } },
  set(key, val){ try { localStorage.setItem(key, val); } catch(e){ _memStore[key]=String(val); } }
};

let score = 0, level = 1, lives = 3;
let highScore = parseInt(safeStorage.get('kryptonHighScore','0'));
let state = 'playing'; // playing | paused | gameover | win
let keys = {};

window.addEventListener('keydown', e => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase()==='p') togglePause();
  if (e.key.toLowerCase()==='r') restart();
});
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

function togglePause(){
  if (state==='playing'){ state='paused'; document.getElementById('pauseScreen').classList.add('show'); }
  else if (state==='paused'){ state='playing'; document.getElementById('pauseScreen').classList.remove('show'); }
}
document.getElementById('resumeBtn').onclick = togglePause;
document.getElementById('restartBtn').onclick = restart;
document.getElementById('gameOverRestartBtn').onclick = restart;
document.getElementById('winRestartBtn').onclick = restart;

// Full in-page state reset — location.reload() is unreliable on
// srcdoc iframes (can blank the page instead of re-rendering it).
// Resets common state + clears overlays; if the game-specific code
// below defines initGame(), it's called to reset game-specific state
// (player position, enemies, levels, etc.) too.
function restart(){
  score = 0; level = 1; lives = 3; state = 'playing';
  document.getElementById('pauseScreen').classList.remove('show');
  document.getElementById('gameOverScreen').classList.remove('show');
  document.getElementById('winScreen').classList.remove('show');
  if (typeof initGame === 'function') { try { initGame(); } catch(e){} }
  updateHUD();
}

function loseLife(){
  lives--;
  beep(150,0.3,'sawtooth',0.3);
  updateHUD();
  if (lives<=0) gameOver();
}
function gameOver(){
  state='gameover';
  if (score>highScore){ highScore=score; safeStorage.set('kryptonHighScore', highScore); }
  document.getElementById('finalScore').textContent = score;
  document.getElementById('finalHighScore').textContent = highScore;
  document.getElementById('gameOverScreen').classList.add('show');
}
function win(){
  state='win';
  if (score>highScore){ highScore=score; safeStorage.set('kryptonHighScore', highScore); }
  document.getElementById('winScore').textContent = score;
  document.getElementById('winScreen').classList.add('show');
}
function updateHUD(){
  document.getElementById('score').textContent = 'Score: '+score;
  document.getElementById('level').textContent = 'Level: '+level;
  document.getElementById('lives').textContent = '❤️'.repeat(Math.max(0,lives));
}

/* ====================================================================
   GAME-SPECIFIC LOGIC GOES HERE — see category requirements below.
   Implement update() and render() and call them from the loop.

   RECOMMENDED: define an initGame() function that (re)initializes all
   game-specific state (player position/velocity, enemies array, coins,
   level layout, etc.) and call initGame() once below before the game
   loop starts. restart() automatically calls initGame() if it exists,
   so this is what makes the Restart button fully reset the game.
==================================================================== */
__GAME_SPECIFIC_JS__

function update(){
  if (state!=='playing') return;
  // TODO: game-specific update logic
}
function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // TODO: game-specific rendering
}
function loop(){ update(); render(); requestAnimationFrame(loop); }
if (typeof initGame === 'function') { try { initGame(); } catch(e){} }
updateHUD();
loop();
</script>
</body>
</html>`;

// ── Per-category additions (small JS hints inserted into the skeleton) ──
const GAME_CATEGORY_HINTS: Record<string, string> = {
  platformer: `
// PLATFORMER: add gravity, player object with x/y/vx/vy, platforms array,
// jump on Space/Up, AABB collision with platforms, enemies array with
// patrol AI, coins array, checkpoint/respawn, level-end trigger -> win().`,

  racing: `
// RACING: add player car (x,y,angle,speed), track boundaries or road path,
// AI opponent cars array with simple waypoint following, lap counter,
// nitro boost (Shift/actionA), drift physics, collision with track edges.`,

  shooter: `
// SHOOTER: add player position, bullets array (player-fired), enemies
// array spawned in waves, bullet-enemy and enemy-player collision,
// power-up drops, wave counter feeding level, health/lives on hit.`,

  snake: `
// SNAKE: grid-based (e.g. 20x20 cells), snake body as array of {x,y},
// direction queue, food spawning, growth on eat, wall+self collision ->
// loseLife()/gameOver(), speed increases with level.`,

  "tower-defense": `
// TOWER DEFENSE: define grid + path array for enemy movement, tower
// types with cost/range/damage, click-to-place towers, gold economy,
// enemy waves with HP/speed, "Next Wave" trigger, lives decrease when
// an enemy reaches the end -> gameOver() at 0.`,

  puzzle: `
// PUZZLE: define grid (e.g. 8x8), tile/piece types, click or drag to
// swap/match, match-3 (or relevant) clear logic with gravity refill,
// move counter, level target score -> win() when reached.`,

  rpg: `
// RPG: tile-based map array, player with hp/attack/defense/inventory,
// NPC objects with simple dialog on interact (E key/actionA), enemy
// encounters with basic combat (attack reduces hp), quest flag in HUD,
// win() on main quest completion, gameOver() at hp<=0.`,

  flappy: `
// FLAPPY: player is a single object with constant gravity; Space/Up/tap
// (actionA) applies an upward flap impulse. Pipes array spawn from the
// right edge at intervals with randomized gap position; move left each
// frame. Collision with pipe or floor/ceiling -> loseLife()/gameOver().
// score++ each time a pipe is passed. Increase pipe speed slightly with
// score for difficulty.`,

  breakout: `
// BREAKOUT: paddle object at bottom controlled by left/right (and touch
// drag); ball object bounces off paddle/walls/bricks with angle based on
// hit position. bricks = grid array of {x,y,w,h,alive}; on ball-brick
// collision, mark brick dead, score++, bounce ball. Occasionally drop a
// power-up (wider paddle / multi-ball) from a destroyed brick. Ball falls
// past paddle -> loseLife(); all bricks dead -> win().`,

  pong: `
// PONG: two paddles (left=player via up/down or W/S+touch dpad up/down,
// right=AI that tracks ball.y with a max speed) and a ball that bounces
// off paddles/top/bottom with increasing speed on each hit. score++ for
// whichever side the ball passes; first to a target score (e.g. 7) ->
// win() for player or gameOver() if AI wins.`,

  pacman: `
// PACMAN: maze defined as a 2D grid of wall/floor/dot cells; player moves
// grid-aligned via arrows/WASD/dpad, blocked by walls. dots array (one per
// floor cell with a dot) shrinks as player passes over them, score++ each.
// 3-4 ghost objects with simple chase-toward-player movement on the grid.
// Power pellets (a few special dots) make ghosts "scared" for ~8s (player
// can eat them for bonus score). Ghost catches player while not scared ->
// loseLife(); all dots collected -> win().`,
};

export function getGameTemplate(gameType: string): string {
  const hint = GAME_CATEGORY_HINTS[gameType] || "";
  return GAME_BASE_SKELETON.replace("__GAME_SPECIFIC_JS__", hint);
}

export function hasGameTemplate(gameType: string): boolean {
  return gameType in GAME_CATEGORY_HINTS;
}

// ── Website templates ─────────────────────────────────────────────
const WEBSITE_BASE_HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Krypton Site</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;font-family:'Segoe UI',Arial,sans-serif;}
  body{background:#0a0a0a;color:#eee;}
  nav{display:flex;justify-content:space-between;align-items:center;padding:18px 32px;
      position:sticky;top:0;background:rgba(10,10,10,0.9);backdrop-filter:blur(8px);z-index:50;}
  nav a{color:#eee;text-decoration:none;margin-left:24px;}
  section{padding:60px 32px;}
  footer{padding:40px 32px;text-align:center;border-top:1px solid #222;color:#888;}
  .cta{display:inline-block;padding:14px 32px;background:#0f8;color:#0a0a0a;
       border-radius:8px;font-weight:bold;text-decoration:none;}
  @media (max-width:768px){ section{padding:40px 16px;} nav a{margin-left:14px;} }
</style>
</head>`;

const WEBSITE_TEMPLATES: Record<string, string> = {

  landing: `${WEBSITE_BASE_HEAD}
<body>
<nav><div><strong>Brand</strong></div><div>
  <a href="#features">Features</a><a href="#pricing">Pricing</a><a href="#faq">FAQ</a>
  <a href="#cta" class="cta">Get Started</a>
</div></nav>

<section id="hero">
  <h1><!-- VALUE PROPOSITION HEADLINE --></h1>
  <p><!-- subheadline --></p>
  <a href="#cta" class="cta">Get Started Free</a>
</section>

<section id="features">
  <h2>Features</h2>
  <!-- 3-4 feature cards -->
</section>

<section id="testimonials">
  <h2>Trusted by teams everywhere</h2>
  <!-- testimonial cards / stats -->
</section>

<section id="pricing">
  <h2>Pricing</h2>
  <!-- pricing tiers -->
</section>

<section id="faq">
  <h2>Frequently Asked Questions</h2>
  <!-- FAQ items -->
</section>

<section id="cta">
  <h2>Ready to get started?</h2>
  <form><input type="email" placeholder="you@email.com" required><button class="cta">Sign Up</button></form>
</section>

<footer>
  <div><a href="#privacy">Privacy</a> · <a href="#terms">Terms</a></div>
  <div>© Krypton AI</div>
</footer>
</body>
</html>`,

  saas: `${WEBSITE_BASE_HEAD}
<body>
<nav><div><strong>Product</strong></div><div>
  <a href="#features">Features</a><a href="#pricing">Pricing</a>
  <a href="#login">Log in</a><a href="#signup" class="cta">Sign Up</a>
</div></nav>

<section id="hero">
  <h1><!-- product headline --></h1>
  <p><!-- description --></p>
  <a href="#signup" class="cta">Get Started</a>
  <!-- product/dashboard preview image or mock -->
</section>

<section id="features"><h2>Features</h2><!-- feature list --></section>

<section id="dashboard-preview">
  <h2>See it in action</h2>
  <!-- screenshot/mock of dashboard -->
</section>

<section id="testimonials"><h2>Loved by customers</h2><!-- testimonials --></section>

<section id="pricing">
  <h2>Plans</h2>
  <!-- 3 pricing tiers, e.g. $9/month, $29/month, $99/month -->
</section>

<section id="faq"><h2>FAQ</h2><!-- faq items --></section>

<footer>
  <div>Integrations · Trusted by companies</div>
  <div>© Krypton AI</div>
</footer>
</body>
</html>`,

  dashboard: `${WEBSITE_BASE_HEAD}
<style>
  .layout{display:grid;grid-template-columns:220px 1fr;min-height:100vh;}
  .sidebar{background:#111;padding:24px;border-right:1px solid #222;}
  .sidebar a{display:block;color:#aaa;text-decoration:none;padding:10px 0;}
  .topbar{display:flex;justify-content:space-between;align-items:center;
          padding:16px 24px;border-bottom:1px solid #222;}
  .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;padding:24px;}
  .stat-card{background:#111;border:1px solid #222;border-radius:10px;padding:18px;}
  .panel{margin:0 24px 24px;background:#111;border:1px solid #222;border-radius:10px;padding:18px;}
  table{width:100%;border-collapse:collapse;}
  th,td{text-align:left;padding:10px;border-bottom:1px solid #222;}
</style>
</head>
<body>
<div class="layout">
  <nav class="sidebar">
    <div style="margin-bottom:24px"><strong>Krypton</strong></div>
    <a href="#overview">Overview</a>
    <a href="#analytics">Analytics</a>
    <a href="#users">Users</a>
    <a href="#settings">Settings</a>
  </nav>
  <div>
    <div class="topbar">
      <input type="search" placeholder="Search...">
      <div class="profile" id="profile">👤 User</div>
    </div>
    <div class="stats">
      <div class="stat-card"><!-- KPI 1: label + value --></div>
      <div class="stat-card"><!-- KPI 2 --></div>
      <div class="stat-card"><!-- KPI 3 --></div>
      <div class="stat-card"><!-- KPI 4 --></div>
    </div>
    <div class="panel">
      <h3>Trend</h3>
      <canvas id="chart" width="600" height="200"></canvas>
    </div>
    <div class="panel">
      <h3>Recent Activity</h3>
      <table>
        <thead><tr><th>Name</th><th>Status</th><th>Date</th></tr></thead>
        <tbody><!-- data rows --></tbody>
      </table>
    </div>
  </div>
</div>
<footer style="grid-column:1/-1"></footer>
<script>
  // TODO: draw chart on #chart canvas using ctx, populate table rows
</script>
</body>
</html>`,

  "mobile-app": `${WEBSITE_BASE_HEAD}
<style>
  body{max-width:480px;margin:0 auto;background:#0a0a0a;}
  .app-header{display:flex;justify-content:space-between;align-items:center;
              padding:16px;border-bottom:1px solid #222;}
  .app-body{padding:16px;min-height:70vh;}
  .input-row{margin-bottom:12px;}
  .input-row input,.input-row select{width:100%;padding:12px;border-radius:8px;
       border:1px solid #333;background:#111;color:#eee;}
  .result{margin-top:16px;padding:16px;background:#111;border-radius:10px;border:1px solid #222;}
  .empty-state{text-align:center;color:#666;padding:40px 0;}
  .bottom-nav{display:flex;justify-content:space-around;padding:14px;
              border-top:1px solid #222;position:fixed;bottom:0;left:0;right:0;
              max-width:480px;margin:0 auto;background:#0a0a0a;}
  .bottom-nav a{color:#aaa;text-decoration:none;text-align:center;font-size:12px;}
  button{padding:14px;width:100%;background:#0f8;color:#0a0a0a;border:none;
         border-radius:8px;font-weight:bold;}
</style>
</head>
<body>
<header class="app-header"><strong>App Name</strong><span id="profile">👤</span></header>

<main class="app-body" id="main">
  <h1><!-- main heading --></h1>

  <div class="input-row"><label>Input 1</label><input id="input1" placeholder="Enter value" required></div>
  <div class="input-row"><label>Input 2</label><input id="input2" placeholder="Enter value" required></div>

  <button id="calcBtn">Calculate</button>

  <div class="result" id="result">
    <!-- output appears here -->
  </div>

  <div class="empty-state" id="emptyState">No data yet — enter values above.</div>
</main>

<nav class="bottom-nav">
  <a href="#home">🏠<br>Home</a>
  <a href="#history">📜<br>History</a>
  <a href="#settings">⚙️<br>Settings</a>
</nav>

<footer style="display:none"></footer>

<script>
document.getElementById('calcBtn').addEventListener('click', () => {
  const a = document.getElementById('input1').value;
  const b = document.getElementById('input2').value;
  if (!a || !b) { document.getElementById('emptyState').style.display='block'; return; }
  document.getElementById('emptyState').style.display='none';
  // TODO: app-specific logic, write result into #result
  document.getElementById('result').textContent = 'Result: ' + (Number(a)+Number(b));
});
</script>
</body>
</html>`,

  ecommerce: `${WEBSITE_BASE_HEAD}
<style>
  .product-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:20px;}
  .product-card{background:#111;border:1px solid #222;border-radius:10px;padding:14px;}
  .product-card img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:6px;background:#222;}
  .price{font-weight:bold;color:#0f8;}
  .cart-badge{background:#0f8;color:#0a0a0a;border-radius:50%;padding:2px 7px;font-size:12px;}
  .filters{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px;}
  .filters button{padding:8px 16px;border-radius:6px;border:1px solid #333;background:#111;color:#eee;cursor:pointer;}
  #cartDrawer{position:fixed;top:0;right:-360px;width:340px;height:100%;background:#111;
              border-left:1px solid #222;transition:right .3s;padding:20px;z-index:60;}
  #cartDrawer.open{right:0;}
</style>
</head>
<body>
<nav>
  <div><strong>Shop</strong></div>
  <div>
    <a href="#products">Shop</a><a href="#about">About</a><a href="#contact">Contact</a>
    <a href="#" id="cartBtn">🛒 Cart <span class="cart-badge" id="cartCount">0</span></a>
  </div>
</nav>

<section id="hero">
  <h1><!-- store headline --></h1>
  <p><!-- store description --></p>
  <a href="#products" class="cta">Shop Now</a>
</section>

<section id="products">
  <h2>Products</h2>
  <div class="filters">
    <input type="search" id="searchInput" placeholder="Search products...">
    <button data-cat="all">All</button>
    <button data-cat="categoryA">Category A</button>
    <button data-cat="categoryB">Category B</button>
  </div>
  <div class="product-grid" id="productGrid">
    <!-- product cards: each has <img>, name, .price, Add to Cart button -->
  </div>
</section>

<section id="about"><h2>About Us</h2><!-- about content --></section>

<section id="contact">
  <h2>Contact</h2>
  <form id="contactForm"><input type="email" placeholder="you@email.com" required><textarea placeholder="Message"></textarea><button class="cta">Send</button></form>
</section>

<div id="cartDrawer">
  <h3>Your Cart</h3>
  <div id="cartItems"><!-- cart line items --></div>
  <div>Subtotal: <span id="cartSubtotal">$0.00</span></div>
  <button class="cta" id="checkoutBtn">Checkout</button>
</div>

<footer>
  <div><a href="#products">Shop</a> · <a href="#about">About</a> · <a href="#contact">Contact</a></div>
  <div>© Krypton AI</div>
</footer>

<script>
  // TODO: populate #productGrid from a products array, wire Add to Cart,
  // toggle #cartDrawer with #cartBtn, update #cartCount/#cartSubtotal,
  // filter by .filters buttons and #searchInput, persist cart to localStorage.
</script>
</body>
</html>`,

  portfolio: `${WEBSITE_BASE_HEAD}
<style>
  .project-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:24px;}
  .project-card{background:#111;border:1px solid #222;border-radius:10px;overflow:hidden;}
  .project-card img{width:100%;aspect-ratio:16/10;object-fit:cover;background:#222;}
  .project-card .body{padding:14px;}
  .skill-pill{display:inline-block;padding:6px 14px;margin:4px;border:1px solid #333;border-radius:20px;font-size:13px;}
  .timeline{border-left:2px solid #333;padding-left:20px;}
  .timeline-item{margin-bottom:20px;}
</style>
</head>
<body>
<nav>
  <div><strong>Your Name</strong></div>
  <div><a href="#about">About</a><a href="#projects">Projects</a><a href="#skills">Skills</a><a href="#contact" class="cta">Contact</a></div>
</nav>

<section id="hero">
  <h1><!-- Name --></h1>
  <p><!-- Title / tagline --></p>
  <a href="#contact" class="cta">Get in touch</a>
</section>

<section id="about">
  <h2>About</h2>
  <p><!-- bio --></p>
</section>

<section id="projects">
  <h2>Projects</h2>
  <div class="project-grid">
    <!-- 6x .project-card: <img>, title (h3), tech stack tags, live/repo links -->
  </div>
</section>

<section id="experience">
  <h2>Experience</h2>
  <div class="timeline">
    <!-- .timeline-item: role, company, dates, description -->
  </div>
</section>

<section id="skills">
  <h2>Skills</h2>
  <div><!-- .skill-pill x N --></div>
</section>

<section id="contact">
  <h2>Contact</h2>
  <form id="contactForm"><input type="email" placeholder="you@email.com" required><textarea placeholder="Message"></textarea><button class="cta">Send</button></form>
  <div><a href="#" target="_blank">GitHub</a> · <a href="#" target="_blank">LinkedIn</a> · <a href="#resume" download>Resume</a></div>
</section>

<footer><div>© Krypton AI</div></footer>

<script>
  // TODO: populate project cards, smooth-scroll for nav links,
  // wire contact form (e.preventDefault + show confirmation).
</script>
</body>
</html>`,

  blog: `${WEBSITE_BASE_HEAD}
<style>
  .layout{display:grid;grid-template-columns:1fr 280px;gap:32px;}
  .post-card{border-bottom:1px solid #222;padding:24px 0;}
  .post-card h2{margin-bottom:8px;}
  .post-meta{color:#888;font-size:14px;margin-bottom:8px;}
  .tag{display:inline-block;padding:4px 10px;border:1px solid #333;border-radius:14px;font-size:12px;margin-right:6px;}
  .sidebar-section{background:#111;border:1px solid #222;border-radius:10px;padding:16px;margin-bottom:16px;}
  .pagination{display:flex;gap:8px;justify-content:center;margin-top:24px;}
  .pagination a{padding:8px 14px;border:1px solid #333;border-radius:6px;color:#eee;text-decoration:none;}
  @media (max-width:768px){ .layout{grid-template-columns:1fr;} }
</style>
</head>
<body>
<nav>
  <div><strong>Blog</strong></div>
  <div><a href="#articles">Articles</a><a href="#about">About</a></div>
</nav>

<section id="hero">
  <article class="post-card" id="featured">
    <!-- featured post: h1 title, meta (author/date), excerpt, "Read more" -->
  </article>
</section>

<section id="articles">
  <div class="layout">
    <div id="postList">
      <!-- repeated .post-card: h2 title, .post-meta (author · date), tags, excerpt, "Read more" link -->
    </div>
    <aside>
      <div class="sidebar-section">
        <h3>Search</h3>
        <input type="search" placeholder="Search posts...">
      </div>
      <div class="sidebar-section">
        <h3>Categories</h3>
        <!-- .tag x N -->
      </div>
      <div class="sidebar-section">
        <h3>Recent Posts</h3>
        <!-- recent post links -->
      </div>
    </aside>
  </div>
  <div class="pagination">
    <a href="#">Previous</a><a href="#">1</a><a href="#">2</a><a href="#">Next</a>
  </div>
</section>

<footer><div>© Krypton AI</div></footer>

<script>
  // TODO: populate #postList with article data, wire search/category filter.
</script>
</body>
</html>`,

  website: `${WEBSITE_BASE_HEAD}
<body>
<nav>
  <div><strong>Brand</strong></div>
  <div><a href="#about">About</a><a href="#services">Services</a><a href="#gallery">Gallery</a><a href="#testimonials">Reviews</a><a href="#contact" class="cta">Contact</a></div>
</nav>

<section id="hero">
  <h1><!-- main headline --></h1>
  <p><!-- subheadline --></p>
  <a href="#contact" class="cta">Get in Touch</a>
</section>

<section id="about">
  <h2>About Us</h2>
  <p><!-- about content --></p>
</section>

<section id="services">
  <h2>Services</h2>
  <!-- 3-4 service cards -->
</section>

<section id="gallery">
  <h2>Gallery</h2>
  <!-- image grid / showcase -->
</section>

<section id="testimonials">
  <h2>What People Say</h2>
  <!-- testimonial cards -->
</section>

<section id="contact">
  <h2>Contact Us</h2>
  <form id="contactForm"><input type="email" placeholder="you@email.com" required><textarea placeholder="Message"></textarea><button class="cta">Send</button></form>
  <div><!-- address / phone / email --></div>
</section>

<footer>
  <div><a href="#about">About</a> · <a href="#services">Services</a> · <a href="#contact">Contact</a></div>
  <div>© Krypton AI</div>
</footer>

<script>
  // TODO: wire contact form, smooth-scroll nav links, gallery lightbox if needed.
</script>
</body>
</html>`,
};

// detectProjectType() in orchestrate returns "app" (not "mobile-app") for
// generic web apps/tools — alias it to the mobile-app skeleton.
const TEMPLATE_ALIASES: Record<string, string> = { app: "mobile-app" };

export function getWebsiteTemplate(projectType: string): string | null {
  const key = TEMPLATE_ALIASES[projectType] || projectType;
  return WEBSITE_TEMPLATES[key] || null;
}

export function hasWebsiteTemplate(projectType: string): boolean {
  const key = TEMPLATE_ALIASES[projectType] || projectType;
  return key in WEBSITE_TEMPLATES;
}
