/**
 * KRYPTON AI — Product Completion Engine
 * Quality Audit Module
 *
 * Defines a per-game-type weighted feature checklist (sums to 100),
 * audits generated HTML against it, and produces the prompt text
 * that auto-expands a simple user request into a full spec.
 *
 * Does NOT modify website builder, project memory, or chat system.
 */

export interface FeatureCheck {
  id:     string;
  label:  string;
  weight: number;            // 0-100, all items for a gameType sum to 100
  test:   (html: string) => boolean;
}

export interface AuditResult {
  score:  number;            // 0-100
  passed: { id: string; label: string; weight: number }[];
  failed: { id: string; label: string; weight: number }[];
  total:  number;             // total number of checklist items
}

// ── Reusable test helpers ────────────────────────────────────────
const re = (pattern: string, flags = "i") => {
  const r = new RegExp(pattern, flags);
  return (html: string) => r.test(html);
};
const all = (...fns: ((h: string) => boolean)[]) => (h: string) => fns.every(f => f(h));

// ── BASE checklist — applies to every game type (sums to 20) ────
const BASE_ITEMS: FeatureCheck[] = [
  { id:"fullscreen",  label:"Full-screen responsive canvas",        weight:2, test: all(re("innerWidth"), re("innerHeight")) },
  { id:"gameloop",    label:"Smooth game loop (60fps)",             weight:2, test: re("requestAnimationFrame") },
  { id:"controls",    label:"Working input controls",               weight:3, test: (h) => re("addEventListener\\(\\s*['\"]key(down|up)['\"]")(h) || re("touchstart")(h) },
  { id:"score",       label:"Score / progress display",             weight:2, test: re("score|points") },
  { id:"endstate",    label:"Clear end/win/lose state",             weight:3, test: re("game\\s*-?\\s*over|checkmate|victory|win\\b|complete|defeat") },
  { id:"restart",     label:"Restart capability",                   weight:2, test: re("restart") },
  { id:"mobile",      label:"Mobile touch controls",                weight:3, test: re("touchstart") },
  { id:"sound",       label:"Sound effects (Web Audio API)",        weight:3, test: (h) => re("AudioContext")(h) || re("new Audio\\(")(h) },
];

// ── TYPE-SPECIFIC checklists (each sums to 80) ───────────────────
const TYPE_ITEMS: Record<string, FeatureCheck[]> = {

  snake: [
    { id:"grid",      label:"Grid-based snake body array",        weight:15, test: re("snake\\s*=\\s*\\[|snakeBody|body\\.push") },
    { id:"food",      label:"Food spawning system",               weight:15, test: re("food") },
    { id:"growth",    label:"Snake grows when eating",            weight:12, test: re("push\\(|grow") },
    { id:"collision", label:"Wall / self-collision detection",    weight:18, test: re("collid|gameOver") },
    { id:"speed",     label:"Speed/level increases over time",    weight:10, test: re("speed.*\\+|level") },
    { id:"highscore", label:"High score saved (localStorage)",    weight:10, test: re("localStorage") },
  ],

  tetris: [
    { id:"pieces",    label:"7 tetromino pieces (I,O,T,S,Z,J,L)",  weight:20, test: re("tetromino|piece") },
    { id:"rotate",    label:"Piece rotation",                      weight:15, test: re("rotate") },
    { id:"lineclear", label:"Line clear detection",                weight:20, test: re("clearLine|lineClear|clear.*row") },
    { id:"nextpiece", label:"Next piece preview",                  weight:13, test: re("next.*piece|nextPiece") },
    { id:"hold",      label:"Hold piece feature",                  weight:12, test: re("hold") },
  ],

  platformer: [
    { id:"gravity",    label:"Gravity physics",                    weight:14, test: re("gravity") },
    { id:"jump",       label:"Jump mechanic",                      weight:12, test: re("jump") },
    { id:"platforms",  label:"Platform collision detection",       weight:16, test: all(re("platform"), re("collid")) },
    { id:"enemies",    label:"Enemy system",                       weight:12, test: re("enemy|enemies") },
    { id:"coins",      label:"Collectible coins",                  weight:10, test: re("coin") },
    { id:"lives",      label:"Lives system",                       weight:8,  test: re("lives") },
    { id:"checkpoint", label:"Checkpoint / respawn",                weight:8,  test: re("checkpoint|respawn") },
  ],

  pacman: [
    { id:"maze",     label:"Maze grid layout",                     weight:18, test: re("maze") },
    { id:"dots",     label:"Dot collection",                       weight:14, test: re("dot") },
    { id:"ghosts",   label:"Ghost AI movement",                    weight:20, test: re("ghost") },
    { id:"pellet",   label:"Power pellet",                         weight:14, test: re("pellet|power.*up") },
    { id:"lives",    label:"Lives system",                         weight:14, test: re("lives") },
  ],

  racing: [
    { id:"steering",  label:"Steering / drift physics",            weight:16, test: re("steer|drift") },
    { id:"aiCars",    label:"AI opponent vehicles",                 weight:20, test: re("aiCar|opponent|rival") },
    { id:"lap",       label:"Lap counter",                          weight:16, test: re("lap") },
    { id:"nitro",     label:"Nitro / boost mechanic",               weight:12, test: re("nitro|boost") },
    { id:"track",     label:"Track / road rendering",               weight:16, test: re("track|road") },
  ],

  shooter: [
    { id:"shoot",     label:"Player shooting mechanic",            weight:20, test: re("shoot|bullet|projectile") },
    { id:"waves",     label:"Enemy waves",                          weight:18, test: re("wave|enemies") },
    { id:"collision", label:"Bullet-enemy collision",               weight:18, test: re("collid") },
    { id:"health",    label:"Health / lives system",                weight:12, test: re("health|lives") },
    { id:"powerups",  label:"Power-up pickups",                     weight:12, test: re("powerup|power-up") },
  ],

  survival: [
    { id:"weapons",   label:"Weapon system",                        weight:16, test: re("weapon|ammo|gun") },
    { id:"waves",     label:"Wave-based enemy spawning",            weight:16, test: re("wave") },
    { id:"health",    label:"Health / lives system",                weight:16, test: re("health|lives") },
    { id:"enemyAI",   label:"Enemy AI movement",                     weight:16, test: re("zombie|enemy") },
    { id:"upgrades",  label:"XP / upgrade system",                  weight:16, test: re("xp|experience|upgrade") },
  ],

  flappy: [
    { id:"flap",      label:"Gravity + flap mechanic",              weight:22, test: re("gravity|flap") },
    { id:"pipes",     label:"Obstacle (pipe) spawning",             weight:22, test: re("pipe|obstacle") },
    { id:"collision", label:"Collision detection",                  weight:18, test: re("collid") },
    { id:"scoreOnPass",label:"Score increments on pass",            weight:10, test: re("score") },
    { id:"difficulty",label:"Difficulty increases over time",       weight:8,  test: re("gap|speed.*increase|difficulty") },
  ],

  chess: [
    { id:"board",     label:"8x8 chess board rendering",            weight:16, test: re("board|chess") },
    { id:"pieces",    label:"All pieces with legal moves",          weight:24, test: re("♔|♕|piece|moveValid|isLegal") },
    { id:"turns",     label:"Turn-based system",                    weight:12, test: re("turn") },
    { id:"check",     label:"Check / checkmate detection",          weight:16, test: re("checkmate|isCheck") },
    { id:"ai",        label:"AI opponent moves",                    weight:12, test: re("\\bai\\b|computerMove") },
  ],

  puzzle: [
    { id:"grid",      label:"Grid-based puzzle layout",             weight:16, test: re("grid") },
    { id:"match",     label:"Match / swap logic",                   weight:24, test: re("match|swap") },
    { id:"moves",     label:"Move counter / timer",                 weight:12, test: re("moves?\\s*[:=]|timer") },
    { id:"levels",    label:"Multiple levels",                      weight:14, test: re("level") },
    { id:"win",       label:"Win condition / star rating",          weight:14, test: re("win|complete") },
  ],

  rpg: [
    { id:"npc",       label:"NPC characters with dialog",           weight:16, test: re("npc|dialog") },
    { id:"inventory", label:"Inventory system",                     weight:16, test: re("inventory") },
    { id:"quests",    label:"Quest / objective system",             weight:16, test: re("quest|objective") },
    { id:"stats",     label:"Player stats (HP/Attack/Defense)",     weight:16, test: re("hp|attack|defense") },
    { id:"combat",    label:"Combat system",                        weight:16, test: re("combat|attack") },
  ],

  "tower-defense": [
    { id:"towers",    label:"Tower placement on grid",              weight:24, test: re("tower") },
    { id:"waves",     label:"Enemy path + waves",                   weight:24, test: all(re("path"), re("wave")) },
    { id:"economy",   label:"Gold / currency economy",              weight:18, test: re("gold|currency|money") },
    { id:"upgrade",   label:"Tower upgrade system",                 weight:14, test: re("upgrade") },
  ],

  sports: [
    { id:"aiOpponent",label:"AI opponent",                          weight:20, test: re("\\bai\\b|opponent") },
    { id:"ballPhys",  label:"Ball physics",                         weight:20, test: re("ball") },
    { id:"timer",     label:"Match timer / rounds",                 weight:16, test: re("timer|time\\s*left|round") },
    { id:"scoring",   label:"Sport-specific scoring (goal/point)",  weight:24, test: re("goal|point|run\\b") },
  ],

  openworld: [
    { id:"map",       label:"Large scrollable world + minimap",     weight:16, test: re("minimap|mini-map|map") },
    { id:"npcs",      label:"NPCs in world",                        weight:14, test: re("npc") },
    { id:"missions",  label:"Missions / objectives",                weight:18, test: re("mission|objective") },
    { id:"money",     label:"Money / economy system",               weight:14, test: re("money|cash") },
    { id:"vehicles",  label:"Drivable vehicles",                    weight:18, test: re("vehicle|car") },
  ],

  "space-shooter": [
    { id:"shoot",     label:"Player shooting",                      weight:18, test: re("shoot|bullet|laser") },
    { id:"waves",     label:"Enemy formations / waves",             weight:18, test: re("wave|enemies") },
    { id:"boss",      label:"Boss enemy every few levels",          weight:14, test: re("boss") },
    { id:"powerups",  label:"Power-up pickups",                     weight:14, test: re("powerup|power-up") },
    { id:"parallax",  label:"Parallax starfield background",        weight:16, test: re("star|parallax") },
  ],

  runner: [
    { id:"obstacles", label:"Auto-spawning obstacles",              weight:22, test: re("obstacle") },
    { id:"jumpduck",  label:"Jump / duck mechanic",                  weight:18, test: re("jump|duck|crouch") },
    { id:"collision", label:"Collision detection",                  weight:18, test: re("collid") },
    { id:"distance",  label:"Distance-based scoring",               weight:12, test: re("distance|score") },
    { id:"difficulty",label:"Speed increases over time",            weight:10, test: re("speed.*increase|difficulty") },
  ],

  fighting: [
    { id:"twoChars",  label:"Two characters (player vs AI/P2)",     weight:14, test: re("player1|player2|p1|p2") },
    { id:"attacks",   label:"Attack moves (punch/kick)",            weight:18, test: re("punch|kick|attack") },
    { id:"healthbars",label:"Health bars",                          weight:18, test: re("health\\s*bar|hp") },
    { id:"hitdetect", label:"Hit detection",                        weight:18, test: re("collid|hit") },
    { id:"rounds",    label:"Round-based matches",                  weight:12, test: re("round") },
  ],

  strategy: [
    { id:"resources", label:"Resource management",                  weight:20, test: re("resource") },
    { id:"units",     label:"Unit / building placement",            weight:22, test: re("unit|building") },
    { id:"enemyAI",   label:"Enemy AI",                              weight:20, test: re("\\bai\\b|enemy") },
    { id:"winlose",   label:"Win / lose conditions",                weight:18, test: re("win|lose|victory|defeat") },
  ],

  pong: [
    { id:"paddles",   label:"Two paddles",                          weight:22, test: re("paddle") },
    { id:"ball",      label:"Ball physics with angle changes",      weight:22, test: re("ball") },
    { id:"opponent",  label:"AI or 2-player paddle control",        weight:20, test: re("\\bai\\b|player2|p2") },
    { id:"scoreToWin",label:"Score-to-win condition",                weight:16, test: re("score") },
  ],

  breakout: [
    { id:"paddle",    label:"Player paddle",                        weight:14, test: re("paddle") },
    { id:"ball",      label:"Ball bounce physics",                  weight:18, test: re("ball") },
    { id:"bricks",    label:"Brick grid",                           weight:22, test: re("brick") },
    { id:"destroy",   label:"Brick destruction on hit",              weight:14, test: re("destroy|remove.*brick|brick.*remove") },
    { id:"powerups",  label:"Falling power-ups",                    weight:12, test: re("powerup|power-up") },
  ],

  clicker: [
    { id:"clickHandler", label:"Main click target",                 weight:14, test: re("onclick|addEventListener\\(['\"]click") },
    { id:"clickCounter", label:"Click counter display",             weight:16, test: re("click.*count|count.*click") },
    { id:"upgrades",     label:"Upgrade shop",                      weight:22, test: re("upgrade") },
    { id:"passive",      label:"Passive income (auto-click)",       weight:16, test: re("interval|auto.*click|passive") },
    { id:"save",         label:"Auto-save (localStorage)",          weight:12, test: re("localStorage") },
  ],

  arcade: [
    { id:"obstacles", label:"Enemies or obstacles",                 weight:24, test: re("enemy|obstacle") },
    { id:"levels",    label:"Level progression",                    weight:20, test: re("level") },
    { id:"powerups",  label:"Power-ups",                            weight:16, test: re("powerup|power-up") },
    { id:"collision", label:"Collision detection",                  weight:20, test: re("collid") },
  ],
};

// ── Public API ────────────────────────────────────────────────────

export function getRequiredFeatures(gameType: string): FeatureCheck[] {
  const specific = TYPE_ITEMS[gameType] || TYPE_ITEMS["arcade"];
  return [...BASE_ITEMS, ...specific];
}

export function auditGameHTML(html: string, gameType: string): AuditResult {
  const checklist = getRequiredFeatures(gameType);
  const passed: AuditResult["passed"] = [];
  const failed: AuditResult["failed"] = [];

  for (const f of checklist) {
    let ok = false;
    try { ok = f.test(html); } catch { ok = false; }
    if (ok) passed.push({ id: f.id, label: f.label, weight: f.weight });
    else    failed.push({ id: f.id, label: f.label, weight: f.weight });
  }

  const score = passed.reduce((s, p) => s + p.weight, 0);
  return { score, passed, failed, total: checklist.length };
}

/**
 * Auto-expand a simple prompt into a professional spec — returns the
 * checklist as a prompt section so the AI knows exactly what is graded.
 */
export function buildFeatureChecklistPrompt(gameType: string): string {
  const checklist = getRequiredFeatures(gameType);
  const lines = checklist
    .sort((a, b) => b.weight - a.weight)
    .map((f, i) => `${i + 1}. ${f.label}`);

  return `REQUIRED FEATURE CHECKLIST — your output will be AUTOMATICALLY AUDITED against this list.
Every item below must be implemented and detectable in your code. Aim for a score of 90/100 or higher.

${lines.join("\n")}

If you are running low on token budget, prioritize the highest-numbered-weight items above and the
core game loop — but the file MUST still end with a valid </html>.`;
}
