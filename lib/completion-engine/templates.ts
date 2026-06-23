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
   Define your OWN function update(){...} and function render(){...}
   here — they will OVERRIDE the stub versions defined just above
   (last declaration wins in JS). Do not skip defining them — if you
   don't, the stubs above (which do nothing) remain active.

   RECOMMENDED: define an initGame() function that (re)initializes all
   game-specific state (player position/velocity, enemies array, coins,
   level layout, etc.) and call initGame() once below before the game
   loop starts. restart() automatically calls initGame() if it exists,
   so this is what makes the Restart button fully reset the game.
==================================================================== */
function update(){
  if (state!=='playing') return;
  // TODO: game-specific update logic
}
function render(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  // TODO: game-specific rendering
}

__GAME_SPECIFIC_JS__

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


  // ── Premium Game Template (Snake) ──────────────────────────────
  "game-snake": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<title>Snake Game</title>
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;overflow:hidden;background:#050816;font-family:"Segoe UI",Arial,sans-serif;}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;}
#hud{display:flex;gap:40px;align-items:center;}
.hud-item{text-align:center;}
.hud-val{font-size:28px;font-weight:800;background:linear-gradient(135deg,#6366F1,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.hud-label{font-size:11px;color:#64748B;letter-spacing:0.1em;text-transform:uppercase;}
#gameCanvas{border-radius:12px;border:1px solid rgba(99,102,241,0.3);box-shadow:0 0 60px rgba(99,102,241,0.15);}
#overlayScreen{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;background:rgba(5,8,22,0.95);z-index:100;}
#overlayScreen h1{font-size:clamp(32px,6vw,56px);font-weight:800;background:linear-gradient(135deg,#6366F1,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
#overlayScreen p{color:#64748B;font-size:16px;}
#finalScore{font-size:48px;font-weight:800;color:#fff;}
.game-btn{background:linear-gradient(135deg,#6366F1,#8B5CF6);color:#fff;border:none;padding:14px 40px;border-radius:10px;font-size:16px;font-weight:700;cursor:pointer;transition:all .2s;}
.game-btn:hover{transform:translateY(-2px);box-shadow:0 12px 32px rgba(99,102,241,.4);}
#dpad{position:fixed;bottom:24px;left:24px;width:140px;height:140px;display:none;}
#dpad.show{display:block;}
.dbtn{position:absolute;width:46px;height:46px;background:rgba(99,102,241,0.2);border:1px solid rgba(99,102,241,0.4);border-radius:8px;color:#6366F1;font-size:20px;display:flex;align-items:center;justify-content:center;user-select:none;cursor:pointer;-webkit-user-select:none;}
#dUp{top:0;left:47px;}#dDown{bottom:0;left:47px;}#dLeft{top:47px;left:0;}#dRight{top:47px;right:0;}
</style>
</head>
<body>
<div id="hud">
  <div class="hud-item"><div class="hud-val" id="scoreDisplay">0</div><div class="hud-label">Score</div></div>
  <div class="hud-item"><div class="hud-val" id="levelDisplay">1</div><div class="hud-label">Level</div></div>
  <div class="hud-item"><div class="hud-val" id="highDisplay">0</div><div class="hud-label">Best</div></div>
</div>
<canvas id="gameCanvas"></canvas>
<div id="dpad">
  <div class="dbtn" id="dUp">▲</div><div class="dbtn" id="dDown">▼</div>
  <div class="dbtn" id="dLeft">◀</div><div class="dbtn" id="dRight">▶</div>
</div>
<div id="overlayScreen">
  <h1>SNAKE</h1>
  <p>Use arrow keys or WASD to move</p>
  <div id="finalScore" style="display:none;"></div>
  <button class="game-btn" id="startBtn">▶ Start Game</button>
</div>
<script>
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CELL = 20;
let cols, rows, snake, dir, food, score, level, hs, speed, loop, gameRunning = false;

function resize() {
  const size = Math.min(window.innerWidth - 48, window.innerHeight - 160, 600);
  canvas.width = Math.floor(size / CELL) * CELL;
  canvas.height = canvas.width;
  cols = canvas.width / CELL; rows = canvas.height / CELL;
}

function init() {
  snake = [{x: Math.floor(cols/2), y: Math.floor(rows/2)}];
  dir = {x:1,y:0}; score = 0; level = 1; speed = 120;
  hs = parseInt(localStorage.getItem('snakeHS') || '0');
  updateHUD(); placeFood(); gameRunning = true;
  clearInterval(loop); loop = setInterval(tick, speed);
}

function placeFood() {
  do { food = {x:Math.floor(Math.random()*cols), y:Math.floor(Math.random()*rows)}; }
  while (snake.some(s=>s.x===food.x&&s.y===food.y));
}

function tick() {
  const head = {x:(snake[0].x+dir.x+cols)%cols, y:(snake[0].y+dir.y+rows)%rows};
  if (snake.some(s=>s.x===head.x&&s.y===head.y)) return gameOver();
  snake.unshift(head);
  if (head.x===food.x&&head.y===food.y) {
    score += 10 * level; if (score > hs) { hs = score; localStorage.setItem('snakeHS', hs); }
    if (score % 50 === 0) { level++; speed = Math.max(60, speed - 10); clearInterval(loop); loop = setInterval(tick, speed); }
    placeFood();
  } else snake.pop();
  updateHUD(); draw();
}

function draw() {
  ctx.fillStyle = '#050816'; ctx.fillRect(0,0,canvas.width,canvas.height);
  // Grid
  ctx.strokeStyle = 'rgba(99,102,241,0.05)';
  for(let i=0;i<=cols;i++){ctx.beginPath();ctx.moveTo(i*CELL,0);ctx.lineTo(i*CELL,canvas.height);ctx.stroke();}
  for(let j=0;j<=rows;j++){ctx.beginPath();ctx.moveTo(0,j*CELL);ctx.lineTo(canvas.width,j*CELL);ctx.stroke();}
  // Food
  const gf = ctx.createRadialGradient(food.x*CELL+CELL/2,food.y*CELL+CELL/2,2,food.x*CELL+CELL/2,food.y*CELL+CELL/2,CELL/2);
  gf.addColorStop(0,'#F59E0B'); gf.addColorStop(1,'#EF4444');
  ctx.fillStyle=gf; ctx.beginPath(); ctx.arc(food.x*CELL+CELL/2,food.y*CELL+CELL/2,CELL/2-2,0,Math.PI*2); ctx.fill();
  // Snake
  snake.forEach((s,i)=>{
    const ratio = i/snake.length;
    const g = ctx.createLinearGradient(s.x*CELL,s.y*CELL,s.x*CELL+CELL,s.y*CELL+CELL);
    g.addColorStop(0,i===0?'#818CF8':'#6366F1'); g.addColorStop(1,i===0?'#6366F1':'#4F46E5');
    ctx.fillStyle=g; ctx.beginPath(); ctx.roundRect(s.x*CELL+1,s.y*CELL+1,CELL-2,CELL-2,4); ctx.fill();
    if(i===0){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(s.x*CELL+CELL/2,s.y*CELL+CELL/2,2,0,Math.PI*2);ctx.fill();}
  });
}

function updateHUD() {
  document.getElementById('scoreDisplay').textContent = score;
  document.getElementById('levelDisplay').textContent = level;
  document.getElementById('highDisplay').textContent = hs;
}

function gameOver() {
  gameRunning=false; clearInterval(loop);
  const o=document.getElementById('overlayScreen');
  o.querySelector('h1').textContent='GAME OVER';
  o.querySelector('p').textContent='Better luck next time!';
  document.getElementById('finalScore').style.display='block';
  document.getElementById('finalScore').textContent=score;
  document.getElementById('startBtn').textContent='↺ Play Again';
  o.style.display='flex';
}

document.getElementById('startBtn').addEventListener('click',()=>{
  document.getElementById('overlayScreen').style.display='none';
  document.getElementById('finalScore').style.display='none';
  resize(); init();
});

document.addEventListener('keydown',e=>{
  if(!gameRunning)return;
  const k={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},
    w:{x:0,y:-1},s:{x:0,y:1},a:{x:-1,y:0},d:{x:1,y:0}};
  const nd=k[e.key];
  if(nd&&!(nd.x===-dir.x&&nd.y===-dir.y)){dir=nd;e.preventDefault();}
});

// Mobile D-Pad
const dmap={dUp:{x:0,y:-1},dDown:{x:0,y:1},dLeft:{x:-1,y:0},dRight:{x:1,y:0}};
Object.keys(dmap).forEach(id=>{
  document.getElementById(id).addEventListener('touchstart',e=>{e.preventDefault();if(gameRunning){const nd=dmap[id];if(!(nd.x===-dir.x&&nd.y===-dir.y))dir=nd;}},{passive:false});
});
if('ontouchstart' in window){document.getElementById('dpad').classList.add('show');}
window.addEventListener('resize',()=>{if(gameRunning){resize();draw();}});
resize();
</script>
</body>
</html>`,

  // ── Premium App Template (Task Manager) ──────────────────────────
  "task-app": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TaskFlow App</title>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
:root{--primary:#6366F1;--grad:linear-gradient(135deg,#6366F1,#8B5CF6);--bg:#030308;--surf:#07070F;--card:#0D0D1A;--text:#FFF;--muted:#64748B;--border:rgba(255,255,255,0.07);--success:#10B981;--warning:#F59E0B;--danger:#EF4444;}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:"DM Sans",sans-serif;min-height:100vh;display:flex;}
.sidebar{width:240px;background:var(--surf);border-right:1px solid var(--border);padding:24px 16px;display:flex;flex-direction:column;gap:8px;position:fixed;top:0;left:0;bottom:0;}
.sidebar-logo{font-family:"Syne",sans-serif;font-weight:800;font-size:18px;padding:8px 12px;margin-bottom:8px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;cursor:pointer;transition:all .2s;color:var(--muted);font-size:14px;}
.nav-item:hover,.nav-item.active{background:rgba(99,102,241,.12);color:#fff;}
.nav-item.active{color:var(--primary);}
.nav-icon{font-size:16px;width:20px;text-align:center;}
.nav-divider{height:1px;background:var(--border);margin:8px 0;}
.main{margin-left:240px;flex:1;padding:32px;min-height:100vh;}
.page-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;}
.page-title{font-family:"Syne",sans-serif;font-size:24px;font-weight:800;}
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 20px;border-radius:8px;font-weight:600;font-size:14px;cursor:pointer;border:none;transition:all .2s;}
.btn-primary{background:var(--grad);color:#fff;}.btn-primary:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(99,102,241,.35);}
.stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:28px;}
.stat-card{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:20px;}
.stat-num{font-family:"Syne",sans-serif;font-size:28px;font-weight:800;margin-bottom:4px;}
.stat-label{font-size:12px;color:var(--muted);}
.stat-trend{font-size:12px;font-weight:600;margin-top:4px;}
.trend-up{color:var(--success);}.trend-down{color:var(--danger);}
.board{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;}
.column{background:var(--surf);border:1px solid var(--border);border-radius:12px;padding:16px;}
.col-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;}
.col-title{font-weight:700;font-size:14px;}
.col-count{background:var(--card);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:12px;color:var(--muted);}
.task-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;cursor:pointer;transition:all .2s;}
.task-card:hover{border-color:rgba(99,102,241,.3);transform:translateY(-2px);}
.task-title{font-size:14px;font-weight:600;margin-bottom:8px;}
.task-meta{display:flex;justify-content:space-between;align-items:center;}
.tag{font-size:11px;padding:3px 10px;border-radius:999px;font-weight:600;}
.tag-high{background:rgba(239,68,68,.15);color:#EF4444;}
.tag-medium{background:rgba(245,158,11,.15);color:#F59E0B;}
.tag-low{background:rgba(16,185,129,.15);color:#10B981;}
.task-date{font-size:11px;color:var(--muted);}
.progress-bar{height:3px;background:var(--border);border-radius:2px;margin-top:10px;}
.progress-fill{height:100%;border-radius:2px;background:var(--grad);}
.add-task{display:flex;align-items:center;gap:8px;padding:10px;border-radius:8px;border:1px dashed var(--border);cursor:pointer;font-size:13px;color:var(--muted);transition:all .2s;margin-top:8px;}
.add-task:hover{border-color:var(--primary);color:var(--primary);}
.modal{display:none;position:fixed;inset:0;background:rgba(3,3,8,.85);z-index:200;align-items:center;justify-content:center;}
.modal.open{display:flex;}
.modal-box{background:var(--surf);border:1px solid var(--border);border-radius:16px;padding:28px;width:420px;max-width:95vw;}
.modal-title{font-family:"Syne",sans-serif;font-size:18px;font-weight:800;margin-bottom:20px;}
.form-group{margin-bottom:16px;}
.form-label{font-size:12px;color:var(--muted);margin-bottom:6px;display:block;text-transform:uppercase;letter-spacing:.05em;}
.form-input{width:100%;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text);font-family:"DM Sans",sans-serif;font-size:14px;outline:none;}
.form-input:focus{border-color:var(--primary);}
.form-select{width:100%;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:10px 14px;color:var(--text);font-family:"DM Sans",sans-serif;font-size:14px;outline:none;}
.modal-actions{display:flex;gap:10px;justify-content:flex-end;margin-top:20px;}
.btn-outline{background:transparent;color:var(--text);border:1px solid var(--border);}
@media(max-width:768px){.sidebar{display:none;}.main{margin-left:0;padding:16px;}.stats-row{grid-template-columns:repeat(2,1fr);}.board{grid-template-columns:1fr;}}
</style>
</head>
<body>
<aside class="sidebar">
  <div class="sidebar-logo">TaskFlow</div>
  <div class="nav-divider"></div>
  <div class="nav-item active"><span class="nav-icon">📋</span>My Tasks</div>
  <div class="nav-item"><span class="nav-icon">📊</span>Dashboard</div>
  <div class="nav-item"><span class="nav-icon">👥</span>Team</div>
  <div class="nav-item"><span class="nav-icon">📅</span>Calendar</div>
  <div class="nav-item"><span class="nav-icon">📁</span>Projects</div>
  <div class="nav-divider"></div>
  <div class="nav-item"><span class="nav-icon">⚙️</span>Settings</div>
</aside>
<main class="main">
  <div class="page-header">
    <h1 class="page-title">My Tasks</h1>
    <button class="btn btn-primary" onclick="document.getElementById('addModal').classList.add('open')">+ New Task</button>
  </div>
  <div class="stats-row">
    <div class="stat-card"><div class="stat-num" style="background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;" id="totalCount">12</div><div class="stat-label">Total Tasks</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--warning);" id="todoCount">4</div><div class="stat-label">To Do</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--primary);" id="inProgressCount">5</div><div class="stat-label">In Progress</div></div>
    <div class="stat-card"><div class="stat-num" style="color:var(--success);" id="doneCount">3</div><div class="stat-label">Completed</div></div>
  </div>
  <div class="board">
    <div class="column">
      <div class="col-header"><span class="col-title">📋 To Do</span><span class="col-count" id="todoColCount">4</span></div>
      <div id="todoCol">
        <div class="task-card"><div class="task-title">Design new dashboard layout</div><div class="task-meta"><span class="tag tag-high">High</span><span class="task-date">Jun 25</span></div><div class="progress-bar"><div class="progress-fill" style="width:20%"></div></div></div>
        <div class="task-card"><div class="task-title">Write API documentation</div><div class="task-meta"><span class="tag tag-medium">Medium</span><span class="task-date">Jun 28</span></div></div>
        <div class="task-card"><div class="task-title">Set up email notifications</div><div class="task-meta"><span class="tag tag-low">Low</span><span class="task-date">Jul 1</span></div></div>
        <div class="task-card"><div class="task-title">Review user feedback</div><div class="task-meta"><span class="tag tag-medium">Medium</span><span class="task-date">Jul 3</span></div></div>
      </div>
      <div class="add-task" onclick="document.getElementById('addModal').classList.add('open')">+ Add task</div>
    </div>
    <div class="column">
      <div class="col-header"><span class="col-title">🔄 In Progress</span><span class="col-count" id="inProgColCount">5</span></div>
      <div id="inProgressCol">
        <div class="task-card"><div class="task-title">Build authentication system</div><div class="task-meta"><span class="tag tag-high">High</span><span class="task-date">Jun 24</span></div><div class="progress-bar"><div class="progress-fill" style="width:65%"></div></div></div>
        <div class="task-card"><div class="task-title">Implement search feature</div><div class="task-meta"><span class="tag tag-medium">Medium</span><span class="task-date">Jun 26</span></div><div class="progress-bar"><div class="progress-fill" style="width:40%"></div></div></div>
        <div class="task-card"><div class="task-title">Optimize database queries</div><div class="task-meta"><span class="tag tag-high">High</span><span class="task-date">Jun 23</span></div><div class="progress-bar"><div class="progress-fill" style="width:80%"></div></div></div>
        <div class="task-card"><div class="task-title">Mobile responsive fixes</div><div class="task-meta"><span class="tag tag-medium">Medium</span><span class="task-date">Jun 27</span></div><div class="progress-bar"><div class="progress-fill" style="width:30%"></div></div></div>
        <div class="task-card"><div class="task-title">Write unit tests</div><div class="task-meta"><span class="tag tag-low">Low</span><span class="task-date">Jun 30</span></div><div class="progress-bar"><div class="progress-fill" style="width:15%"></div></div></div>
      </div>
    </div>
    <div class="column">
      <div class="col-header"><span class="col-title">✅ Done</span><span class="col-count" id="doneColCount">3</span></div>
      <div id="doneCol">
        <div class="task-card" style="opacity:.7"><div class="task-title" style="text-decoration:line-through;">Project setup & config</div><div class="task-meta"><span class="tag tag-high">High</span><span class="task-date">Jun 20</span></div><div class="progress-bar"><div class="progress-fill" style="width:100%;background:var(--success)"></div></div></div>
        <div class="task-card" style="opacity:.7"><div class="task-title" style="text-decoration:line-through;">Design system creation</div><div class="task-meta"><span class="tag tag-medium">Medium</span><span class="task-date">Jun 21</span></div><div class="progress-bar"><div class="progress-fill" style="width:100%;background:var(--success)"></div></div></div>
        <div class="task-card" style="opacity:.7"><div class="task-title" style="text-decoration:line-through;">Initial prototype</div><div class="task-meta"><span class="tag tag-low">Low</span><span class="task-date">Jun 22</span></div><div class="progress-bar"><div class="progress-fill" style="width:100%;background:var(--success)"></div></div></div>
      </div>
    </div>
  </div>
</main>
<div class="modal" id="addModal">
  <div class="modal-box">
    <div class="modal-title">New Task</div>
    <div class="form-group"><label class="form-label">Task Title</label><input class="form-input" id="taskTitle" placeholder="Enter task title..." /></div>
    <div class="form-group"><label class="form-label">Priority</label><select class="form-select" id="taskPriority"><option value="high">🔴 High</option><option value="medium" selected>🟡 Medium</option><option value="low">🟢 Low</option></select></div>
    <div class="form-group"><label class="form-label">Due Date</label><input class="form-input" id="taskDate" type="date" /></div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="document.getElementById('addModal').classList.remove('open')">Cancel</button>
      <button class="btn btn-primary" onclick="addTask()">Add Task</button>
    </div>
  </div>
</div>
<script>
function addTask(){
  const title=document.getElementById('taskTitle').value.trim();
  if(!title)return;
  const priority=document.getElementById('taskPriority').value;
  const date=document.getElementById('taskDate').value;
  const tagClass={high:'tag-high',medium:'tag-medium',low:'tag-low'}[priority];
  const tagLabel={high:'High',medium:'Medium',low:'Low'}[priority];
  const card=document.createElement('div');
  card.className='task-card';
  card.innerHTML=\`<div class="task-title">\${title}</div><div class="task-meta"><span class="tag \${tagClass}">\${tagLabel}</span><span class="task-date">\${date||'No date'}</span></div>\`;
  document.getElementById('todoCol').prepend(card);
  document.getElementById('taskTitle').value='';
  document.getElementById('addModal').classList.remove('open');
  updateCounts();
}
function updateCounts(){
  const t=document.getElementById('todoCol').querySelectorAll('.task-card').length;
  const p=document.getElementById('inProgressCol').querySelectorAll('.task-card').length;
  const d=document.getElementById('doneCol').querySelectorAll('.task-card').length;
  document.getElementById('todoColCount').textContent=t;
  document.getElementById('inProgColCount').textContent=p;
  document.getElementById('doneColCount').textContent=d;
  document.getElementById('totalCount').textContent=t+p+d;
  document.getElementById('todoCount').textContent=t;
  document.getElementById('inProgressCount').textContent=p;
  document.getElementById('doneCount').textContent=d;
}
document.getElementById('addModal').addEventListener('click',e=>{if(e.target===e.currentTarget)e.currentTarget.classList.remove('open');});
document.querySelectorAll('.nav-item').forEach(item=>{item.addEventListener('click',function(){document.querySelectorAll('.nav-item').forEach(i=>i.classList.remove('active'));this.classList.add('active');});});
</script>
</body>
</html>`,

  // ── Luxury / E-Commerce / Perfume template ───────────────────────
// Production-ready premium store template — manually crafted for
// maximum quality. AI fills in brand name, product names, prices,
// and color palette. Structure/sections/footer are guaranteed correct.
  "luxury": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Parfum Luxe — Fine Fragrances</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --gold:    #C9A84C;
  --gold-2:  #8B6914;
  --gold-lt: #F0D080;
  --grad:    linear-gradient(135deg, #C9A84C 0%, #8B6914 100%);
  --bg:      #050400;
  --surf:    #0A0900;
  --card:    #110F00;
  --text:    #F5EDD6;
  --muted:   #9A8A62;
  --border:  rgba(201,168,76,0.15);
  --glow:    0 0 48px rgba(201,168,76,0.18);
}
*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--text);font-family:'Jost',sans-serif;line-height:1.7;overflow-x:hidden;}
h1,h2,h3,h4,blockquote{font-family:'Cormorant Garamond',serif;font-weight:300;letter-spacing:0.06em;}
h1{font-size:clamp(44px,7vw,96px);line-height:1.05;}
h2{font-size:clamp(32px,4.5vw,58px);line-height:1.1;}
h3{font-size:clamp(20px,2.5vw,26px);}
img{display:block;width:100%;object-fit:cover;}
a{text-decoration:none;color:inherit;}

 /* UTILS */
.container{max-width:1260px;margin:0 auto;padding:0 clamp(20px,5vw,64px);}
.grad-text{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.eyebrow{font-family:'Jost',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:16px;}
.reveal{opacity:0;transform:translateY(32px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);}
.reveal.visible{opacity:1;transform:none;}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:all .25s;border:none;font-family:'Jost',sans-serif;font-weight:500;border-radius:4px;}
.btn-gold{background:var(--grad);color:#000;padding:14px 36px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;}
.btn-gold:hover{transform:translateY(-2px);box-shadow:var(--glow);}
.btn-outline{background:transparent;color:var(--gold);border:1px solid var(--gold);padding:13px 34px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;}
.btn-outline:hover{background:rgba(201,168,76,0.08);transform:translateY(-2px);}

/* NAV */
nav{position:fixed;top:0;left:0;right:0;z-index:999;padding:20px clamp(20px,5vw,64px);display:flex;justify-content:space-between;align-items:center;background:rgba(5,4,0,0.8);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);}
.logo{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;letter-spacing:0.2em;text-transform:uppercase;}
.nav-links{display:flex;gap:40px;align-items:center;}
.nav-links a{font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);transition:color .2s;}
.nav-links a:hover{color:var(--gold);}
.hamburger{display:none;background:none;border:none;color:var(--text);font-size:22px;cursor:pointer;z-index:1001;}
@media(max-width:768px){
  .nav-links{display:none;position:fixed;top:0;right:0;height:100vh;width:72%;flex-direction:column;align-items:flex-start;background:var(--surf);padding:80px 32px;gap:28px;border-left:1px solid var(--border);}
  .nav-links.open{display:flex;}
  .hamburger{display:block;}
}

/* HERO */
.hero{min-height:100vh;padding-top:80px;display:grid;grid-template-columns:1fr 1fr;gap:0;align-items:center;}
.hero-text{padding:clamp(48px,8vw,100px) clamp(20px,5vw,64px);}
.hero-kicker{display:flex;align-items:center;gap:12px;margin-bottom:28px;}
.hero-kicker span{height:1px;width:48px;background:var(--gold);}
.hero-title{margin-bottom:24px;}
.hero-desc{color:var(--muted);font-size:16px;max-width:420px;margin-bottom:40px;line-height:1.8;}
.hero-ctas{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:48px;}
.hero-trust{display:flex;align-items:center;gap:20px;}
.hero-trust-line{height:1px;width:32px;background:var(--border);}
.hero-trust-text{font-size:12px;color:var(--muted);letter-spacing:0.1em;}
.hero-image{position:relative;height:100vh;}
.hero-image img{height:100%;object-fit:cover;object-position:center;}
.hero-image::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,var(--bg) 0%,transparent 30%);}
.hero-badge{position:absolute;bottom:48px;left:-48px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px 24px;z-index:2;}
.hero-badge-num{font-family:'Cormorant Garamond',serif;font-size:42px;color:var(--gold);}
.hero-badge-label{font-size:11px;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;}
@media(max-width:900px){
  .hero{grid-template-columns:1fr;}
  .hero-image{height:55vw;min-height:300px;}
  .hero-image::after{background:linear-gradient(0deg,var(--bg) 0%,transparent 40%);}
  .hero-badge{display:none;}
}

/* MARQUEE */
.marquee-wrap{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:18px 0;overflow:hidden;}
.marquee-track{display:flex;gap:0;width:fit-content;animation:marquee 28s linear infinite;}
.marquee-track:hover{animation-play-state:paused;}
.marquee-item{display:flex;align-items:center;gap:12px;padding:0 40px;white-space:nowrap;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);}
.marquee-dot{width:4px;height:4px;border-radius:50%;background:var(--gold);}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* PRODUCTS */
.products{padding:clamp(80px,10vw,140px) 0;}
.section-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:clamp(40px,6vw,72px);}
.products-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;}
.product-card{position:relative;overflow:hidden;cursor:pointer;}
.product-card img{height:420px;transition:transform .6s cubic-bezier(.16,1,.3,1);}
.product-card:hover img{transform:scale(1.06);}
.product-overlay{position:absolute;inset:0;background:linear-gradient(0deg,rgba(5,4,0,.9) 0%,transparent 50%);padding:24px;display:flex;flex-direction:column;justify-content:flex-end;opacity:0;transition:opacity .3s;}
.product-card:hover .product-overlay{opacity:1;}
.product-info{padding:20px 0 0;}
.product-name{font-family:'Cormorant Garamond',serif;font-size:22px;margin-bottom:4px;}
.product-family{font-size:12px;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;margin-bottom:12px;}
.product-price{font-size:18px;color:var(--gold);}
@media(max-width:768px){.products-grid{grid-template-columns:1fr;}.product-card img{height:320px;}.section-header{flex-direction:column;align-items:flex-start;gap:20px;}}

/* STORY */
.story{padding:clamp(80px,10vw,140px) 0;display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,6vw,100px);align-items:center;}
.story-img{position:relative;}
.story-img img{height:600px;border-radius:2px;}
.story-img-accent{position:absolute;bottom:-24px;right:-24px;width:180px;height:180px;border:1px solid var(--border);border-radius:2px;overflow:hidden;}
.story-img-accent img{height:100%;object-fit:cover;}
.story-year{font-family:'Cormorant Garamond',serif;font-size:80px;color:rgba(201,168,76,0.08);position:absolute;top:-24px;left:-16px;line-height:1;}
.story-text{padding:clamp(0px,3vw,40px) 0;}
.story-text p{color:var(--muted);margin-bottom:20px;line-height:1.9;}
.story-stats{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:40px 0;}
.stat-num{font-family:'Cormorant Garamond',serif;font-size:42px;color:var(--gold);}
.stat-label{font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);}
@media(max-width:900px){.story{grid-template-columns:1fr;}.story-img img{height:400px;}.story-img-accent{display:none;}}

/* FEATURES */
.features{padding:clamp(80px,10vw,140px) 0;background:var(--surf);}
.features-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:clamp(48px,6vw,80px);}
.feature-item{padding:40px 32px;border-top:1px solid var(--border);transition:background .25s;}
.feature-item:hover{background:rgba(201,168,76,0.04);}
.feature-icon{font-size:28px;margin-bottom:20px;}
.feature-item h3{font-size:18px;margin-bottom:10px;}
.feature-item p{font-size:14px;color:var(--muted);line-height:1.7;}
@media(max-width:900px){.features-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:500px){.features-grid{grid-template-columns:1fr;}}

/* TESTIMONIALS */
.testimonials{padding:clamp(80px,10vw,140px) 0;}
.testimonials-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:clamp(48px,6vw,80px);}
.testi-card{background:var(--card);border:1px solid var(--border);border-radius:2px;padding:36px;transition:all .3s;}
.testi-card:hover{border-color:var(--gold);box-shadow:var(--glow);}
.testi-stars{color:var(--gold);font-size:13px;letter-spacing:3px;margin-bottom:20px;}
.testi-text{font-family:'Cormorant Garamond',serif;font-size:17px;line-height:1.7;color:var(--text);margin-bottom:24px;font-style:italic;}
.testi-author{display:flex;align-items:center;gap:14px;}
.testi-avatar{width:44px;height:44px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#000;flex-shrink:0;}
.testi-name{font-size:14px;font-weight:600;}
.testi-role{font-size:12px;color:var(--muted);}
@media(max-width:900px){.testimonials-grid{grid-template-columns:1fr;}}

/* CTA SECTION */
.cta-section{padding:clamp(80px,10vw,140px) 0;text-align:center;position:relative;overflow:hidden;}
.cta-section::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(201,168,76,0.08) 0%,transparent 70%);}
.cta-section h2{max-width:600px;margin:0 auto 20px;}
.cta-section p{color:var(--muted);max-width:400px;margin:0 auto 40px;}
.cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}

/* NEWSLETTER */
.newsletter{padding:clamp(60px,8vw,100px) 0;background:var(--surf);border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
.newsletter-inner{display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,6vw,80px);align-items:center;}
.newsletter-form{display:flex;gap:0;}
.newsletter-form input{flex:1;background:var(--card);border:1px solid var(--border);border-right:none;padding:14px 20px;color:var(--text);font-family:'Jost',sans-serif;font-size:14px;outline:none;border-radius:4px 0 0 4px;}
.newsletter-form input::placeholder{color:var(--muted);}
.newsletter-form input:focus{border-color:var(--gold);}
.newsletter-form button{background:var(--grad);color:#000;border:none;padding:14px 28px;font-family:'Jost',sans-serif;font-weight:600;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border-radius:0 4px 4px 0;transition:opacity .2s;}
.newsletter-form button:hover{opacity:0.9;}
@media(max-width:768px){.newsletter-inner{grid-template-columns:1fr;}.newsletter-form{flex-direction:column;}.newsletter-form input,.newsletter-form button{border-radius:4px;border-right:1px solid var(--border);}  }

/* FOOTER */
footer{padding:clamp(60px,8vw,100px) 0 32px;background:var(--surf);}
.footer-top{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:clamp(32px,5vw,64px);padding-bottom:clamp(40px,6vw,64px);border-bottom:1px solid var(--border);}
.footer-brand .logo{font-size:20px;margin-bottom:16px;display:block;}
.footer-brand p{font-size:13px;color:var(--muted);line-height:1.8;max-width:240px;}
.footer-col h4{font-family:'Jost',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);margin-bottom:20px;}
.footer-col ul{list-style:none;display:flex;flex-direction:column;gap:12px;}
.footer-col ul li a{font-size:13px;color:var(--muted);transition:color .2s;}
.footer-col ul li a:hover{color:var(--gold);}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:28px;flex-wrap:wrap;gap:16px;}
.footer-bottom p{font-size:12px;color:var(--muted);}
.footer-social{display:flex;gap:16px;}
.footer-social a{width:36px;height:36px;border:1px solid var(--border);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--muted);transition:all .2s;}
.footer-social a:hover{border-color:var(--gold);color:var(--gold);}
@media(max-width:900px){.footer-top{grid-template-columns:1fr 1fr;}}
@media(max-width:500px){.footer-top{grid-template-columns:1fr;}.footer-bottom{flex-direction:column;text-align:center;}}

/* SCROLLBAR */
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:var(--bg);}
::-webkit-scrollbar-thumb{background:var(--gold);border-radius:2px;}
</style>
</head>
<body>

<!-- NAV -->
<nav>
  <a class="logo grad-text" href="#">Parfum Luxe</a>
  <div class="nav-links" id="navLinks">
    <a href="#products">Collection</a>
    <a href="#story">Maison</a>
    <a href="#testimonials">Reviews</a>
    <a href="#contact">Contact</a>
    <a href="#products" class="btn btn-gold" style="padding:10px 24px;font-size:13px;">Shop Now</a>
  </div>
  <button class="hamburger" onclick="document.getElementById('navLinks').classList.toggle('open')">☰</button>
</nav>

<!-- HERO -->
<section class="hero" id="hero">
  <div class="hero-text">
    <div class="hero-kicker">
      <span></span>
      <p class="eyebrow">Fine Fragrances Since 1923</p>
    </div>
    <h1 class="hero-title reveal">The Art<br>of <em class="grad-text">Elegance</em></h1>
    <p class="hero-desc reveal">Crafted from the rarest ingredients, each Parfum Luxe fragrance is a journey through time — a whisper of identity you carry with you always.</p>
    <div class="hero-ctas reveal">
      <a href="#products" class="btn btn-gold">Explore Collection</a>
      <a href="#story" class="btn btn-outline">Our Story</a>
    </div>
    <div class="hero-trust reveal">
      <div class="hero-trust-line"></div>
      <p class="hero-trust-text">As seen in Vogue · Harper's Bazaar · Elle</p>
    </div>
  </div>
  <div class="hero-image">
    <img src="https://images.unsplash.com/https://picsum.photos/seed/luxhero/900/1100" alt="Luxury perfume bottle">
    <div class="hero-badge reveal">
      <div class="hero-badge-num grad-text">12</div>
      <div class="hero-badge-label">Exclusive Scents</div>
    </div>
  </div>
</section>

<!-- MARQUEE -->
<div class="marquee-wrap">
  <div class="marquee-track">
    <div class="marquee-item"><span class="marquee-dot"></span>Free shipping over ₹4,999</div>
    <div class="marquee-item"><span class="marquee-dot"></span>100% Authentic Ingredients</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Handcrafted in Grasse, France</div>
    <div class="marquee-item"><span class="marquee-dot"></span>30-Day Returns</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Gift Wrapping Available</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Vegan &amp; Cruelty-Free</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Free shipping over ₹4,999</div>
    <div class="marquee-item"><span class="marquee-dot"></span>100% Authentic Ingredients</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Handcrafted in Grasse, France</div>
    <div class="marquee-item"><span class="marquee-dot"></span>30-Day Returns</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Gift Wrapping Available</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Vegan &amp; Cruelty-Free</div>
  </div>
</div>

<!-- PRODUCTS -->
<section class="products" id="products">
  <div class="container">
    <div class="section-header">
      <div>
        <p class="eyebrow">The Collection</p>
        <h2 class="reveal">Signature Fragrances</h2>
      </div>
      <a href="#" class="btn btn-outline reveal">View All</a>
    </div>
    <div class="products-grid">
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf1/600/420" alt="Grace Femme">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Grace Femme</h3>
          <p class="product-family">Floral · Oriental</p>
          <p class="product-price">₹8,499</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf2/600/420" alt="Noir Absolu">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Noir Absolu</h3>
          <p class="product-family">Woody · Aromatic</p>
          <p class="product-price">₹11,299</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf3/600/420" alt="Ambre Précieux">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Ambre Précieux</h3>
          <p class="product-family">Amber · Vanilla</p>
          <p class="product-price">₹9,799</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf4/600/420" alt="Rose Imperiale">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Rose Impériale</h3>
          <p class="product-family">Rose · Musk</p>
          <p class="product-price">₹7,999</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf5/600/420" alt="Oud Royal">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Oud Royal</h3>
          <p class="product-family">Oud · Resinous</p>
          <p class="product-price">₹14,999</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf6/600/420" alt="Cèdre Blanc">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Cèdre Blanc</h3>
          <p class="product-family">Cedar · Fresh</p>
          <p class="product-price">₹6,999</p>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="story container" id="story">
  <div class="story-img reveal">
    <div class="story-year">1923</div>
    <img src="https://images.unsplash.com/https://picsum.photos/seed/story1/700/600" alt="Our Story">
    <div class="story-img-accent">
      <img src="https://images.unsplash.com/https://picsum.photos/seed/detail1/200/200" alt="Ingredient detail">
    </div>
  </div>
  <div class="story-text">
    <p class="eyebrow reveal">Maison Parfum Luxe</p>
    <h2 class="reveal">A Century of Craftsmanship</h2>
    <p class="reveal" style="margin-top:24px;">Born in the sun-drenched flower fields of Grasse, France, Parfum Luxe was founded by master perfumer Henri Beaumont in 1923. His singular vision: that fragrance is not a luxury — it is a language.</p>
    <p class="reveal">Today, three generations later, we source only the finest raw materials — Bulgarian rose attar, Madagascan vanilla, rare Indian oud — and transform them into scents that leave an impression long after you've left the room.</p>
    <div class="story-stats reveal">
      <div>
        <div class="stat-num grad-text">100+</div>
        <div class="stat-label">Years of expertise</div>
      </div>
      <div>
        <div class="stat-num grad-text">12</div>
        <div class="stat-label">Signature scents</div>
      </div>
      <div>
        <div class="stat-num grad-text">34</div>
        <div class="stat-label">Countries shipped</div>
      </div>
      <div>
        <div class="stat-num grad-text">98%</div>
        <div class="stat-label">Customer satisfaction</div>
      </div>
    </div>
    <a href="#products" class="btn btn-gold reveal">Discover the Collection</a>
  </div>
</section>

<!-- FEATURES -->
<section class="features" id="features">
  <div class="container">
    <p class="eyebrow reveal">Why Parfum Luxe</p>
    <h2 class="reveal">The Difference Is in the Detail</h2>
    <div class="features-grid">
      <div class="feature-item reveal">
        <div class="feature-icon">🌹</div>
        <h3>Rare Ingredients</h3>
        <p>We source Bulgarian rose, oud, and vanilla directly from their origin — never synthetic substitutes.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">🤝</div>
        <h3>Handcrafted Batches</h3>
        <p>Each fragrance is made in small batches by master perfumers trained in Grasse, France.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">🌿</div>
        <h3>Vegan &amp; Cruelty-Free</h3>
        <p>Every product is certified vegan and never tested on animals — beauty with conscience.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">♻️</div>
        <h3>Sustainable Packaging</h3>
        <p>Our bottles are refillable and our packaging is made from recycled materials.</p>
      </div>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section class="testimonials" id="testimonials">
  <div class="container">
    <p class="eyebrow reveal">Client Stories</p>
    <h2 class="reveal">Scents That Stay</h2>
    <div class="testimonials-grid">
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"Grace Femme is unlike anything I have worn before. People stop me on the street to ask what I'm wearing. Worth every rupee."</p>
        <div class="testi-author">
          <div class="testi-avatar">P</div>
          <div>
            <div class="testi-name">Priya Sharma</div>
            <div class="testi-role">Mumbai · Verified Purchase</div>
          </div>
        </div>
      </div>
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"Oud Royal was a gift to myself and it has become my signature scent. Dark, rich, and utterly confident. Absolutely magnificent."</p>
        <div class="testi-author">
          <div class="testi-avatar">R</div>
          <div>
            <div class="testi-name">Rohan Mehra</div>
            <div class="testi-role">Delhi · Verified Purchase</div>
          </div>
        </div>
      </div>
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"The packaging alone made me feel I was opening something from Paris. The scent lasted 18 hours. I am never going back to another brand."</p>
        <div class="testi-author">
          <div class="testi-avatar">A</div>
          <div>
            <div class="testi-name">Anika Joshi</div>
            <div class="testi-role">Bengaluru · Verified Purchase</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-section" id="contact">
  <div class="container">
    <p class="eyebrow reveal">Limited Edition</p>
    <h2 class="reveal">Begin Your Scent Journey</h2>
    <p class="reveal">Try our Discovery Set — 5 bestselling fragrances in travel sizes, delivered to your door.</p>
    <div class="cta-btns reveal">
      <a href="#products" class="btn btn-gold">Shop Discovery Set — ₹2,499</a>
      <a href="mailto:hello@parfumluxe.com" class="btn btn-outline">Contact Us</a>
    </div>
  </div>
</section>

<!-- NEWSLETTER -->
<div class="newsletter">
  <div class="container">
    <div class="newsletter-inner">
      <div>
        <p class="eyebrow">Stay Connected</p>
        <h3 style="font-size:clamp(22px,3vw,30px);">Exclusive Releases &amp;<br>Private Offers</h3>
        <p style="color:var(--muted);font-size:14px;margin-top:8px;">Join 12,000+ fragrance lovers. No spam, ever.</p>
      </div>
      <form class="newsletter-form" onsubmit="event.preventDefault();this.querySelector('button').textContent='✓ Subscribed';">
        <input type="email" placeholder="Your email address" required>
        <button type="submit">Subscribe</button>
      </form>
    </div>
  </div>
</div>

<!-- FOOTER -->
<footer>
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <span class="logo grad-text">Parfum Luxe</span>
        <p>Fine fragrances handcrafted in the tradition of Grasse, France. Since 1923.</p>
      </div>
      <div class="footer-col">
        <h4>Collection</h4>
        <ul>
          <li><a href="#">Women's Fragrances</a></li>
          <li><a href="#">Men's Fragrances</a></li>
          <li><a href="#">Unisex Editions</a></li>
          <li><a href="#">Discovery Sets</a></li>
          <li><a href="#">Gift Collections</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Maison</h4>
        <ul>
          <li><a href="#">Our Story</a></li>
          <li><a href="#">Craftsmanship</a></li>
          <li><a href="#">Ingredients</a></li>
          <li><a href="#">Sustainability</a></li>
          <li><a href="#">Press</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Support</h4>
        <ul>
          <li><a href="#">Shipping &amp; Returns</a></li>
          <li><a href="#">FAQ</a></li>
          <li><a href="#">Track Order</a></li>
          <li><a href="#">Contact Us</a></li>
          <li><a href="#">Privacy Policy</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 Parfum Luxe. All rights reserved.</p>
      <div class="footer-social">
        <a href="#" aria-label="Instagram">📷</a>
        <a href="#" aria-label="Facebook">f</a>
        <a href="#" aria-label="Pinterest">P</a>
      </div>
    </div>
  </div>
</footer>

<script>
// Scroll reveal
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Sticky nav background
window.addEventListener('scroll', () => {
  document.querySelector('nav').style.background = window.scrollY > 60 ? 'rgba(5,4,0,0.95)' : 'rgba(5,4,0,0.8)';
});

// Mobile nav close on link click
document.querySelectorAll('#navLinks a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('navLinks').classList.remove('open'));
});
</script>
</body>
</html>
`,

  "ecommerce": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Parfum Luxe — Fine Fragrances</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --gold:    #C9A84C;
  --gold-2:  #8B6914;
  --gold-lt: #F0D080;
  --grad:    linear-gradient(135deg, #C9A84C 0%, #8B6914 100%);
  --bg:      #050400;
  --surf:    #0A0900;
  --card:    #110F00;
  --text:    #F5EDD6;
  --muted:   #9A8A62;
  --border:  rgba(201,168,76,0.15);
  --glow:    0 0 48px rgba(201,168,76,0.18);
}
*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--text);font-family:'Jost',sans-serif;line-height:1.7;overflow-x:hidden;}
h1,h2,h3,h4,blockquote{font-family:'Cormorant Garamond',serif;font-weight:300;letter-spacing:0.06em;}
h1{font-size:clamp(44px,7vw,96px);line-height:1.05;}
h2{font-size:clamp(32px,4.5vw,58px);line-height:1.1;}
h3{font-size:clamp(20px,2.5vw,26px);}
img{display:block;width:100%;object-fit:cover;}
a{text-decoration:none;color:inherit;}

/* UTILS */
.container{max-width:1260px;margin:0 auto;padding:0 clamp(20px,5vw,64px);}
.grad-text{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.eyebrow{font-family:'Jost',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:16px;}
.reveal{opacity:0;transform:translateY(32px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);}
.reveal.visible{opacity:1;transform:none;}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:all .25s;border:none;font-family:'Jost',sans-serif;font-weight:500;border-radius:4px;}
.btn-gold{background:var(--grad);color:#000;padding:14px 36px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;}
.btn-gold:hover{transform:translateY(-2px);box-shadow:var(--glow);}
.btn-outline{background:transparent;color:var(--gold);border:1px solid var(--gold);padding:13px 34px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;}
.btn-outline:hover{background:rgba(201,168,76,0.08);transform:translateY(-2px);}

/* NAV */
nav{position:fixed;top:0;left:0;right:0;z-index:999;padding:20px clamp(20px,5vw,64px);display:flex;justify-content:space-between;align-items:center;background:rgba(5,4,0,0.8);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);}
.logo{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;letter-spacing:0.2em;text-transform:uppercase;}
.nav-links{display:flex;gap:40px;align-items:center;}
.nav-links a{font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);transition:color .2s;}
.nav-links a:hover{color:var(--gold);}
.hamburger{display:none;background:none;border:none;color:var(--text);font-size:22px;cursor:pointer;z-index:1001;}
@media(max-width:768px){
  .nav-links{display:none;position:fixed;top:0;right:0;height:100vh;width:72%;flex-direction:column;align-items:flex-start;background:var(--surf);padding:80px 32px;gap:28px;border-left:1px solid var(--border);}
  .nav-links.open{display:flex;}
  .hamburger{display:block;}
}

/* HERO */
.hero{min-height:100vh;padding-top:80px;display:grid;grid-template-columns:1fr 1fr;gap:0;align-items:center;}
.hero-text{padding:clamp(48px,8vw,100px) clamp(20px,5vw,64px);}
.hero-kicker{display:flex;align-items:center;gap:12px;margin-bottom:28px;}
.hero-kicker span{height:1px;width:48px;background:var(--gold);}
.hero-title{margin-bottom:24px;}
.hero-desc{color:var(--muted);font-size:16px;max-width:420px;margin-bottom:40px;line-height:1.8;}
.hero-ctas{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:48px;}
.hero-trust{display:flex;align-items:center;gap:20px;}
.hero-trust-line{height:1px;width:32px;background:var(--border);}
.hero-trust-text{font-size:12px;color:var(--muted);letter-spacing:0.1em;}
.hero-image{position:relative;height:100vh;}
.hero-image img{height:100%;object-fit:cover;object-position:center;}
.hero-image::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,var(--bg) 0%,transparent 30%);}
.hero-badge{position:absolute;bottom:48px;left:-48px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px 24px;z-index:2;}
.hero-badge-num{font-family:'Cormorant Garamond',serif;font-size:42px;color:var(--gold);}
.hero-badge-label{font-size:11px;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;}
@media(max-width:900px){
  .hero{grid-template-columns:1fr;}
  .hero-image{height:55vw;min-height:300px;}
  .hero-image::after{background:linear-gradient(0deg,var(--bg) 0%,transparent 40%);}
  .hero-badge{display:none;}
}

/* MARQUEE */
.marquee-wrap{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:18px 0;overflow:hidden;}
.marquee-track{display:flex;gap:0;width:fit-content;animation:marquee 28s linear infinite;}
.marquee-track:hover{animation-play-state:paused;}
.marquee-item{display:flex;align-items:center;gap:12px;padding:0 40px;white-space:nowrap;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);}
.marquee-dot{width:4px;height:4px;border-radius:50%;background:var(--gold);}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* PRODUCTS */
.products{padding:clamp(80px,10vw,140px) 0;}
.section-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:clamp(40px,6vw,72px);}
.products-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;}
.product-card{position:relative;overflow:hidden;cursor:pointer;}
.product-card img{height:420px;transition:transform .6s cubic-bezier(.16,1,.3,1);}
.product-card:hover img{transform:scale(1.06);}
.product-overlay{position:absolute;inset:0;background:linear-gradient(0deg,rgba(5,4,0,.9) 0%,transparent 50%);padding:24px;display:flex;flex-direction:column;justify-content:flex-end;opacity:0;transition:opacity .3s;}
.product-card:hover .product-overlay{opacity:1;}
.product-info{padding:20px 0 0;}
.product-name{font-family:'Cormorant Garamond',serif;font-size:22px;margin-bottom:4px;}
.product-family{font-size:12px;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;margin-bottom:12px;}
.product-price{font-size:18px;color:var(--gold);}
@media(max-width:768px){.products-grid{grid-template-columns:1fr;}.product-card img{height:320px;}.section-header{flex-direction:column;align-items:flex-start;gap:20px;}}

/* STORY */
.story{padding:clamp(80px,10vw,140px) 0;display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,6vw,100px);align-items:center;}
.story-img{position:relative;}
.story-img img{height:600px;border-radius:2px;}
.story-img-accent{position:absolute;bottom:-24px;right:-24px;width:180px;height:180px;border:1px solid var(--border);border-radius:2px;overflow:hidden;}
.story-img-accent img{height:100%;object-fit:cover;}
.story-year{font-family:'Cormorant Garamond',serif;font-size:80px;color:rgba(201,168,76,0.08);position:absolute;top:-24px;left:-16px;line-height:1;}
.story-text{padding:clamp(0px,3vw,40px) 0;}
.story-text p{color:var(--muted);margin-bottom:20px;line-height:1.9;}
.story-stats{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:40px 0;}
.stat-num{font-family:'Cormorant Garamond',serif;font-size:42px;color:var(--gold);}
.stat-label{font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);}
@media(max-width:900px){.story{grid-template-columns:1fr;}.story-img img{height:400px;}.story-img-accent{display:none;}}

/* FEATURES */
.features{padding:clamp(80px,10vw,140px) 0;background:var(--surf);}
.features-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:clamp(48px,6vw,80px);}
.feature-item{padding:40px 32px;border-top:1px solid var(--border);transition:background .25s;}
.feature-item:hover{background:rgba(201,168,76,0.04);}
.feature-icon{font-size:28px;margin-bottom:20px;}
.feature-item h3{font-size:18px;margin-bottom:10px;}
.feature-item p{font-size:14px;color:var(--muted);line-height:1.7;}
@media(max-width:900px){.features-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:500px){.features-grid{grid-template-columns:1fr;}}

/* TESTIMONIALS */
.testimonials{padding:clamp(80px,10vw,140px) 0;}
.testimonials-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:clamp(48px,6vw,80px);}
.testi-card{background:var(--card);border:1px solid var(--border);border-radius:2px;padding:36px;transition:all .3s;}
.testi-card:hover{border-color:var(--gold);box-shadow:var(--glow);}
.testi-stars{color:var(--gold);font-size:13px;letter-spacing:3px;margin-bottom:20px;}
.testi-text{font-family:'Cormorant Garamond',serif;font-size:17px;line-height:1.7;color:var(--text);margin-bottom:24px;font-style:italic;}
.testi-author{display:flex;align-items:center;gap:14px;}
.testi-avatar{width:44px;height:44px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#000;flex-shrink:0;}
.testi-name{font-size:14px;font-weight:600;}
.testi-role{font-size:12px;color:var(--muted);}
@media(max-width:900px){.testimonials-grid{grid-template-columns:1fr;}}

/* CTA SECTION */
.cta-section{padding:clamp(80px,10vw,140px) 0;text-align:center;position:relative;overflow:hidden;}
.cta-section::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(201,168,76,0.08) 0%,transparent 70%);}
.cta-section h2{max-width:600px;margin:0 auto 20px;}
.cta-section p{color:var(--muted);max-width:400px;margin:0 auto 40px;}
.cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}

/* NEWSLETTER */
.newsletter{padding:clamp(60px,8vw,100px) 0;background:var(--surf);border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
.newsletter-inner{display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,6vw,80px);align-items:center;}
.newsletter-form{display:flex;gap:0;}
.newsletter-form input{flex:1;background:var(--card);border:1px solid var(--border);border-right:none;padding:14px 20px;color:var(--text);font-family:'Jost',sans-serif;font-size:14px;outline:none;border-radius:4px 0 0 4px;}
.newsletter-form input::placeholder{color:var(--muted);}
.newsletter-form input:focus{border-color:var(--gold);}
.newsletter-form button{background:var(--grad);color:#000;border:none;padding:14px 28px;font-family:'Jost',sans-serif;font-weight:600;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border-radius:0 4px 4px 0;transition:opacity .2s;}
.newsletter-form button:hover{opacity:0.9;}
@media(max-width:768px){.newsletter-inner{grid-template-columns:1fr;}.newsletter-form{flex-direction:column;}.newsletter-form input,.newsletter-form button{border-radius:4px;border-right:1px solid var(--border);}  }

/* FOOTER */
footer{padding:clamp(60px,8vw,100px) 0 32px;background:var(--surf);}
.footer-top{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:clamp(32px,5vw,64px);padding-bottom:clamp(40px,6vw,64px);border-bottom:1px solid var(--border);}
.footer-brand .logo{font-size:20px;margin-bottom:16px;display:block;}
.footer-brand p{font-size:13px;color:var(--muted);line-height:1.8;max-width:240px;}
.footer-col h4{font-family:'Jost',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);margin-bottom:20px;}
.footer-col ul{list-style:none;display:flex;flex-direction:column;gap:12px;}
.footer-col ul li a{font-size:13px;color:var(--muted);transition:color .2s;}
.footer-col ul li a:hover{color:var(--gold);}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:28px;flex-wrap:wrap;gap:16px;}
.footer-bottom p{font-size:12px;color:var(--muted);}
.footer-social{display:flex;gap:16px;}
.footer-social a{width:36px;height:36px;border:1px solid var(--border);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--muted);transition:all .2s;}
.footer-social a:hover{border-color:var(--gold);color:var(--gold);}
@media(max-width:900px){.footer-top{grid-template-columns:1fr 1fr;}}
@media(max-width:500px){.footer-top{grid-template-columns:1fr;}.footer-bottom{flex-direction:column;text-align:center;}}

/* SCROLLBAR */
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:var(--bg);}
::-webkit-scrollbar-thumb{background:var(--gold);border-radius:2px;}
</style>
</head>
<body>

<!-- NAV -->
<nav>
  <a class="logo grad-text" href="#">Parfum Luxe</a>
  <div class="nav-links" id="navLinks">
    <a href="#products">Collection</a>
    <a href="#story">Maison</a>
    <a href="#testimonials">Reviews</a>
    <a href="#contact">Contact</a>
    <a href="#products" class="btn btn-gold" style="padding:10px 24px;font-size:13px;">Shop Now</a>
  </div>
  <button class="hamburger" onclick="document.getElementById('navLinks').classList.toggle('open')">☰</button>
</nav>

<!-- HERO -->
<section class="hero" id="hero">
  <div class="hero-text">
    <div class="hero-kicker">
      <span></span>
      <p class="eyebrow">Fine Fragrances Since 1923</p>
    </div>
    <h1 class="hero-title reveal">The Art<br>of <em class="grad-text">Elegance</em></h1>
    <p class="hero-desc reveal">Crafted from the rarest ingredients, each Parfum Luxe fragrance is a journey through time — a whisper of identity you carry with you always.</p>
    <div class="hero-ctas reveal">
      <a href="#products" class="btn btn-gold">Explore Collection</a>
      <a href="#story" class="btn btn-outline">Our Story</a>
    </div>
    <div class="hero-trust reveal">
      <div class="hero-trust-line"></div>
      <p class="hero-trust-text">As seen in Vogue · Harper's Bazaar · Elle</p>
    </div>
  </div>
  <div class="hero-image">
    <img src="https://images.unsplash.com/https://picsum.photos/seed/luxhero/900/1100" alt="Luxury perfume bottle">
    <div class="hero-badge reveal">
      <div class="hero-badge-num grad-text">12</div>
      <div class="hero-badge-label">Exclusive Scents</div>
    </div>
  </div>
</section>

<!-- MARQUEE -->
<div class="marquee-wrap">
  <div class="marquee-track">
    <div class="marquee-item"><span class="marquee-dot"></span>Free shipping over ₹4,999</div>
    <div class="marquee-item"><span class="marquee-dot"></span>100% Authentic Ingredients</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Handcrafted in Grasse, France</div>
    <div class="marquee-item"><span class="marquee-dot"></span>30-Day Returns</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Gift Wrapping Available</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Vegan &amp; Cruelty-Free</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Free shipping over ₹4,999</div>
    <div class="marquee-item"><span class="marquee-dot"></span>100% Authentic Ingredients</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Handcrafted in Grasse, France</div>
    <div class="marquee-item"><span class="marquee-dot"></span>30-Day Returns</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Gift Wrapping Available</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Vegan &amp; Cruelty-Free</div>
  </div>
</div>

<!-- PRODUCTS -->
<section class="products" id="products">
  <div class="container">
    <div class="section-header">
      <div>
        <p class="eyebrow">The Collection</p>
        <h2 class="reveal">Signature Fragrances</h2>
      </div>
      <a href="#" class="btn btn-outline reveal">View All</a>
    </div>
    <div class="products-grid">
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf1/600/420" alt="Grace Femme">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Grace Femme</h3>
          <p class="product-family">Floral · Oriental</p>
          <p class="product-price">₹8,499</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf2/600/420" alt="Noir Absolu">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Noir Absolu</h3>
          <p class="product-family">Woody · Aromatic</p>
          <p class="product-price">₹11,299</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf3/600/420" alt="Ambre Précieux">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Ambre Précieux</h3>
          <p class="product-family">Amber · Vanilla</p>
          <p class="product-price">₹9,799</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf4/600/420" alt="Rose Imperiale">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Rose Impériale</h3>
          <p class="product-family">Rose · Musk</p>
          <p class="product-price">₹7,999</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf5/600/420" alt="Oud Royal">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Oud Royal</h3>
          <p class="product-family">Oud · Resinous</p>
          <p class="product-price">₹14,999</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf6/600/420" alt="Cèdre Blanc">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Cèdre Blanc</h3>
          <p class="product-family">Cedar · Fresh</p>
          <p class="product-price">₹6,999</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- STORY -->
<section class="story container" id="story">
  <div class="story-img reveal">
    <div class="story-year">1923</div>
    <img src="https://images.unsplash.com/https://picsum.photos/seed/story1/700/600" alt="Our Story">
    <div class="story-img-accent">
      <img src="https://images.unsplash.com/https://picsum.photos/seed/detail1/200/200" alt="Ingredient detail">
    </div>
  </div>
  <div class="story-text">
    <p class="eyebrow reveal">Maison Parfum Luxe</p>
    <h2 class="reveal">A Century of Craftsmanship</h2>
    <p class="reveal" style="margin-top:24px;">Born in the sun-drenched flower fields of Grasse, France, Parfum Luxe was founded by master perfumer Henri Beaumont in 1923. His singular vision: that fragrance is not a luxury — it is a language.</p>
    <p class="reveal">Today, three generations later, we source only the finest raw materials — Bulgarian rose attar, Madagascan vanilla, rare Indian oud — and transform them into scents that leave an impression long after you've left the room.</p>
    <div class="story-stats reveal">
      <div>
        <div class="stat-num grad-text">100+</div>
        <div class="stat-label">Years of expertise</div>
      </div>
      <div>
        <div class="stat-num grad-text">12</div>
        <div class="stat-label">Signature scents</div>
      </div>
      <div>
        <div class="stat-num grad-text">34</div>
        <div class="stat-label">Countries shipped</div>
      </div>
      <div>
        <div class="stat-num grad-text">98%</div>
        <div class="stat-label">Customer satisfaction</div>
      </div>
    </div>
    <a href="#products" class="btn btn-gold reveal">Discover the Collection</a>
  </div>
</section>

<!-- FEATURES -->
<section class="features" id="features">
  <div class="container">
    <p class="eyebrow reveal">Why Parfum Luxe</p>
    <h2 class="reveal">The Difference Is in the Detail</h2>
    <div class="features-grid">
      <div class="feature-item reveal">
        <div class="feature-icon">🌹</div>
        <h3>Rare Ingredients</h3>
        <p>We source Bulgarian rose, oud, and vanilla directly from their origin — never synthetic substitutes.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">🤝</div>
        <h3>Handcrafted Batches</h3>
        <p>Each fragrance is made in small batches by master perfumers trained in Grasse, France.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">🌿</div>
        <h3>Vegan &amp; Cruelty-Free</h3>
        <p>Every product is certified vegan and never tested on animals — beauty with conscience.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">♻️</div>
        <h3>Sustainable Packaging</h3>
        <p>Our bottles are refillable and our packaging is made from recycled materials.</p>
      </div>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section class="testimonials" id="testimonials">
  <div class="container">
    <p class="eyebrow reveal">Client Stories</p>
    <h2 class="reveal">Scents That Stay</h2>
    <div class="testimonials-grid">
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"Grace Femme is unlike anything I have worn before. People stop me on the street to ask what I'm wearing. Worth every rupee."</p>
        <div class="testi-author">
          <div class="testi-avatar">P</div>
          <div>
            <div class="testi-name">Priya Sharma</div>
            <div class="testi-role">Mumbai · Verified Purchase</div>
          </div>
        </div>
      </div>
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"Oud Royal was a gift to myself and it has become my signature scent. Dark, rich, and utterly confident. Absolutely magnificent."</p>
        <div class="testi-author">
          <div class="testi-avatar">R</div>
          <div>
            <div class="testi-name">Rohan Mehra</div>
            <div class="testi-role">Delhi · Verified Purchase</div>
          </div>
        </div>
      </div>
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"The packaging alone made me feel I was opening something from Paris. The scent lasted 18 hours. I am never going back to another brand."</p>
        <div class="testi-author">
          <div class="testi-avatar">A</div>
          <div>
            <div class="testi-name">Anika Joshi</div>
            <div class="testi-role">Bengaluru · Verified Purchase</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-section" id="contact">
  <div class="container">
    <p class="eyebrow reveal">Limited Edition</p>
    <h2 class="reveal">Begin Your Scent Journey</h2>
    <p class="reveal">Try our Discovery Set — 5 bestselling fragrances in travel sizes, delivered to your door.</p>
    <div class="cta-btns reveal">
      <a href="#products" class="btn btn-gold">Shop Discovery Set — ₹2,499</a>
      <a href="mailto:hello@parfumluxe.com" class="btn btn-outline">Contact Us</a>
    </div>
  </div>
</section>

<!-- NEWSLETTER -->
<div class="newsletter">
  <div class="container">
    <div class="newsletter-inner">
      <div>
        <p class="eyebrow">Stay Connected</p>
        <h3 style="font-size:clamp(22px,3vw,30px);">Exclusive Releases &amp;<br>Private Offers</h3>
        <p style="color:var(--muted);font-size:14px;margin-top:8px;">Join 12,000+ fragrance lovers. No spam, ever.</p>
      </div>
      <form class="newsletter-form" onsubmit="event.preventDefault();this.querySelector('button').textContent='✓ Subscribed';">
        <input type="email" placeholder="Your email address" required>
        <button type="submit">Subscribe</button>
      </form>
    </div>
  </div>
</div>

<!-- FOOTER -->
<footer>
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <span class="logo grad-text">Parfum Luxe</span>
        <p>Fine fragrances handcrafted in the tradition of Grasse, France. Since 1923.</p>
      </div>
      <div class="footer-col">
        <h4>Collection</h4>
        <ul>
          <li><a href="#">Women's Fragrances</a></li>
          <li><a href="#">Men's Fragrances</a></li>
          <li><a href="#">Unisex Editions</a></li>
          <li><a href="#">Discovery Sets</a></li>
          <li><a href="#">Gift Collections</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Maison</h4>
        <ul>
          <li><a href="#">Our Story</a></li>
          <li><a href="#">Craftsmanship</a></li>
          <li><a href="#">Ingredients</a></li>
          <li><a href="#">Sustainability</a></li>
          <li><a href="#">Press</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Support</h4>
        <ul>
          <li><a href="#">Shipping &amp; Returns</a></li>
          <li><a href="#">FAQ</a></li>
          <li><a href="#">Track Order</a></li>
          <li><a href="#">Contact Us</a></li>
          <li><a href="#">Privacy Policy</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 Parfum Luxe. All rights reserved.</p>
      <div class="footer-social">
        <a href="#" aria-label="Instagram">📷</a>
        <a href="#" aria-label="Facebook">f</a>
        <a href="#" aria-label="Pinterest">P</a>
      </div>
    </div>
  </div>
</footer>

<script>
// Scroll reveal
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Sticky nav background
window.addEventListener('scroll', () => {
  document.querySelector('nav').style.background = window.scrollY > 60 ? 'rgba(5,4,0,0.95)' : 'rgba(5,4,0,0.8)';
});

// Mobile nav close on link click
document.querySelectorAll('#navLinks a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('navLinks').classList.remove('open'));
});
</script>
</body>
</html>
`,

  "perfume": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Parfum Luxe — Fine Fragrances</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --gold:    #C9A84C;
  --gold-2:  #8B6914;
  --gold-lt: #F0D080;
  --grad:    linear-gradient(135deg, #C9A84C 0%, #8B6914 100%);
  --bg:      #050400;
  --surf:    #0A0900;
  --card:    #110F00;
  --text:    #F5EDD6;
  --muted:   #9A8A62;
  --border:  rgba(201,168,76,0.15);
  --glow:    0 0 48px rgba(201,168,76,0.18);
}
*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--text);font-family:'Jost',sans-serif;line-height:1.7;overflow-x:hidden;}
h1,h2,h3,h4,blockquote{font-family:'Cormorant Garamond',serif;font-weight:300;letter-spacing:0.06em;}
h1{font-size:clamp(44px,7vw,96px);line-height:1.05;}
h2{font-size:clamp(32px,4.5vw,58px);line-height:1.1;}
h3{font-size:clamp(20px,2.5vw,26px);}
img{display:block;width:100%;object-fit:cover;}
a{text-decoration:none;color:inherit;}

/* UTILS */
.container{max-width:1260px;margin:0 auto;padding:0 clamp(20px,5vw,64px);}
.grad-text{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.eyebrow{font-family:'Jost',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:16px;}
.reveal{opacity:0;transform:translateY(32px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);}
.reveal.visible{opacity:1;transform:none;}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:all .25s;border:none;font-family:'Jost',sans-serif;font-weight:500;border-radius:4px;}
.btn-gold{background:var(--grad);color:#000;padding:14px 36px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;}
.btn-gold:hover{transform:translateY(-2px);box-shadow:var(--glow);}
.btn-outline{background:transparent;color:var(--gold);border:1px solid var(--gold);padding:13px 34px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;}
.btn-outline:hover{background:rgba(201,168,76,0.08);transform:translateY(-2px);}

/* NAV */
nav{position:fixed;top:0;left:0;right:0;z-index:999;padding:20px clamp(20px,5vw,64px);display:flex;justify-content:space-between;align-items:center;background:rgba(5,4,0,0.8);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);}
.logo{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;letter-spacing:0.2em;text-transform:uppercase;}
.nav-links{display:flex;gap:40px;align-items:center;}
.nav-links a{font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);transition:color .2s;}
.nav-links a:hover{color:var(--gold);}
.hamburger{display:none;background:none;border:none;color:var(--text);font-size:22px;cursor:pointer;z-index:1001;}
@media(max-width:768px){
  .nav-links{display:none;position:fixed;top:0;right:0;height:100vh;width:72%;flex-direction:column;align-items:flex-start;background:var(--surf);padding:80px 32px;gap:28px;border-left:1px solid var(--border);}
  .nav-links.open{display:flex;}
  .hamburger{display:block;}
}

/* HERO */
.hero{min-height:100vh;padding-top:80px;display:grid;grid-template-columns:1fr 1fr;gap:0;align-items:center;}
.hero-text{padding:clamp(48px,8vw,100px) clamp(20px,5vw,64px);}
.hero-kicker{display:flex;align-items:center;gap:12px;margin-bottom:28px;}
.hero-kicker span{height:1px;width:48px;background:var(--gold);}
.hero-title{margin-bottom:24px;}
.hero-desc{color:var(--muted);font-size:16px;max-width:420px;margin-bottom:40px;line-height:1.8;}
.hero-ctas{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:48px;}
.hero-trust{display:flex;align-items:center;gap:20px;}
.hero-trust-line{height:1px;width:32px;background:var(--border);}
.hero-trust-text{font-size:12px;color:var(--muted);letter-spacing:0.1em;}
.hero-image{position:relative;height:100vh;}
.hero-image img{height:100%;object-fit:cover;object-position:center;}
.hero-image::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,var(--bg) 0%,transparent 30%);}
.hero-badge{position:absolute;bottom:48px;left:-48px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px 24px;z-index:2;}
.hero-badge-num{font-family:'Cormorant Garamond',serif;font-size:42px;color:var(--gold);}
.hero-badge-label{font-size:11px;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;}
@media(max-width:900px){
  .hero{grid-template-columns:1fr;}
  .hero-image{height:55vw;min-height:300px;}
  .hero-image::after{background:linear-gradient(0deg,var(--bg) 0%,transparent 40%);}
  .hero-badge{display:none;}
}

/* MARQUEE */
.marquee-wrap{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:18px 0;overflow:hidden;}
.marquee-track{display:flex;gap:0;width:fit-content;animation:marquee 28s linear infinite;}
.marquee-track:hover{animation-play-state:paused;}
.marquee-item{display:flex;align-items:center;gap:12px;padding:0 40px;white-space:nowrap;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);}
.marquee-dot{width:4px;height:4px;border-radius:50%;background:var(--gold);}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* PRODUCTS */
.products{padding:clamp(80px,10vw,140px) 0;}
.section-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:clamp(40px,6vw,72px);}
.products-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;}
.product-card{position:relative;overflow:hidden;cursor:pointer;}
.product-card img{height:420px;transition:transform .6s cubic-bezier(.16,1,.3,1);}
.product-card:hover img{transform:scale(1.06);}
.product-overlay{position:absolute;inset:0;background:linear-gradient(0deg,rgba(5,4,0,.9) 0%,transparent 50%);padding:24px;display:flex;flex-direction:column;justify-content:flex-end;opacity:0;transition:opacity .3s;}
.product-card:hover .product-overlay{opacity:1;}
.product-info{padding:20px 0 0;}
.product-name{font-family:'Cormorant Garamond',serif;font-size:22px;margin-bottom:4px;}
.product-family{font-size:12px;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;margin-bottom:12px;}
.product-price{font-size:18px;color:var(--gold);}
@media(max-width:768px){.products-grid{grid-template-columns:1fr;}.product-card img{height:320px;}.section-header{flex-direction:column;align-items:flex-start;gap:20px;}}

/* STORY */
.story{padding:clamp(80px,10vw,140px) 0;display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,6vw,100px);align-items:center;}
.story-img{position:relative;}
.story-img img{height:600px;border-radius:2px;}
.story-img-accent{position:absolute;bottom:-24px;right:-24px;width:180px;height:180px;border:1px solid var(--border);border-radius:2px;overflow:hidden;}
.story-img-accent img{height:100%;object-fit:cover;}
.story-year{font-family:'Cormorant Garamond',serif;font-size:80px;color:rgba(201,168,76,0.08);position:absolute;top:-24px;left:-16px;line-height:1;}
.story-text{padding:clamp(0px,3vw,40px) 0;}
.story-text p{color:var(--muted);margin-bottom:20px;line-height:1.9;}
.story-stats{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:40px 0;}
.stat-num{font-family:'Cormorant Garamond',serif;font-size:42px;color:var(--gold);}
.stat-label{font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);}
@media(max-width:900px){.story{grid-template-columns:1fr;}.story-img img{height:400px;}.story-img-accent{display:none;}}

/* FEATURES */
.features{padding:clamp(80px,10vw,140px) 0;background:var(--surf);}
.features-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:clamp(48px,6vw,80px);}
.feature-item{padding:40px 32px;border-top:1px solid var(--border);transition:background .25s;}
.feature-item:hover{background:rgba(201,168,76,0.04);}
.feature-icon{font-size:28px;margin-bottom:20px;}
.feature-item h3{font-size:18px;margin-bottom:10px;}
.feature-item p{font-size:14px;color:var(--muted);line-height:1.7;}
@media(max-width:900px){.features-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:500px){.features-grid{grid-template-columns:1fr;}}

/* TESTIMONIALS */
.testimonials{padding:clamp(80px,10vw,140px) 0;}
.testimonials-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:clamp(48px,6vw,80px);}
.testi-card{background:var(--card);border:1px solid var(--border);border-radius:2px;padding:36px;transition:all .3s;}
.testi-card:hover{border-color:var(--gold);box-shadow:var(--glow);}
.testi-stars{color:var(--gold);font-size:13px;letter-spacing:3px;margin-bottom:20px;}
.testi-text{font-family:'Cormorant Garamond',serif;font-size:17px;line-height:1.7;color:var(--text);margin-bottom:24px;font-style:italic;}
.testi-author{display:flex;align-items:center;gap:14px;}
.testi-avatar{width:44px;height:44px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#000;flex-shrink:0;}
.testi-name{font-size:14px;font-weight:600;}
.testi-role{font-size:12px;color:var(--muted);}
@media(max-width:900px){.testimonials-grid{grid-template-columns:1fr;}}

/* CTA SECTION */
.cta-section{padding:clamp(80px,10vw,140px) 0;text-align:center;position:relative;overflow:hidden;}
.cta-section::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(201,168,76,0.08) 0%,transparent 70%);}
.cta-section h2{max-width:600px;margin:0 auto 20px;}
.cta-section p{color:var(--muted);max-width:400px;margin:0 auto 40px;}
.cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}

/* NEWSLETTER */
.newsletter{padding:clamp(60px,8vw,100px) 0;background:var(--surf);border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
.newsletter-inner{display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,6vw,80px);align-items:center;}
.newsletter-form{display:flex;gap:0;}
.newsletter-form input{flex:1;background:var(--card);border:1px solid var(--border);border-right:none;padding:14px 20px;color:var(--text);font-family:'Jost',sans-serif;font-size:14px;outline:none;border-radius:4px 0 0 4px;}
.newsletter-form input::placeholder{color:var(--muted);}
.newsletter-form input:focus{border-color:var(--gold);}
.newsletter-form button{background:var(--grad);color:#000;border:none;padding:14px 28px;font-family:'Jost',sans-serif;font-weight:600;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border-radius:0 4px 4px 0;transition:opacity .2s;}
.newsletter-form button:hover{opacity:0.9;}
@media(max-width:768px){.newsletter-inner{grid-template-columns:1fr;}.newsletter-form{flex-direction:column;}.newsletter-form input,.newsletter-form button{border-radius:4px;border-right:1px solid var(--border);}  }

/* FOOTER */
footer{padding:clamp(60px,8vw,100px) 0 32px;background:var(--surf);}
.footer-top{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:clamp(32px,5vw,64px);padding-bottom:clamp(40px,6vw,64px);border-bottom:1px solid var(--border);}
.footer-brand .logo{font-size:20px;margin-bottom:16px;display:block;}
.footer-brand p{font-size:13px;color:var(--muted);line-height:1.8;max-width:240px;}
.footer-col h4{font-family:'Jost',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);margin-bottom:20px;}
.footer-col ul{list-style:none;display:flex;flex-direction:column;gap:12px;}
.footer-col ul li a{font-size:13px;color:var(--muted);transition:color .2s;}
.footer-col ul li a:hover{color:var(--gold);}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:28px;flex-wrap:wrap;gap:16px;}
.footer-bottom p{font-size:12px;color:var(--muted);}
.footer-social{display:flex;gap:16px;}
.footer-social a{width:36px;height:36px;border:1px solid var(--border);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--muted);transition:all .2s;}
.footer-social a:hover{border-color:var(--gold);color:var(--gold);}
@media(max-width:900px){.footer-top{grid-template-columns:1fr 1fr;}}
@media(max-width:500px){.footer-top{grid-template-columns:1fr;}.footer-bottom{flex-direction:column;text-align:center;}}

/* SCROLLBAR */
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:var(--bg);}
::-webkit-scrollbar-thumb{background:var(--gold);border-radius:2px;}
</style>
</head>
<body>

<!-- NAV -->
<nav>
  <a class="logo grad-text" href="#">Parfum Luxe</a>
  <div class="nav-links" id="navLinks">
    <a href="#products">Collection</a>
    <a href="#story">Maison</a>
    <a href="#testimonials">Reviews</a>
    <a href="#contact">Contact</a>
    <a href="#products" class="btn btn-gold" style="padding:10px 24px;font-size:13px;">Shop Now</a>
  </div>
  <button class="hamburger" onclick="document.getElementById('navLinks').classList.toggle('open')">☰</button>
</nav>

<!-- HERO -->
<section class="hero" id="hero">
  <div class="hero-text">
    <div class="hero-kicker">
      <span></span>
      <p class="eyebrow">Fine Fragrances Since 1923</p>
    </div>
    <h1 class="hero-title reveal">The Art<br>of <em class="grad-text">Elegance</em></h1>
    <p class="hero-desc reveal">Crafted from the rarest ingredients, each Parfum Luxe fragrance is a journey through time — a whisper of identity you carry with you always.</p>
    <div class="hero-ctas reveal">
      <a href="#products" class="btn btn-gold">Explore Collection</a>
      <a href="#story" class="btn btn-outline">Our Story</a>
    </div>
    <div class="hero-trust reveal">
      <div class="hero-trust-line"></div>
      <p class="hero-trust-text">As seen in Vogue · Harper's Bazaar · Elle</p>
    </div>
  </div>
  <div class="hero-image">
    <img src="https://images.unsplash.com/https://picsum.photos/seed/luxhero/900/1100" alt="Luxury perfume bottle">
    <div class="hero-badge reveal">
      <div class="hero-badge-num grad-text">12</div>
      <div class="hero-badge-label">Exclusive Scents</div>
    </div>
  </div>
</section>

<!-- MARQUEE -->
<div class="marquee-wrap">
  <div class="marquee-track">
    <div class="marquee-item"><span class="marquee-dot"></span>Free shipping over ₹4,999</div>
    <div class="marquee-item"><span class="marquee-dot"></span>100% Authentic Ingredients</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Handcrafted in Grasse, France</div>
    <div class="marquee-item"><span class="marquee-dot"></span>30-Day Returns</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Gift Wrapping Available</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Vegan &amp; Cruelty-Free</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Free shipping over ₹4,999</div>
    <div class="marquee-item"><span class="marquee-dot"></span>100% Authentic Ingredients</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Handcrafted in Grasse, France</div>
    <div class="marquee-item"><span class="marquee-dot"></span>30-Day Returns</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Gift Wrapping Available</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Vegan &amp; Cruelty-Free</div>
  </div>
</div>

<!-- PRODUCTS -->
<section class="products" id="products">
  <div class="container">
    <div class="section-header">
      <div>
        <p class="eyebrow">The Collection</p>
        <h2 class="reveal">Signature Fragrances</h2>
      </div>
      <a href="#" class="btn btn-outline reveal">View All</a>
    </div>
    <div class="products-grid">
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf1/600/420" alt="Grace Femme">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Grace Femme</h3>
          <p class="product-family">Floral · Oriental</p>
          <p class="product-price">₹8,499</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf2/600/420" alt="Noir Absolu">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Noir Absolu</h3>
          <p class="product-family">Woody · Aromatic</p>
          <p class="product-price">₹11,299</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf3/600/420" alt="Ambre Précieux">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Ambre Précieux</h3>
          <p class="product-family">Amber · Vanilla</p>
          <p class="product-price">₹9,799</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf4/600/420" alt="Rose Imperiale">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Rose Impériale</h3>
          <p class="product-family">Rose · Musk</p>
          <p class="product-price">₹7,999</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf5/600/420" alt="Oud Royal">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Oud Royal</h3>
          <p class="product-family">Oud · Resinous</p>
          <p class="product-price">₹14,999</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf6/600/420" alt="Cèdre Blanc">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Cèdre Blanc</h3>
          <p class="product-family">Cedar · Fresh</p>
          <p class="product-price">₹6,999</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- STORY -->
<section class="story container" id="story">
  <div class="story-img reveal">
    <div class="story-year">1923</div>
    <img src="https://images.unsplash.com/https://picsum.photos/seed/story1/700/600" alt="Our Story">
    <div class="story-img-accent">
      <img src="https://images.unsplash.com/https://picsum.photos/seed/detail1/200/200" alt="Ingredient detail">
    </div>
  </div>
  <div class="story-text">
    <p class="eyebrow reveal">Maison Parfum Luxe</p>
    <h2 class="reveal">A Century of Craftsmanship</h2>
    <p class="reveal" style="margin-top:24px;">Born in the sun-drenched flower fields of Grasse, France, Parfum Luxe was founded by master perfumer Henri Beaumont in 1923. His singular vision: that fragrance is not a luxury — it is a language.</p>
    <p class="reveal">Today, three generations later, we source only the finest raw materials — Bulgarian rose attar, Madagascan vanilla, rare Indian oud — and transform them into scents that leave an impression long after you've left the room.</p>
    <div class="story-stats reveal">
      <div>
        <div class="stat-num grad-text">100+</div>
        <div class="stat-label">Years of expertise</div>
      </div>
      <div>
        <div class="stat-num grad-text">12</div>
        <div class="stat-label">Signature scents</div>
      </div>
      <div>
        <div class="stat-num grad-text">34</div>
        <div class="stat-label">Countries shipped</div>
      </div>
      <div>
        <div class="stat-num grad-text">98%</div>
        <div class="stat-label">Customer satisfaction</div>
      </div>
    </div>
    <a href="#products" class="btn btn-gold reveal">Discover the Collection</a>
  </div>
</section>

<!-- FEATURES -->
<section class="features" id="features">
  <div class="container">
    <p class="eyebrow reveal">Why Parfum Luxe</p>
    <h2 class="reveal">The Difference Is in the Detail</h2>
    <div class="features-grid">
      <div class="feature-item reveal">
        <div class="feature-icon">🌹</div>
        <h3>Rare Ingredients</h3>
        <p>We source Bulgarian rose, oud, and vanilla directly from their origin — never synthetic substitutes.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">🤝</div>
        <h3>Handcrafted Batches</h3>
        <p>Each fragrance is made in small batches by master perfumers trained in Grasse, France.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">🌿</div>
        <h3>Vegan &amp; Cruelty-Free</h3>
        <p>Every product is certified vegan and never tested on animals — beauty with conscience.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">♻️</div>
        <h3>Sustainable Packaging</h3>
        <p>Our bottles are refillable and our packaging is made from recycled materials.</p>
      </div>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section class="testimonials" id="testimonials">
  <div class="container">
    <p class="eyebrow reveal">Client Stories</p>
    <h2 class="reveal">Scents That Stay</h2>
    <div class="testimonials-grid">
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"Grace Femme is unlike anything I have worn before. People stop me on the street to ask what I'm wearing. Worth every rupee."</p>
        <div class="testi-author">
          <div class="testi-avatar">P</div>
          <div>
            <div class="testi-name">Priya Sharma</div>
            <div class="testi-role">Mumbai · Verified Purchase</div>
          </div>
        </div>
      </div>
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"Oud Royal was a gift to myself and it has become my signature scent. Dark, rich, and utterly confident. Absolutely magnificent."</p>
        <div class="testi-author">
          <div class="testi-avatar">R</div>
          <div>
            <div class="testi-name">Rohan Mehra</div>
            <div class="testi-role">Delhi · Verified Purchase</div>
          </div>
        </div>
      </div>
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"The packaging alone made me feel I was opening something from Paris. The scent lasted 18 hours. I am never going back to another brand."</p>
        <div class="testi-author">
          <div class="testi-avatar">A</div>
          <div>
            <div class="testi-name">Anika Joshi</div>
            <div class="testi-role">Bengaluru · Verified Purchase</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-section" id="contact">
  <div class="container">
    <p class="eyebrow reveal">Limited Edition</p>
    <h2 class="reveal">Begin Your Scent Journey</h2>
    <p class="reveal">Try our Discovery Set — 5 bestselling fragrances in travel sizes, delivered to your door.</p>
    <div class="cta-btns reveal">
      <a href="#products" class="btn btn-gold">Shop Discovery Set — ₹2,499</a>
      <a href="mailto:hello@parfumluxe.com" class="btn btn-outline">Contact Us</a>
    </div>
  </div>
</section>

<!-- NEWSLETTER -->
<div class="newsletter">
  <div class="container">
    <div class="newsletter-inner">
      <div>
        <p class="eyebrow">Stay Connected</p>
        <h3 style="font-size:clamp(22px,3vw,30px);">Exclusive Releases &amp;<br>Private Offers</h3>
        <p style="color:var(--muted);font-size:14px;margin-top:8px;">Join 12,000+ fragrance lovers. No spam, ever.</p>
      </div>
      <form class="newsletter-form" onsubmit="event.preventDefault();this.querySelector('button').textContent='✓ Subscribed';">
        <input type="email" placeholder="Your email address" required>
        <button type="submit">Subscribe</button>
      </form>
    </div>
  </div>
</div>

<!-- FOOTER -->
<footer>
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <span class="logo grad-text">Parfum Luxe</span>
        <p>Fine fragrances handcrafted in the tradition of Grasse, France. Since 1923.</p>
      </div>
      <div class="footer-col">
        <h4>Collection</h4>
        <ul>
          <li><a href="#">Women's Fragrances</a></li>
          <li><a href="#">Men's Fragrances</a></li>
          <li><a href="#">Unisex Editions</a></li>
          <li><a href="#">Discovery Sets</a></li>
          <li><a href="#">Gift Collections</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Maison</h4>
        <ul>
          <li><a href="#">Our Story</a></li>
          <li><a href="#">Craftsmanship</a></li>
          <li><a href="#">Ingredients</a></li>
          <li><a href="#">Sustainability</a></li>
          <li><a href="#">Press</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Support</h4>
        <ul>
          <li><a href="#">Shipping &amp; Returns</a></li>
          <li><a href="#">FAQ</a></li>
          <li><a href="#">Track Order</a></li>
          <li><a href="#">Contact Us</a></li>
          <li><a href="#">Privacy Policy</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 Parfum Luxe. All rights reserved.</p>
      <div class="footer-social">
        <a href="#" aria-label="Instagram">📷</a>
        <a href="#" aria-label="Facebook">f</a>
        <a href="#" aria-label="Pinterest">P</a>
      </div>
    </div>
  </div>
</footer>

<script>
// Scroll reveal
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Sticky nav background
window.addEventListener('scroll', () => {
  document.querySelector('nav').style.background = window.scrollY > 60 ? 'rgba(5,4,0,0.95)' : 'rgba(5,4,0,0.8)';
});

// Mobile nav close on link click
document.querySelectorAll('#navLinks a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('navLinks').classList.remove('open'));
});
</script>
</body>
</html>
`,

  "store": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Parfum Luxe — Fine Fragrances</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root {
  --gold:    #C9A84C;
  --gold-2:  #8B6914;
  --gold-lt: #F0D080;
  --grad:    linear-gradient(135deg, #C9A84C 0%, #8B6914 100%);
  --bg:      #050400;
  --surf:    #0A0900;
  --card:    #110F00;
  --text:    #F5EDD6;
  --muted:   #9A8A62;
  --border:  rgba(201,168,76,0.15);
  --glow:    0 0 48px rgba(201,168,76,0.18);
}
*{box-sizing:border-box;margin:0;padding:0;}
html{scroll-behavior:smooth;}
body{background:var(--bg);color:var(--text);font-family:'Jost',sans-serif;line-height:1.7;overflow-x:hidden;}
h1,h2,h3,h4,blockquote{font-family:'Cormorant Garamond',serif;font-weight:300;letter-spacing:0.06em;}
h1{font-size:clamp(44px,7vw,96px);line-height:1.05;}
h2{font-size:clamp(32px,4.5vw,58px);line-height:1.1;}
h3{font-size:clamp(20px,2.5vw,26px);}
img{display:block;width:100%;object-fit:cover;}
a{text-decoration:none;color:inherit;}

/* UTILS */
.container{max-width:1260px;margin:0 auto;padding:0 clamp(20px,5vw,64px);}
.grad-text{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;}
.eyebrow{font-family:'Jost',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.2em;text-transform:uppercase;color:var(--gold);margin-bottom:16px;}
.reveal{opacity:0;transform:translateY(32px);transition:opacity .7s cubic-bezier(.16,1,.3,1),transform .7s cubic-bezier(.16,1,.3,1);}
.reveal.visible{opacity:1;transform:none;}

/* BUTTONS */
.btn{display:inline-flex;align-items:center;gap:8px;cursor:pointer;transition:all .25s;border:none;font-family:'Jost',sans-serif;font-weight:500;border-radius:4px;}
.btn-gold{background:var(--grad);color:#000;padding:14px 36px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;}
.btn-gold:hover{transform:translateY(-2px);box-shadow:var(--glow);}
.btn-outline{background:transparent;color:var(--gold);border:1px solid var(--gold);padding:13px 34px;font-size:14px;letter-spacing:0.08em;text-transform:uppercase;}
.btn-outline:hover{background:rgba(201,168,76,0.08);transform:translateY(-2px);}

/* NAV */
nav{position:fixed;top:0;left:0;right:0;z-index:999;padding:20px clamp(20px,5vw,64px);display:flex;justify-content:space-between;align-items:center;background:rgba(5,4,0,0.8);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);}
.logo{font-family:'Cormorant Garamond',serif;font-size:22px;font-weight:400;letter-spacing:0.2em;text-transform:uppercase;}
.nav-links{display:flex;gap:40px;align-items:center;}
.nav-links a{font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);transition:color .2s;}
.nav-links a:hover{color:var(--gold);}
.hamburger{display:none;background:none;border:none;color:var(--text);font-size:22px;cursor:pointer;z-index:1001;}
@media(max-width:768px){
  .nav-links{display:none;position:fixed;top:0;right:0;height:100vh;width:72%;flex-direction:column;align-items:flex-start;background:var(--surf);padding:80px 32px;gap:28px;border-left:1px solid var(--border);}
  .nav-links.open{display:flex;}
  .hamburger{display:block;}
}

/* HERO */
.hero{min-height:100vh;padding-top:80px;display:grid;grid-template-columns:1fr 1fr;gap:0;align-items:center;}
.hero-text{padding:clamp(48px,8vw,100px) clamp(20px,5vw,64px);}
.hero-kicker{display:flex;align-items:center;gap:12px;margin-bottom:28px;}
.hero-kicker span{height:1px;width:48px;background:var(--gold);}
.hero-title{margin-bottom:24px;}
.hero-desc{color:var(--muted);font-size:16px;max-width:420px;margin-bottom:40px;line-height:1.8;}
.hero-ctas{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:48px;}
.hero-trust{display:flex;align-items:center;gap:20px;}
.hero-trust-line{height:1px;width:32px;background:var(--border);}
.hero-trust-text{font-size:12px;color:var(--muted);letter-spacing:0.1em;}
.hero-image{position:relative;height:100vh;}
.hero-image img{height:100%;object-fit:cover;object-position:center;}
.hero-image::after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,var(--bg) 0%,transparent 30%);}
.hero-badge{position:absolute;bottom:48px;left:-48px;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:20px 24px;z-index:2;}
.hero-badge-num{font-family:'Cormorant Garamond',serif;font-size:42px;color:var(--gold);}
.hero-badge-label{font-size:11px;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;}
@media(max-width:900px){
  .hero{grid-template-columns:1fr;}
  .hero-image{height:55vw;min-height:300px;}
  .hero-image::after{background:linear-gradient(0deg,var(--bg) 0%,transparent 40%);}
  .hero-badge{display:none;}
}

/* MARQUEE */
.marquee-wrap{border-top:1px solid var(--border);border-bottom:1px solid var(--border);padding:18px 0;overflow:hidden;}
.marquee-track{display:flex;gap:0;width:fit-content;animation:marquee 28s linear infinite;}
.marquee-track:hover{animation-play-state:paused;}
.marquee-item{display:flex;align-items:center;gap:12px;padding:0 40px;white-space:nowrap;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);}
.marquee-dot{width:4px;height:4px;border-radius:50%;background:var(--gold);}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}

/* PRODUCTS */
.products{padding:clamp(80px,10vw,140px) 0;}
.section-header{display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:clamp(40px,6vw,72px);}
.products-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;}
.product-card{position:relative;overflow:hidden;cursor:pointer;}
.product-card img{height:420px;transition:transform .6s cubic-bezier(.16,1,.3,1);}
.product-card:hover img{transform:scale(1.06);}
.product-overlay{position:absolute;inset:0;background:linear-gradient(0deg,rgba(5,4,0,.9) 0%,transparent 50%);padding:24px;display:flex;flex-direction:column;justify-content:flex-end;opacity:0;transition:opacity .3s;}
.product-card:hover .product-overlay{opacity:1;}
.product-info{padding:20px 0 0;}
.product-name{font-family:'Cormorant Garamond',serif;font-size:22px;margin-bottom:4px;}
.product-family{font-size:12px;letter-spacing:0.1em;color:var(--muted);text-transform:uppercase;margin-bottom:12px;}
.product-price{font-size:18px;color:var(--gold);}
@media(max-width:768px){.products-grid{grid-template-columns:1fr;}.product-card img{height:320px;}.section-header{flex-direction:column;align-items:flex-start;gap:20px;}}

/* STORY */
.story{padding:clamp(80px,10vw,140px) 0;display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,6vw,100px);align-items:center;}
.story-img{position:relative;}
.story-img img{height:600px;border-radius:2px;}
.story-img-accent{position:absolute;bottom:-24px;right:-24px;width:180px;height:180px;border:1px solid var(--border);border-radius:2px;overflow:hidden;}
.story-img-accent img{height:100%;object-fit:cover;}
.story-year{font-family:'Cormorant Garamond',serif;font-size:80px;color:rgba(201,168,76,0.08);position:absolute;top:-24px;left:-16px;line-height:1;}
.story-text{padding:clamp(0px,3vw,40px) 0;}
.story-text p{color:var(--muted);margin-bottom:20px;line-height:1.9;}
.story-stats{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:40px 0;}
.stat-num{font-family:'Cormorant Garamond',serif;font-size:42px;color:var(--gold);}
.stat-label{font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted);}
@media(max-width:900px){.story{grid-template-columns:1fr;}.story-img img{height:400px;}.story-img-accent{display:none;}}

/* FEATURES */
.features{padding:clamp(80px,10vw,140px) 0;background:var(--surf);}
.features-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;margin-top:clamp(48px,6vw,80px);}
.feature-item{padding:40px 32px;border-top:1px solid var(--border);transition:background .25s;}
.feature-item:hover{background:rgba(201,168,76,0.04);}
.feature-icon{font-size:28px;margin-bottom:20px;}
.feature-item h3{font-size:18px;margin-bottom:10px;}
.feature-item p{font-size:14px;color:var(--muted);line-height:1.7;}
@media(max-width:900px){.features-grid{grid-template-columns:repeat(2,1fr);}}
@media(max-width:500px){.features-grid{grid-template-columns:1fr;}}

/* TESTIMONIALS */
.testimonials{padding:clamp(80px,10vw,140px) 0;}
.testimonials-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:clamp(48px,6vw,80px);}
.testi-card{background:var(--card);border:1px solid var(--border);border-radius:2px;padding:36px;transition:all .3s;}
.testi-card:hover{border-color:var(--gold);box-shadow:var(--glow);}
.testi-stars{color:var(--gold);font-size:13px;letter-spacing:3px;margin-bottom:20px;}
.testi-text{font-family:'Cormorant Garamond',serif;font-size:17px;line-height:1.7;color:var(--text);margin-bottom:24px;font-style:italic;}
.testi-author{display:flex;align-items:center;gap:14px;}
.testi-avatar{width:44px;height:44px;border-radius:50%;background:var(--grad);display:flex;align-items:center;justify-content:center;font-size:16px;font-weight:600;color:#000;flex-shrink:0;}
.testi-name{font-size:14px;font-weight:600;}
.testi-role{font-size:12px;color:var(--muted);}
@media(max-width:900px){.testimonials-grid{grid-template-columns:1fr;}}

/* CTA SECTION */
.cta-section{padding:clamp(80px,10vw,140px) 0;text-align:center;position:relative;overflow:hidden;}
.cta-section::before{content:'';position:absolute;inset:0;background:radial-gradient(ellipse at center,rgba(201,168,76,0.08) 0%,transparent 70%);}
.cta-section h2{max-width:600px;margin:0 auto 20px;}
.cta-section p{color:var(--muted);max-width:400px;margin:0 auto 40px;}
.cta-btns{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;}

/* NEWSLETTER */
.newsletter{padding:clamp(60px,8vw,100px) 0;background:var(--surf);border-top:1px solid var(--border);border-bottom:1px solid var(--border);}
.newsletter-inner{display:grid;grid-template-columns:1fr 1fr;gap:clamp(40px,6vw,80px);align-items:center;}
.newsletter-form{display:flex;gap:0;}
.newsletter-form input{flex:1;background:var(--card);border:1px solid var(--border);border-right:none;padding:14px 20px;color:var(--text);font-family:'Jost',sans-serif;font-size:14px;outline:none;border-radius:4px 0 0 4px;}
.newsletter-form input::placeholder{color:var(--muted);}
.newsletter-form input:focus{border-color:var(--gold);}
.newsletter-form button{background:var(--grad);color:#000;border:none;padding:14px 28px;font-family:'Jost',sans-serif;font-weight:600;font-size:13px;letter-spacing:0.1em;text-transform:uppercase;cursor:pointer;border-radius:0 4px 4px 0;transition:opacity .2s;}
.newsletter-form button:hover{opacity:0.9;}
@media(max-width:768px){.newsletter-inner{grid-template-columns:1fr;}.newsletter-form{flex-direction:column;}.newsletter-form input,.newsletter-form button{border-radius:4px;border-right:1px solid var(--border);}  }

/* FOOTER */
footer{padding:clamp(60px,8vw,100px) 0 32px;background:var(--surf);}
.footer-top{display:grid;grid-template-columns:1.5fr 1fr 1fr 1fr;gap:clamp(32px,5vw,64px);padding-bottom:clamp(40px,6vw,64px);border-bottom:1px solid var(--border);}
.footer-brand .logo{font-size:20px;margin-bottom:16px;display:block;}
.footer-brand p{font-size:13px;color:var(--muted);line-height:1.8;max-width:240px;}
.footer-col h4{font-family:'Jost',sans-serif;font-size:11px;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);margin-bottom:20px;}
.footer-col ul{list-style:none;display:flex;flex-direction:column;gap:12px;}
.footer-col ul li a{font-size:13px;color:var(--muted);transition:color .2s;}
.footer-col ul li a:hover{color:var(--gold);}
.footer-bottom{display:flex;justify-content:space-between;align-items:center;padding-top:28px;flex-wrap:wrap;gap:16px;}
.footer-bottom p{font-size:12px;color:var(--muted);}
.footer-social{display:flex;gap:16px;}
.footer-social a{width:36px;height:36px;border:1px solid var(--border);border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--muted);transition:all .2s;}
.footer-social a:hover{border-color:var(--gold);color:var(--gold);}
@media(max-width:900px){.footer-top{grid-template-columns:1fr 1fr;}}
@media(max-width:500px){.footer-top{grid-template-columns:1fr;}.footer-bottom{flex-direction:column;text-align:center;}}

/* SCROLLBAR */
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:var(--bg);}
::-webkit-scrollbar-thumb{background:var(--gold);border-radius:2px;}
</style>
</head>
<body>

<!-- NAV -->
<nav>
  <a class="logo grad-text" href="#">Parfum Luxe</a>
  <div class="nav-links" id="navLinks">
    <a href="#products">Collection</a>
    <a href="#story">Maison</a>
    <a href="#testimonials">Reviews</a>
    <a href="#contact">Contact</a>
    <a href="#products" class="btn btn-gold" style="padding:10px 24px;font-size:13px;">Shop Now</a>
  </div>
  <button class="hamburger" onclick="document.getElementById('navLinks').classList.toggle('open')">☰</button>
</nav>

<!-- HERO -->
<section class="hero" id="hero">
  <div class="hero-text">
    <div class="hero-kicker">
      <span></span>
      <p class="eyebrow">Fine Fragrances Since 1923</p>
    </div>
    <h1 class="hero-title reveal">The Art<br>of <em class="grad-text">Elegance</em></h1>
    <p class="hero-desc reveal">Crafted from the rarest ingredients, each Parfum Luxe fragrance is a journey through time — a whisper of identity you carry with you always.</p>
    <div class="hero-ctas reveal">
      <a href="#products" class="btn btn-gold">Explore Collection</a>
      <a href="#story" class="btn btn-outline">Our Story</a>
    </div>
    <div class="hero-trust reveal">
      <div class="hero-trust-line"></div>
      <p class="hero-trust-text">As seen in Vogue · Harper's Bazaar · Elle</p>
    </div>
  </div>
  <div class="hero-image">
    <img src="https://images.unsplash.com/https://picsum.photos/seed/luxhero/900/1100" alt="Luxury perfume bottle">
    <div class="hero-badge reveal">
      <div class="hero-badge-num grad-text">12</div>
      <div class="hero-badge-label">Exclusive Scents</div>
    </div>
  </div>
</section>

<!-- MARQUEE -->
<div class="marquee-wrap">
  <div class="marquee-track">
    <div class="marquee-item"><span class="marquee-dot"></span>Free shipping over ₹4,999</div>
    <div class="marquee-item"><span class="marquee-dot"></span>100% Authentic Ingredients</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Handcrafted in Grasse, France</div>
    <div class="marquee-item"><span class="marquee-dot"></span>30-Day Returns</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Gift Wrapping Available</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Vegan &amp; Cruelty-Free</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Free shipping over ₹4,999</div>
    <div class="marquee-item"><span class="marquee-dot"></span>100% Authentic Ingredients</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Handcrafted in Grasse, France</div>
    <div class="marquee-item"><span class="marquee-dot"></span>30-Day Returns</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Gift Wrapping Available</div>
    <div class="marquee-item"><span class="marquee-dot"></span>Vegan &amp; Cruelty-Free</div>
  </div>
</div>

<!-- PRODUCTS -->
<section class="products" id="products">
  <div class="container">
    <div class="section-header">
      <div>
        <p class="eyebrow">The Collection</p>
        <h2 class="reveal">Signature Fragrances</h2>
      </div>
      <a href="#" class="btn btn-outline reveal">View All</a>
    </div>
    <div class="products-grid">
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf1/600/420" alt="Grace Femme">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Grace Femme</h3>
          <p class="product-family">Floral · Oriental</p>
          <p class="product-price">₹8,499</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf2/600/420" alt="Noir Absolu">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Noir Absolu</h3>
          <p class="product-family">Woody · Aromatic</p>
          <p class="product-price">₹11,299</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf3/600/420" alt="Ambre Précieux">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Ambre Précieux</h3>
          <p class="product-family">Amber · Vanilla</p>
          <p class="product-price">₹9,799</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf4/600/420" alt="Rose Imperiale">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Rose Impériale</h3>
          <p class="product-family">Rose · Musk</p>
          <p class="product-price">₹7,999</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf5/600/420" alt="Oud Royal">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Oud Royal</h3>
          <p class="product-family">Oud · Resinous</p>
          <p class="product-price">₹14,999</p>
        </div>
      </div>
      <div class="product-card reveal">
        <img src="https://images.unsplash.com/https://picsum.photos/seed/perf6/600/420" alt="Cèdre Blanc">
        <div class="product-overlay">
          <a href="#" class="btn btn-gold" style="align-self:flex-start;">Add to Cart</a>
        </div>
        <div class="product-info">
          <h3 class="product-name">Cèdre Blanc</h3>
          <p class="product-family">Cedar · Fresh</p>
          <p class="product-price">₹6,999</p>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- STORY -->
<section class="story container" id="story">
  <div class="story-img reveal">
    <div class="story-year">1923</div>
    <img src="https://images.unsplash.com/https://picsum.photos/seed/story1/700/600" alt="Our Story">
    <div class="story-img-accent">
      <img src="https://images.unsplash.com/https://picsum.photos/seed/detail1/200/200" alt="Ingredient detail">
    </div>
  </div>
  <div class="story-text">
    <p class="eyebrow reveal">Maison Parfum Luxe</p>
    <h2 class="reveal">A Century of Craftsmanship</h2>
    <p class="reveal" style="margin-top:24px;">Born in the sun-drenched flower fields of Grasse, France, Parfum Luxe was founded by master perfumer Henri Beaumont in 1923. His singular vision: that fragrance is not a luxury — it is a language.</p>
    <p class="reveal">Today, three generations later, we source only the finest raw materials — Bulgarian rose attar, Madagascan vanilla, rare Indian oud — and transform them into scents that leave an impression long after you've left the room.</p>
    <div class="story-stats reveal">
      <div>
        <div class="stat-num grad-text">100+</div>
        <div class="stat-label">Years of expertise</div>
      </div>
      <div>
        <div class="stat-num grad-text">12</div>
        <div class="stat-label">Signature scents</div>
      </div>
      <div>
        <div class="stat-num grad-text">34</div>
        <div class="stat-label">Countries shipped</div>
      </div>
      <div>
        <div class="stat-num grad-text">98%</div>
        <div class="stat-label">Customer satisfaction</div>
      </div>
    </div>
    <a href="#products" class="btn btn-gold reveal">Discover the Collection</a>
  </div>
</section>

<!-- FEATURES -->
<section class="features" id="features">
  <div class="container">
    <p class="eyebrow reveal">Why Parfum Luxe</p>
    <h2 class="reveal">The Difference Is in the Detail</h2>
    <div class="features-grid">
      <div class="feature-item reveal">
        <div class="feature-icon">🌹</div>
        <h3>Rare Ingredients</h3>
        <p>We source Bulgarian rose, oud, and vanilla directly from their origin — never synthetic substitutes.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">🤝</div>
        <h3>Handcrafted Batches</h3>
        <p>Each fragrance is made in small batches by master perfumers trained in Grasse, France.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">🌿</div>
        <h3>Vegan &amp; Cruelty-Free</h3>
        <p>Every product is certified vegan and never tested on animals — beauty with conscience.</p>
      </div>
      <div class="feature-item reveal">
        <div class="feature-icon">♻️</div>
        <h3>Sustainable Packaging</h3>
        <p>Our bottles are refillable and our packaging is made from recycled materials.</p>
      </div>
    </div>
  </div>
</section>

<!-- TESTIMONIALS -->
<section class="testimonials" id="testimonials">
  <div class="container">
    <p class="eyebrow reveal">Client Stories</p>
    <h2 class="reveal">Scents That Stay</h2>
    <div class="testimonials-grid">
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"Grace Femme is unlike anything I have worn before. People stop me on the street to ask what I'm wearing. Worth every rupee."</p>
        <div class="testi-author">
          <div class="testi-avatar">P</div>
          <div>
            <div class="testi-name">Priya Sharma</div>
            <div class="testi-role">Mumbai · Verified Purchase</div>
          </div>
        </div>
      </div>
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"Oud Royal was a gift to myself and it has become my signature scent. Dark, rich, and utterly confident. Absolutely magnificent."</p>
        <div class="testi-author">
          <div class="testi-avatar">R</div>
          <div>
            <div class="testi-name">Rohan Mehra</div>
            <div class="testi-role">Delhi · Verified Purchase</div>
          </div>
        </div>
      </div>
      <div class="testi-card reveal">
        <div class="testi-stars">★★★★★</div>
        <p class="testi-text">"The packaging alone made me feel I was opening something from Paris. The scent lasted 18 hours. I am never going back to another brand."</p>
        <div class="testi-author">
          <div class="testi-avatar">A</div>
          <div>
            <div class="testi-name">Anika Joshi</div>
            <div class="testi-role">Bengaluru · Verified Purchase</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="cta-section" id="contact">
  <div class="container">
    <p class="eyebrow reveal">Limited Edition</p>
    <h2 class="reveal">Begin Your Scent Journey</h2>
    <p class="reveal">Try our Discovery Set — 5 bestselling fragrances in travel sizes, delivered to your door.</p>
    <div class="cta-btns reveal">
      <a href="#products" class="btn btn-gold">Shop Discovery Set — ₹2,499</a>
      <a href="mailto:hello@parfumluxe.com" class="btn btn-outline">Contact Us</a>
    </div>
  </div>
</section>

<!-- NEWSLETTER -->
<div class="newsletter">
  <div class="container">
    <div class="newsletter-inner">
      <div>
        <p class="eyebrow">Stay Connected</p>
        <h3 style="font-size:clamp(22px,3vw,30px);">Exclusive Releases &amp;<br>Private Offers</h3>
        <p style="color:var(--muted);font-size:14px;margin-top:8px;">Join 12,000+ fragrance lovers. No spam, ever.</p>
      </div>
      <form class="newsletter-form" onsubmit="event.preventDefault();this.querySelector('button').textContent='✓ Subscribed';">
        <input type="email" placeholder="Your email address" required>
        <button type="submit">Subscribe</button>
      </form>
    </div>
  </div>
</div>

<!-- FOOTER -->
<footer>
  <div class="container">
    <div class="footer-top">
      <div class="footer-brand">
        <span class="logo grad-text">Parfum Luxe</span>
        <p>Fine fragrances handcrafted in the tradition of Grasse, France. Since 1923.</p>
      </div>
      <div class="footer-col">
        <h4>Collection</h4>
        <ul>
          <li><a href="#">Women's Fragrances</a></li>
          <li><a href="#">Men's Fragrances</a></li>
          <li><a href="#">Unisex Editions</a></li>
          <li><a href="#">Discovery Sets</a></li>
          <li><a href="#">Gift Collections</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Maison</h4>
        <ul>
          <li><a href="#">Our Story</a></li>
          <li><a href="#">Craftsmanship</a></li>
          <li><a href="#">Ingredients</a></li>
          <li><a href="#">Sustainability</a></li>
          <li><a href="#">Press</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h4>Support</h4>
        <ul>
          <li><a href="#">Shipping &amp; Returns</a></li>
          <li><a href="#">FAQ</a></li>
          <li><a href="#">Track Order</a></li>
          <li><a href="#">Contact Us</a></li>
          <li><a href="#">Privacy Policy</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2026 Parfum Luxe. All rights reserved.</p>
      <div class="footer-social">
        <a href="#" aria-label="Instagram">📷</a>
        <a href="#" aria-label="Facebook">f</a>
        <a href="#" aria-label="Pinterest">P</a>
      </div>
    </div>
  </div>
</footer>

<script>
// Scroll reveal
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

// Sticky nav background
window.addEventListener('scroll', () => {
  document.querySelector('nav').style.background = window.scrollY > 60 ? 'rgba(5,4,0,0.95)' : 'rgba(5,4,0,0.8)';
});

// Mobile nav close on link click
document.querySelectorAll('#navLinks a').forEach(a => {
  a.addEventListener('click', () => document.getElementById('navLinks').classList.remove('open'));
});
</script>
</body>
</html>
`,
};

const TEMPLATE_ALIASES: Record<string, string> = { app: "mobile-app", perfume: "luxury", store: "luxury", ecommerce: "luxury", "parfume": "luxury", "fragrance": "luxury" };

export function getWebsiteTemplate(projectType: string): string | null {
  const key = TEMPLATE_ALIASES[projectType] || projectType;
  return WEBSITE_TEMPLATES[key] || null;
}

export function hasWebsiteTemplate(projectType: string): boolean {
  const key = TEMPLATE_ALIASES[projectType] || projectType;
  return key in WEBSITE_TEMPLATES;
}
