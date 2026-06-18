/**
 * KRYPTON AI — Game Builder Engine
 * Detects game type, builds system prompt, manages game memory
 * Does NOT modify website builder pipeline
 */

// ── Product Completion Engine (quality audit + auto-expansion) ────
export {
  auditGameHTML,
  getRequiredFeatures,
  buildFeatureChecklistPrompt,
  type FeatureCheck,
  type AuditResult,
} from "./quality-audit";
import { buildFeatureChecklistPrompt } from "./quality-audit";
import { getGameTemplate, hasGameTemplate } from "@/lib/completion-engine/templates";
import type { ProjectBlueprint } from "@/lib/completion-engine/blueprint";

// ── Game Memory System ─────────────────────────────────────────────
export interface GameProjectMemory {
  gameType:      string;   // "racing" | "platformer" | "shooter" etc
  theme:         string;   // "cyberpunk" | "space" | "fantasy" etc
  genre:         string;   // "arcade" | "rpg" | "strategy" etc
  artStyle:      string;   // "pixel" | "neon" | "realistic" | "cartoon"
  controls:      string;   // "keyboard" | "touch" | "both"
  techStack:     string;   // "html5" | "phaser" | "threejs"
  players:       number;   // 1 | 2
  levels:        number;
  characters:    string[];
  enemies:       string[];
  weapons:       string[];
  powerups:      string[];
  scoringSystem: string;
  gameRules:     string;
  uiTheme:       string;
  audioEnabled:  boolean;
  physicsEngine: string;
  editHistory:   string[];
  lastPrompt:    string;
  features:      string[];
  // Phase 7 — Memory Engine: store the project blueprint so edits
  // modify against it instead of re-deriving context each time.
  blueprint?:    ProjectBlueprint;
}

// ── Game Type Detection ────────────────────────────────────────────
export function detectGameType(prompt: string): {
  isGame: boolean;
  gameType: string;
  genre: string;
  theme: string;
  techStack: string;
} {
  const p = prompt.toLowerCase();

  // Is it a game request?
  const gameWords = [
    'game', 'gaming', 'arcade', 'score', 'player',
    'snake game', 'tetris', 'mario', 'pacman', 'flappy', 'dino game', 'pong',
    'chess game', 'checkers game', 'sudoku', 'wordle game', 'crossword game',
    'shooter game', 'fps game', 'rpg game', 'platformer game', 'endless runner',
    'racing game', 'drift game', 'car game', 'kart game',
    'zombie game', 'battle royale', 'tower defense',
    'fighting game', 'boxing game',
    'match-3', 'block game', 'merge game',
    'tycoon game', 'city builder game', 'minecraft like',
    'space game', 'alien game', 'asteroid game',
    'dungeon game', 'adventure game',
    'multiplayer game',
    'flappy bird', 'angry birds', 'candy crush',
    'make a game', 'create a game', 'build a game',
  ];
  const isGame = gameWords.some(w => p.includes(w));

  if (!isGame) return { isGame: false, gameType: 'website', genre: '', theme: '', techStack: 'html5' };

  // Detect specific game type
  let gameType = 'arcade';
  if (/snake|worm/.test(p))                           gameType = 'snake';
  else if (/tetris|block.*fall|falling.*block/.test(p)) gameType = 'tetris';
  else if (/mario|platformer|jump.*run|super.*platform/.test(p)) gameType = 'platformer';
  else if (/pacman|pac.man|dot.*eat/.test(p))          gameType = 'pacman';
  else if (/racing|car.*race|drift|kart|formula|speed/.test(p)) gameType = 'racing';
  else if (/shooter|shoot|bullet|gun|fps|space.*invader/.test(p)) gameType = 'shooter';
  else if (/zombie|undead|survival|apocalypse/.test(p)) gameType = 'survival';
  else if (/flappy|bird.*fly|tap.*fly/.test(p))        gameType = 'flappy';
  else if (/chess|checkers/.test(p))                   gameType = 'chess';
  else if (/puzzle|match.3|block.*merge|slide/.test(p)) gameType = 'puzzle';
  else if (/rpg|dungeon|quest|adventure.*role/.test(p)) gameType = 'rpg';
  else if (/tower.*defense|td.*game|defend.*base/.test(p)) gameType = 'tower-defense';
  else if (/cricket|football|soccer|basketball|sport/.test(p)) gameType = 'sports';
  else if (/gta|open.world|sandbox|city.*crime/.test(p)) gameType = 'openworld';
  else if (/space|galaxy|asteroid|alien.*shoot/.test(p)) gameType = 'space-shooter';
  else if (/runner|endless.*run|dino|infinite.*run/.test(p)) gameType = 'runner';
  else if (/fighting|brawl|boxing|combat/.test(p))     gameType = 'fighting';
  else if (/strategy|rts|city.*build|tycoon|sim/.test(p)) gameType = 'strategy';
  else if (/pong|ping.pong|ball.*paddle/.test(p))      gameType = 'pong';
  else if (/breakout|brick.*break|arkanoid/.test(p))   gameType = 'breakout';
  else if (/clicker|idle|tap.*earn|cookie/.test(p))    gameType = 'clicker';

  // Detect genre
  let genre = 'arcade';
  if (['platformer','runner','flappy','mario'].includes(gameType)) genre = 'platformer';
  else if (['shooter','space-shooter','survival'].includes(gameType)) genre = 'action';
  else if (['rpg','openworld'].includes(gameType)) genre = 'rpg';
  else if (['chess','puzzle','sudoku'].includes(gameType)) genre = 'puzzle';
  else if (['racing'].includes(gameType)) genre = 'racing';
  else if (['sports','cricket','football'].includes(gameType)) genre = 'sports';
  else if (['strategy','tower-defense'].includes(gameType)) genre = 'strategy';
  else if (['clicker'].includes(gameType)) genre = 'idle';

  // Detect theme
  let theme = 'dark';
  if (/neon|cyber|cyberpunk|futur/.test(p))            theme = 'neon-cyberpunk';
  else if (/space|galaxy|cosmic|star.*war/.test(p))    theme = 'space';
  else if (/fantasy|magic|wizard|dragon|medieval/.test(p)) theme = 'fantasy';
  else if (/pixel|retro|8.bit|arcade/.test(p))         theme = 'retro-pixel';
  else if (/zombie|horror|dark|gothic/.test(p))        theme = 'dark-horror';
  else if (/cartoon|colorful|cute|kawaii/.test(p))     theme = 'cartoon';
  else if (/nature|jungle|forest|underwater/.test(p))  theme = 'nature';
  else if (/city|urban|street|gta/.test(p))            theme = 'urban';

  // Choose tech stack
  let techStack = 'html5';
  if (['rpg','openworld','strategy'].includes(gameType))   techStack = 'phaser';
  else if (/3d|three\.?js|first.*person/.test(p))          techStack = 'threejs';

  return { isGame: true, gameType, genre, theme, techStack };
}

// ── Build Game Project Memory ──────────────────────────────────────
export function buildGameMemory(
  html: string,
  prompt: string,
  detected: ReturnType<typeof detectGameType>,
  prev?: GameProjectMemory | null,
  blueprint?: ProjectBlueprint
): GameProjectMemory {
  const editHistory = prev?.editHistory || [];
  if (prompt && !editHistory.includes(prompt)) editHistory.push(prompt);

  return {
    gameType:      detected.gameType,
    theme:         detected.theme,
    genre:         detected.genre,
    artStyle:      /pixel|retro/i.test(html) ? 'pixel' : 'smooth',
    controls:      'keyboard+touch',
    techStack:     detected.techStack,
    players:       /multiplayer|2.*player/i.test(prompt) ? 2 : 1,
    levels:        parseInt(html.match(/level.*?(\d+)/i)?.[1] || '0') || 5,
    characters:    [],
    enemies:       [],
    weapons:       [],
    powerups:      (html.match(/powerup|power.up|boost/gi) || []).slice(0, 5),
    scoringSystem: html.includes('localStorage') ? 'persistent' : 'session',
    gameRules:     `${detected.gameType} game — ${detected.theme} theme`,
    uiTheme:       detected.theme,
    audioEnabled:  html.includes('AudioContext') || html.includes('new Audio'),
    physicsEngine: html.includes('gravity') ? 'custom' : 'none',
    editHistory:   editHistory.slice(-10),
    lastPrompt:    prompt,
    features:      extractGameFeatures(html),
    // Preserve existing blueprint on edits unless a new one is provided
    blueprint:     blueprint || prev?.blueprint,
  };
}

function extractGameFeatures(html: string): string[] {
  const feats: string[] = [];
  if (html.includes('localStorage'))     feats.push('highscore');
  if (html.includes('AudioContext'))     feats.push('sound');
  if (html.includes('touchstart'))       feats.push('mobile-controls');
  if (html.includes('particle'))         feats.push('particles');
  if (html.includes('powerup') || html.includes('power-up')) feats.push('powerups');
  if (html.includes('level'))            feats.push('levels');
  if (html.includes('lives') || html.includes('life')) feats.push('lives');
  if (html.includes('achievement'))      feats.push('achievements');
  if (html.includes('requestAnimationFrame')) feats.push('smooth-animation');
  return feats;
}

// ── Format Game Memory for AI ──────────────────────────────────────
export function formatGameMemoryForAI(mem: GameProjectMemory): string {
  const blueprintLine = mem.blueprint
    ? `║ Pages/States: ${mem.blueprint.pages.join(', ')}\n║ Components:   ${mem.blueprint.components.join(', ')}\n`
    : '';
  return `╔═ KRYPTON GAME MEMORY ═══════════════════════╗
║ Game Type:    ${mem.gameType}
║ Genre:        ${mem.genre}
║ Theme:        ${mem.theme}
║ Art Style:    ${mem.artStyle}
║ Tech Stack:   ${mem.techStack}
║ Players:      ${mem.players}
║ Controls:     ${mem.controls}
║ Features:     ${mem.features.join(', ')}
║ Audio:        ${mem.audioEnabled ? 'enabled' : 'disabled'}
${blueprintLine}╠═ PRESERVE THESE EXACTLY ════════════════════╣
║ Game type, controls, scoring, lives system
║ Only add/change what user requested
╠═ EDIT HISTORY ══════════════════════════════╣
${mem.editHistory.map((e, i) => `║ ${i + 1}. ${e.slice(0, 65)}`).join('\n') || '║ First edit'}
╚══════════════════════════════════════════════╝`;
}

// ── Get Game System Prompt by Type ────────────────────────────────
export function getGameSystemPrompt(gameType: string, theme: string, userPrompt: string, isEdit: boolean = false): string {
  const BASE = `You are Krypton Game Engine — world's best browser game developer.

OUTPUT RULES (ABSOLUTE — HIGHEST PRIORITY):
1. Output ONLY raw HTML starting with <!DOCTYPE html> ending with </html>
2. No markdown, no backticks, no explanations — raw HTML only
3. ALL CSS in <style> in <head>
4. ALL JavaScript in <script> before </body>
5. Game must be FULLY PLAYABLE immediately — not just a menu screen
6. CRITICAL: The </html> closing tag MUST be the very last thing you output.
   You have a token budget — write CONCISE, working code over verbose code.
   Prefer compact code (minified-style, short variable names if needed) over
   comments and whitespace. A complete 400-line working game beats an
   incomplete 900-line broken one. NEVER stop mid-function.
7. canvas.width = window.innerWidth; canvas.height = window.innerHeight; (ALWAYS full screen)
8. requestAnimationFrame game loop running on page load
9. Web Audio API for sounds (beeps, clicks, death sound)
10. localStorage for high score persistence
11. If running low on token budget, prioritize in this order: (1) working game
    loop + controls + collision, (2) HUD + scoring, (3) sound, (4) particles/
    polish. Always finish with a valid </html>.

UNIVERSAL GAME REQUIREMENTS:
- Full-screen canvas (100vw × 100vh)
- HUD always visible: Score (top-left), Level (top-center), Lives as hearts (top-right)
- Particle system for: collect, kill, death, level-up
- 3 lives system — player respawns, shows death animation
- High score in localStorage — persists across sessions
- BOTH keyboard (arrows/WASD/space) AND mobile touch controls
- Mobile: virtual D-pad bottom-left, action buttons bottom-right
- Game states: menu → playing → paused → gameover
- Pause: press P or ESC
- Restart: press R or click Restart button
- Level progression — difficulty increases each level
- Game Over screen with final score, high score, Restart button
- Premium dark theme — colors: #0a0a0a bg, neon accent based on game type

USER REQUEST: ${userPrompt}
GAME TYPE: ${gameType}
THEME: ${theme}`;

  const GAME_SPECIFICS: Record<string, string> = {
    snake: `
SNAKE GAME REQUIREMENTS:
- Grid-based movement (20x20 cell grid)
- Snake grows when eating food — increases score
- Speed increases every 5 foods eaten
- Multiple food types: normal (+10), golden (+50, rare), power (+30 with effect)
- Power-ups: speed boost, invincibility shield, score multiplier
- Walls kill snake — or wall-wrap mode (toggle option)
- Smooth direction input buffering (queue next direction)
- Color: neon green snake #39FF14, red food #FF3939, gold food #FFD700
- Background grid: subtle dark lines on #0a0a0a`,

    tetris: `
TETRIS GAME REQUIREMENTS:
- 7 classic tetrominoes (I,O,T,S,Z,J,L) with proper colors
- Ghost piece showing where piece will land
- Hold piece (press C to hold)
- Next piece preview (show next 3 pieces)
- Hard drop (Space), soft drop (down arrow), rotate (up/Z/X)
- Line clear: 1=100, 2=300, 3=500, 4=800 (Tetris) × level multiplier
- Level up every 10 lines — speed increases
- T-spin detection bonus
- Lock delay — piece locks 0.5s after landing
- Color: each piece unique neon color on dark bg`,

    platformer: `
PLATFORMER GAME REQUIREMENTS:
- Gravity: 0.5, Jump velocity: -14, Max fall: 15
- Player: 40×50px with smooth acceleration/deceleration
- Multiple platform types: solid, moving (horizontal/vertical), breakable
- Enemies: walk left-right, bounce at edges, player stomps to kill
- Coins scattered on platforms — collect for score
- Checkpoints — respawn here after death
- Power-ups: double-jump, speed boost, invincibility star
- Camera follows player horizontally with dead zone
- Parallax background layers (2-3 layers)
- Level: 3000px wide, scrolling horizontally
- Flag/door at end triggers level complete`,

    racing: `
RACING GAME REQUIREMENTS:
- Top-down racing perspective
- Player car: smooth steering with momentum physics
- Track: winding road rendered with bezier curves OR tile-based
- 3-5 AI opponent cars with pathfinding
- Nitro boost mechanic (N key or button)
- Drift mechanics (hold brake + steer)
- Lap counter — 3 laps to finish
- Position display (1st, 2nd, 3rd...)
- Speed-o-meter on HUD
- Tyre marks/skid marks when drifting
- Start countdown: 3-2-1-GO with sound`,

    'space-shooter': `
SPACE SHOOTER REQUIREMENTS:
- Vertical scrolling starfield background (parallax, 3 layers)
- Player ship at bottom — move left/right — auto-fire or space/click to shoot
- Enemy waves: formation patterns (V, line, spiral, random)
- Boss every 5 levels: large enemy with multiple phases and attack patterns
- Bullet patterns: straight, spread shot, laser beam
- Power-ups falling: rapid fire, spread shot, shield, bomb
- Shield: absorbs 3 hits before breaking
- Screen-clearing bomb (B key, limited uses)
- Enemy drops: score pickups, rare power-ups
- Explosion animations with particles`,

    survival: `
ZOMBIE SURVIVAL REQUIREMENTS:
- Top-down shooter perspective
- Player moves with WASD — mouse/joystick aims and shoots
- Waves of zombies — wave number on HUD
- Multiple zombie types: slow/fast/tank/exploder
- Weapons: pistol (infinite), shotgun, SMG, grenade (limited)
- Weapon pickup system — find ammo boxes
- Health bar — medkits scattered or dropped by zombies
- XP system — kill zombies for XP — level up unlocks upgrades
- Upgrades: speed, damage, fire rate, max health
- Barricades: wooden walls player can place (limited)
- Day counter — survive days`,

    rpg: `
RPG GAME REQUIREMENTS:
- Top-down tile-based world (32px tiles)
- Player with animated sprites (walking 4 directions)
- NPC characters with dialog bubbles
- Turn-based OR action combat system
- Stats: HP, MP, Attack, Defense, Speed
- Inventory: 6 slots for items/weapons/armor
- Quest system: main quest + 2 side quests in HUD
- Shop NPC: buy/sell items with gold currency
- Level up: gain XP from kills, stat increases shown
- Multiple areas: town, dungeon, boss room
- Simple dialog system: click NPC to talk`,

    'tower-defense': `
TOWER DEFENSE REQUIREMENTS:
- Grid-based map with a path for enemies to follow
- Enemy waves: 5 enemy types with different HP/speed
- Tower types: Basic (cheap), Sniper (range), Splash (area), Slow, Laser
- Tower placement: click empty grid cell to place
- Tower upgrade: click placed tower, spend gold
- Gold: starts at 200, earn from kills
- Lives: 20 starting lives, lose one per enemy that reaches end
- Wave counter and Next Wave button
- Tower range shown on hover
- Sell tower for 50% refund
- Special abilities: lightning strike, freeze all`,

    openworld: `
OPEN WORLD / GTA-STYLE REQUIREMENTS:
- Large scrolling 2D world (3000×3000px virtual map)
- Mini-map in corner showing player position and key locations
- Player car (or on foot) — switch with F key
- Multiple vehicles to steal/enter
- NPCs walking around (simple path following)
- Buildings: interactive doors, shops, safe house
- Police system: 3 wanted stars
- Objectives/missions: markers on map (★)
- Day/night cycle (every 3 minutes)
- Money system: earn from missions, spend at shops
- Weapons: pickup from ground or buy`,

    flappy: `
FLAPPY BIRD REQUIREMENTS:
- Gravity constantly pulls player down
- Tap/click/space = upward flap with velocity
- Pipes spawn from right with random gap height
- Gap gets smaller every 10 points
- Parallax background: sky, mountains, ground layers
- Score increments when passing each pipe pair
- Medal system: Bronze 10, Silver 20, Gold 40, Platinum 60
- Best score saved to localStorage
- Satisfying flap sound, hit sound, score sound
- Pipe colors: neon green, collision flash red`,

    sports: `
SPORTS GAME REQUIREMENTS:
- Cricket: batting (time swing), bowling (aim+power), fielding AI
- Football/Soccer: top-down, dribble+pass+shoot, goalkeeper AI
- Basketball: aim arc, power bar, 3-point line bonus
- Responsive controls — keyboard + mobile touch buttons
- Score board: Team vs Team, time remaining
- AI opponent — adjusts difficulty per level
- Crowd cheer sound on score
- Replay effect on goals/boundaries
- Tournament mode: 5 matches to win championship`,

    puzzle: `
PUZZLE GAME REQUIREMENTS:
- 5×5 or larger grid (type-dependent)
- Match-3: swap adjacent tiles, match 3+ removes, gravity fills gaps
- Sokoban: push boxes to targets with undo (U) feature
- Sliding puzzle: 15-puzzle with shuffle
- Move counter + Timer on HUD
- Undo button (U key or button)
- Hint button — briefly shows a valid move
- Level complete animation — star rating (1-3 stars based on moves)
- 20+ levels of increasing difficulty
- Color scheme: colorful on dark background`,

    clicker: `
IDLE CLICKER REQUIREMENTS:
- Main click target in center — satisfying animation on click
- Click counter displayed large
- Passive income system: buy upgrades that auto-click
- 8+ upgrade types: each has name, cost, income rate, icon
- Prestige system after reaching 1M clicks
- Achievement badges: milestones at 100, 1K, 10K clicks
- Animated numbers flying up on click (+1, +5, etc)
- Dark theme with golden accent colors
- Auto-save to localStorage every 30 seconds`,

    pong: `
PONG REQUIREMENTS:
- Classic 2-player (W/S vs Up/Down) OR 1-player vs AI
- Ball physics: angle depends on where it hits paddle
- Speed increases after every 5 hits
- Score first to 10 wins
- AI difficulty: tracks ball with slight delay for fairness
- Particle trail behind ball
- Screen flash on point scored
- Serve: press space to launch ball`,

    breakout: `
BREAKOUT / ARKANOID REQUIREMENTS:
- Paddle at bottom (mouse or left/right arrows)
- Ball bounces off walls, ceiling, paddle, bricks
- Brick grid: multiple colors, different HP (1-3 hits)
- Power-ups falling from destroyed bricks: extra life, wide paddle, multi-ball, laser
- Multiple balls possible (up to 3 with multi-ball)
- 10+ levels with different brick patterns
- Indestructible (gold) bricks for obstacles
- Boss brick: large brick requiring many hits`,

    chess: `
CHESS / BOARD GAME REQUIREMENTS:
- Full 8×8 chessboard with proper colors
- All 12 piece types with Unicode chess symbols (♔♕♖♗♘♙♚♛♜♝♞♟)
- Legal move validation: each piece moves correctly
- Highlight: selected piece (blue), valid moves (green dots)
- Check detection and checkmate detection
- Simple AI: random legal moves OR minimax depth-2
- Turn indicator on HUD
- Move history list (algebraic notation)
- Captured pieces displayed
- Undo last move button`,

    fighting: `
FIGHTING GAME REQUIREMENTS:
- 2 characters facing each other (P1 left, P2/AI right)
- Health bars at top for each player
- Moves: Walk (left/right), Jump (up), Crouch (down), Punch (A), Kick (S), Block (D)
- Special moves: charge + attack combos
- Hit detection with damage values
- Stun animation when hit
- Round system: first to win 2 rounds
- Combo counter displayed when multi-hit
- Character select screen (2+ characters)
- Screen shake on heavy hit`,

    pacman: `
PACMAN-STYLE GAME REQUIREMENTS:
- Maze grid (tile-based, walls block movement)
- Player moves with arrows/WASD — smooth grid-aligned movement
- Dots scattered through maze — collect all to win
- 3-4 ghosts with simple chase AI (move toward player with some randomness)
- Power pellets: eating one lets player eat ghosts for ~8 seconds (ghosts flee/blue)
- Lives: 3, lose one when caught by ghost (not powered up)
- Score: dots = 10pts, power pellet = 50pts, ghost eaten = 200pts
- Win condition: all dots collected — show victory screen, then next maze
- Tunnel wrap-around on maze edges (optional but classic)`,

    shooter: `
SHOOTER GAME REQUIREMENTS (top-down or side-view):
- Player character with shoot mechanic (Space/click = fire bullet)
- Bullets travel in straight line, despawn off-screen
- Enemy waves: enemies spawn from top/sides, move toward/past player
- Bullet-enemy collision: destroy enemy + particle effect + score
- Enemy-player collision: lose health/life, brief invincibility flash
- Health or lives system (3 lives or 100 HP bar)
- Power-ups: rapid fire, spread shot, shield — fall from destroyed enemies
- Wave counter — difficulty increases each wave (more enemies, faster)
- Game over when health/lives reach 0 — show final score + restart`,

    runner: `
ENDLESS RUNNER REQUIREMENTS:
- Player auto-runs forward (or world scrolls toward player) at constant then increasing speed
- Jump (Space/Up/tap) and duck/slide (Down/swipe-down) mechanics with proper physics
- Obstacles spawn at randomized intervals — variety of types (low, high, wide)
- Collision with obstacle = game over (or lose a life if lives system used)
- Score increases continuously based on distance traveled
- Speed increases gradually over time/distance — visible difficulty ramp
- Collectibles (coins/gems) along the path add to score
- High score saved to localStorage, game over screen with restart`,

    strategy: `
STRATEGY GAME REQUIREMENTS:
- Grid or zone-based map for placing units/buildings
- Resource system (e.g. gold/wood) that accumulates over time or from actions
- Build/place units or structures by spending resources (click grid cell)
- Enemy AI: opposing units/base that attacks or expands over time
- Combat resolution when units meet (simple HP-based combat)
- Win condition: destroy enemy base / survive N turns / accumulate target resources
- Lose condition: own base destroyed or resources depleted
- UI: resource counters, unit selection, simple turn or real-time indicator`,

    arcade: `
ARCADE GAME REQUIREMENTS (general):
- Clear core loop: player acts, world reacts, score updates
- Enemies or obstacles that move and can be avoided/destroyed/collected
- Collision detection between player and all interactive objects
- Score system visible on HUD, increments on player actions
- Level/wave progression — difficulty visibly increases over time
- Power-ups that temporarily change player abilities
- Lives or health, game over screen with final score + restart button
- Clear win or "survive as long as possible" framing communicated to player`,
  };

  const specific = GAME_SPECIFICS[gameType] || GAME_SPECIFICS['arcade'];

  // Auto-expand simple prompts into a full professional spec via the
  // weighted feature checklist (Product Completion Engine).
  const checklist = buildFeatureChecklistPrompt(gameType);

  // Template Engine: for covered game types, give the AI a structural
  // skeleton to EXTEND rather than generating the whole document from
  // scratch. This guarantees HUD/overlays/mobile controls/audio init
  // are always present (they satisfy several checklist items by default).
  //
  // Edit-mode protection: skip this on edits. An edit's prompt already
  // includes the EXISTING (customized) game via GameProjectMemory —
  // injecting the generic skeleton on top of that conflicts with "here's
  // the current game, make this specific change" and can pull the AI
  // back toward generic skeleton structure, overwriting customizations.
  let templateBlock = "";
  if (!isEdit && hasGameTemplate(gameType)) {
    templateBlock = `

BASE STRUCTURE TO EXTEND (do not remove existing IDs/elements — add your
game logic inside the marked section and flesh out update()/render()):

${getGameTemplate(gameType)}`;
  }

  return `${BASE}\n${specific}\n\n${checklist}${templateBlock}`;
}

// ── Game Workflow Phases ───────────────────────────────────────────
export const GAME_WORKFLOW_PHASES = [
  { agent:"Reading",      icon:"🔍", action:"Analyzing game request",    pct:10 },
  { agent:"Understanding",icon:"🎮", action:"Understanding game type",   pct:18 },
  { agent:"Planning",     icon:"🎨", action:"Designing game architecture",pct:28 },
  { agent:"Building",     icon:"⚙️", action:"Building game engine",      pct:55 },
  { agent:"Validating",   icon:"🧪", action:"Testing gameplay",          pct:72 },
  { agent:"Optimizing",   icon:"🚀", action:"Optimizing performance",    pct:85 },
  { agent:"Finalizing",   icon:"✅", action:"Finalizing game",           pct:100 },
];
