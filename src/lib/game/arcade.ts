import { mulberry32 } from "./random";

/** Small deterministic arcade simulations. Time is in seconds, coordinates in logical pixels. */
export type ArcadeKind = "pigeonRace" | "paperCut" | "snake" | "maze" | "stack" | "pong";
export type ArcadeStatus = "running" | "won" | "lost";
export type Direction = "up" | "right" | "down" | "left";
export interface Cell { x: number; y: number }
export const ARCADE = { width: 360, height: 280 } as const;
const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const delta = (seconds: number) => Number.isFinite(seconds) ? clamp(seconds, 0, .1) : 0;
const equal = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
const vectors: Record<Direction, Cell> = { up: { x: 0, y: -1 }, right: { x: 1, y: 0 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 } };

export const RACE = { length: 2400, duration: 26, lanes: 3, lives: 4, boostCooldown: .9 } as const;
export interface RaceSim {
  kind: "pigeonRace"; status: ArcadeStatus; t: number; lane: number; distance: number; rivals: number[];
  lives: number; boost: number; cooldown: number; slow: number; hazards: { x: number; lane: number; hit: boolean }[];
}
export function createRace(seed: number): RaceSim {
  const random = mulberry32(seed);
  return { kind: "pigeonRace", status: "running", t: 0, lane: 1, distance: 0, rivals: [0, 0], lives: RACE.lives, boost: 0, cooldown: 0, slow: 0,
    hazards: Array.from({ length: 17 }, (_, i) => ({ x: 240 + i * 125 + random() * 35, lane: Math.floor(random() * 3), hit: false })) };
}
export function steerRace(sim: RaceSim, direction: number) { if (sim.status === "running") sim.lane = clamp(sim.lane + Math.sign(direction), 0, 2); }
export function boostRace(sim: RaceSim): boolean {
  if (sim.status !== "running" || sim.cooldown > 0) return false;
  sim.boost = .5; sim.cooldown = RACE.boostCooldown; return true;
}
export function racePosition(sim: RaceSim): number { return 1 + sim.rivals.filter(distance => distance > sim.distance).length; }
export function stepRace(sim: RaceSim, seconds: number) {
  if (sim.status !== "running") return;
  const dt = delta(seconds), previous = sim.distance;
  sim.t += dt;
  sim.distance += (sim.slow > 0 ? 40 : sim.boost > 0 ? 178 : 102) * dt;
  sim.rivals[0] += 116 * dt; sim.rivals[1] += 121 * dt;
  sim.boost = Math.max(0, sim.boost - dt); sim.cooldown = Math.max(0, sim.cooldown - dt); sim.slow = Math.max(0, sim.slow - dt);
  for (const hazard of sim.hazards) {
    if (hazard.hit || hazard.x > sim.distance || hazard.x < previous) continue;
    hazard.hit = true;
    if (hazard.lane === sim.lane) { sim.lives--; sim.slow = .8; sim.boost = 0; }
  }
  if (sim.lives <= 0) sim.status = "lost";
  else if (sim.distance >= RACE.length) { sim.distance = RACE.length; sim.status = racePosition(sim) === 1 ? "won" : "lost"; }
  else if (sim.t >= RACE.duration) sim.status = "lost";
}
export function raceScore(sim: RaceSim) { return Math.min(400, Math.round(sim.distance / 12) + (sim.status === "won" ? 100 + sim.lives * 20 : 0)); }

export const CUT = { duration: 28, target: 14, lives: 5 } as const;
export interface FlyingPaper { id: number; x: number; y: number; vx: number; vy: number; rotation: number; bomb: boolean; cut: boolean }
export interface CutSim {
  kind: "paperCut"; status: ArcadeStatus; t: number; lives: number; cut: number; combo: number; bestCombo: number; lastCut: number;
  papers: FlyingPaper[]; nextSpawn: number; random: () => number; sequence: number; blade: Cell; trail: (Cell & { age: number })[];
}
export function createCut(seed: number): CutSim {
  return { kind: "paperCut", status: "running", t: 0, lives: CUT.lives, cut: 0, combo: 0, bestCombo: 0, lastCut: -10, papers: [], nextSpawn: .5, random: mulberry32(seed), sequence: 0, blade: { x: 180, y: 160 }, trail: [] };
}
export function moveCutBlade(sim: CutSim, direction: Direction) {
  if (sim.status !== "running") return;
  const v = vectors[direction]; sim.blade = { x: clamp(sim.blade.x + v.x * 14, 12, 348), y: clamp(sim.blade.y + v.y * 14, 30, 255) };
}
export function cutAtBlade(sim: CutSim): number {
  const center = sim.blade;
  const hits = slicePapers(sim, { x: center.x - 55, y: center.y }, { x: center.x + 55, y: center.y });
  sim.blade = center; return hits;
}
/** Distance to a whole swipe segment: fast pointer movement cannot tunnel through a paper. */
export function segmentDistance(point: Cell, from: Cell, to: Cell): number {
  const dx = to.x - from.x, dy = to.y - from.y, length = dx * dx + dy * dy;
  const t = length ? clamp(((point.x - from.x) * dx + (point.y - from.y) * dy) / length, 0, 1) : 0;
  return Math.hypot(point.x - from.x - dx * t, point.y - from.y - dy * t);
}
export function slicePapers(sim: CutSim, from: Cell, to: Cell): number {
  if (sim.status !== "running") return 0;
  sim.blade = { x: clamp(to.x, 0, ARCADE.width), y: clamp(to.y, 0, ARCADE.height) };
  sim.trail.push({ ...from, age: .22 }, { ...to, age: .22 });
  let hits = 0;
  for (const paper of sim.papers) {
    if (paper.cut || segmentDistance(paper, from, to) > (paper.bomb ? 17 : 22)) continue;
    paper.cut = true;
    if (paper.bomb) { sim.lives -= 2; sim.combo = 0; }
    else { sim.cut++; sim.combo = sim.t - sim.lastCut < .55 ? sim.combo + 1 : 1; sim.lastCut = sim.t; sim.bestCombo = Math.max(sim.bestCombo, sim.combo); hits++; }
  }
  if (sim.lives <= 0) sim.status = "lost";
  else if (sim.cut >= CUT.target) sim.status = "won";
  return hits;
}
export function stepCut(sim: CutSim, seconds: number) {
  if (sim.status !== "running") return;
  const dt = delta(seconds); sim.t += dt;
  if (sim.t >= sim.nextSpawn) {
    const count = sim.sequence % 4 === 3 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const x = 40 + sim.random() * 280;
      sim.papers.push({ id: sim.sequence++, x, y: 308 + i * 12, vx: (180 - x) * .34, vy: -330 - sim.random() * 65, rotation: sim.random() * 2 - 1, bomb: sim.sequence > 3 && sim.sequence % 5 === 0, cut: false });
    }
    sim.nextSpawn += .84;
  }
  for (const paper of sim.papers) {
    paper.x += paper.vx * dt; paper.y += paper.vy * dt; paper.vy += 430 * dt; paper.rotation += dt;
    if (!paper.cut && paper.y > 330 && paper.vy > 0) { paper.cut = true; if (!paper.bomb) { sim.lives--; sim.combo = 0; } }
  }
  sim.papers = sim.papers.filter(p => p.y < 350 || p.vy < 0);
  sim.trail = sim.trail.map(p => ({ ...p, age: p.age - dt })).filter(p => p.age > 0).slice(-24);
  if (sim.lives <= 0 || sim.t >= CUT.duration) sim.status = "lost";
}
export function cutScore(sim: CutSim) { return Math.min(400, sim.cut * 15 + sim.bestCombo * 5 + (sim.status === "won" ? Math.round((CUT.duration - sim.t) * 3) : 0)); }

export const SNAKE = { columns: 18, rows: 13, target: 10, duration: 60, interval: .17 } as const;
export interface SnakeSim {
  kind: "snake"; status: ArcadeStatus; t: number; clock: number; body: Cell[]; direction: Direction; queued: Direction;
  food: Cell; eaten: number; random: () => number;
}
function snakeFood(sim: SnakeSim): Cell {
  const empty: Cell[] = [];
  for (let y = 0; y < SNAKE.rows; y++) for (let x = 0; x < SNAKE.columns; x++) if (!sim.body.some(p => p.x === x && p.y === y)) empty.push({ x, y });
  return empty[Math.floor(sim.random() * empty.length)] ?? { x: -1, y: -1 };
}
export function createSnake(seed: number): SnakeSim {
  const sim: SnakeSim = { kind: "snake", status: "running", t: 0, clock: 0, body: [{ x: 5, y: 6 }, { x: 4, y: 6 }, { x: 3, y: 6 }], direction: "right", queued: "right", food: { x: 0, y: 0 }, eaten: 0, random: mulberry32(seed) };
  sim.food = snakeFood(sim); return sim;
}
export function turnSnake(sim: SnakeSim, direction: Direction) {
  if (sim.status !== "running") return;
  const current = vectors[sim.direction], next = vectors[direction];
  if (current.x + next.x === 0 && current.y + next.y === 0) return;
  sim.queued = direction;
}
export function stepSnake(sim: SnakeSim, seconds: number) {
  if (sim.status !== "running") return;
  const dt = delta(seconds); sim.t += dt; sim.clock += dt;
  const interval = SNAKE.interval - Math.min(.04, sim.eaten * .004);
  while (sim.clock >= interval && sim.status === "running") {
    sim.clock -= interval; sim.direction = sim.queued;
    const vector = vectors[sim.direction], head = { x: sim.body[0].x + vector.x, y: sim.body[0].y + vector.y };
    const growing = equal(head, sim.food), occupied = growing ? sim.body : sim.body.slice(0, -1);
    if (head.x < 0 || head.x >= SNAKE.columns || head.y < 0 || head.y >= SNAKE.rows || occupied.some(p => equal(p, head))) { sim.status = "lost"; break; }
    sim.body.unshift(head);
    if (growing) { sim.eaten++; sim.food = snakeFood(sim); if (sim.eaten >= SNAKE.target) sim.status = "won"; }
    else sim.body.pop();
  }
  if (sim.t >= SNAKE.duration && sim.status === "running") sim.status = "lost";
}
export function snakeScore(sim: SnakeSim) { return Math.min(400, sim.eaten * 25 + (sim.status === "won" ? Math.round((SNAKE.duration - sim.t) * 2) : 0)); }

export const MAZE_MAP = [
  "###############", "#.....#.......#", "#.###.#.###.#.#", "#o#...#...#.#o#", "#.#.#####.#.#.#", "#.............#",
  "#.###.#.###.#.#", "#...#.#...#...#", "###.#.###.###.#", "#.....#.......#", "###############",
] as const;
export const MAZE = { columns: 15, rows: 11, interval: .15, duration: 65, lives: 3, powerDuration: 5 } as const;
export interface MazeSim {
  kind: "maze"; status: ArcadeStatus; t: number; clock: number; ghostClock: number; player: Cell; direction: Direction; queued: Direction;
  ghosts: Cell[]; pellets: Cell[]; powers: Cell[]; eaten: number; target: number; lives: number; powered: number; immune: number; random: () => number;
}
export function mazeWalkable(cell: Cell): boolean { return !!MAZE_MAP[cell.y] && MAZE_MAP[cell.y][cell.x] !== undefined && MAZE_MAP[cell.y][cell.x] !== "#"; }
export function createMaze(seed: number): MazeSim {
  const pellets: Cell[] = [], powers: Cell[] = [];
  MAZE_MAP.forEach((row, y) => [...row].forEach((tile, x) => { if (tile === "." && !(x === 1 && y === 1)) pellets.push({ x, y }); if (tile === "o") powers.push({ x, y }); }));
  return { kind: "maze", status: "running", t: 0, clock: 0, ghostClock: 0, player: { x: 1, y: 1 }, direction: "right", queued: "right", ghosts: [{ x: 13, y: 9 }, { x: 7, y: 5 }], pellets, powers, target: pellets.length + powers.length, eaten: 0, lives: MAZE.lives, powered: 0, immune: 1.5, random: mulberry32(seed) };
}
export function turnMaze(sim: MazeSim, direction: Direction) { if (sim.status === "running") sim.queued = direction; }
function mazeNext(cell: Cell, direction: Direction): Cell { return { x: cell.x + vectors[direction].x, y: cell.y + vectors[direction].y }; }
function mazeCollisions(sim: MazeSim) {
  sim.ghosts.forEach((ghost, index) => {
    if (!equal(sim.player, ghost)) return;
    if (sim.powered > 0) { sim.ghosts[index] = { x: 13, y: 9 }; }
    else if (sim.immune <= 0) { sim.lives--; sim.player = { x: 1, y: 1 }; sim.direction = "right"; sim.queued = "right"; sim.immune = 2; if (sim.lives <= 0) sim.status = "lost"; }
  });
}
export function stepMaze(sim: MazeSim, seconds: number) {
  if (sim.status !== "running") return;
  const dt = delta(seconds); sim.t += dt; sim.clock += dt; sim.ghostClock += dt; sim.powered = Math.max(0, sim.powered - dt); sim.immune = Math.max(0, sim.immune - dt);
  while (sim.clock >= MAZE.interval && sim.status === "running") {
    sim.clock -= MAZE.interval;
    if (mazeWalkable(mazeNext(sim.player, sim.queued))) sim.direction = sim.queued;
    const next = mazeNext(sim.player, sim.direction); if (mazeWalkable(next)) sim.player = next;
    const before = sim.pellets.length + sim.powers.length;
    sim.pellets = sim.pellets.filter(p => !equal(p, sim.player));
    if (sim.powers.some(p => equal(p, sim.player))) sim.powered = MAZE.powerDuration;
    sim.powers = sim.powers.filter(p => !equal(p, sim.player));
    sim.eaten += before - sim.pellets.length - sim.powers.length;
    mazeCollisions(sim);
    if (sim.eaten >= sim.target) sim.status = "won";
  }
  if (sim.ghostClock >= .4 && sim.status === "running") {
    sim.ghostClock -= .4;
    sim.ghosts = sim.ghosts.map(ghost => {
      const options = Object.values(vectors).map(v => ({ x: ghost.x + v.x, y: ghost.y + v.y })).filter(mazeWalkable);
      // Mostly pursue; seeded wandering lets a player escape rather than being trapped forever.
      if (sim.random() < .3) return options[Math.floor(sim.random() * options.length)] ?? ghost;
      options.sort((a, b) => (Math.abs(a.x - sim.player.x) + Math.abs(a.y - sim.player.y) - Math.abs(b.x - sim.player.x) - Math.abs(b.y - sim.player.y)) * (sim.powered > 0 ? -1 : 1));
      return options[0] ?? ghost;
    });
    mazeCollisions(sim);
  }
  if (sim.t >= MAZE.duration && sim.status === "running") sim.status = "lost";
}
export function mazeScore(sim: MazeSim) { return Math.min(1000, sim.eaten * 8 + (sim.status === "won" ? sim.lives * 40 + Math.round(MAZE.duration - sim.t) : 0)); }

export const STACK = { columns: 10, rows: 16, target: 4, duration: 80 } as const;
export const STACK_SHAPES: readonly (readonly Cell[])[] = [
  [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 1 }],
  [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }],
  [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
  [{ x: 2, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
];
export interface FallingPiece { cells: Cell[]; type: number; x: number; y: number }
export interface StackSim {
  kind: "stack"; status: ArcadeStatus; t: number; clock: number; board: number[][]; piece: FallingPiece; next: number;
  bag: number[]; random: () => number; lines: number; points: number; pieces: number;
}
function nextType(sim: Pick<StackSim, "bag" | "random">): number {
  if (!sim.bag.length) {
    sim.bag = [0, 1, 2, 3, 4, 5, 6];
    for (let i = 6; i > 0; i--) { const j = Math.floor(sim.random() * (i + 1)); [sim.bag[i], sim.bag[j]] = [sim.bag[j], sim.bag[i]]; }
  }
  return sim.bag.pop()!;
}
function makePiece(type: number): FallingPiece { return { type, cells: STACK_SHAPES[type].map(p => ({ ...p })), x: 3, y: 0 }; }
export function createStack(seed: number): StackSim {
  const rng = { bag: [] as number[], random: mulberry32(seed) }, type = nextType(rng), next = nextType(rng);
  return { kind: "stack", status: "running", t: 0, clock: 0, board: Array.from({ length: STACK.rows }, () => Array(STACK.columns).fill(0)), piece: makePiece(type), next, ...rng, lines: 0, points: 0, pieces: 0 };
}
export function stackFits(sim: StackSim, piece: FallingPiece): boolean {
  return piece.cells.every(cell => { const x = piece.x + cell.x, y = piece.y + cell.y; return x >= 0 && x < STACK.columns && y >= 0 && y < STACK.rows && sim.board[y][x] === 0; });
}
export function moveStack(sim: StackSim, dx: number, dy = 0): boolean {
  if (sim.status !== "running") return false;
  const piece = { ...sim.piece, x: sim.piece.x + dx, y: sim.piece.y + dy };
  if (!stackFits(sim, piece)) return false;
  sim.piece = piece; return true;
}
export function rotateStack(sim: StackSim): boolean {
  if (sim.status !== "running") return false;
  if (sim.piece.type === 1) return true;
  const size = sim.piece.type === 0 ? 4 : 3, cells = sim.piece.cells.map(p => ({ x: size - 1 - p.y, y: p.x }));
  for (const kick of [0, -1, 1, -2, 2]) { const candidate = { ...sim.piece, cells, x: sim.piece.x + kick }; if (stackFits(sim, candidate)) { sim.piece = candidate; return true; } }
  return false;
}
export function stackGhostY(sim: StackSim): number {
  let y = sim.piece.y; while (stackFits(sim, { ...sim.piece, y: y + 1 })) y++; return y;
}
function lockStack(sim: StackSim) {
  for (const p of sim.piece.cells) sim.board[p.y + sim.piece.y][p.x + sim.piece.x] = sim.piece.type + 1;
  const remaining = sim.board.filter(row => !row.every(Boolean)), lines = STACK.rows - remaining.length;
  sim.board = [...Array.from({ length: lines }, () => Array(STACK.columns).fill(0)), ...remaining];
  sim.lines += lines; sim.points += [0, 100, 300, 500, 800][lines] ?? 800; sim.pieces++;
  if (sim.lines >= STACK.target) { sim.status = "won"; return; }
  sim.piece = makePiece(sim.next); sim.next = nextType(sim); sim.clock = 0;
  if (!stackFits(sim, sim.piece)) sim.status = "lost";
}
export function dropStack(sim: StackSim) {
  if (sim.status !== "running") return;
  const landing = stackGhostY(sim); sim.points += landing - sim.piece.y; sim.piece.y = landing; lockStack(sim);
}
export function softDropStack(sim: StackSim) {
  if (sim.status !== "running") return;
  if (!moveStack(sim, 0, 1)) lockStack(sim);
}
export function stepStack(sim: StackSim, seconds: number) {
  if (sim.status !== "running") return;
  const dt = delta(seconds); sim.t += dt; sim.clock += dt;
  if (sim.clock >= .65 - Math.min(.25, sim.lines * .05)) { sim.clock = 0; softDropStack(sim); }
  if (sim.t >= STACK.duration && sim.status === "running") sim.status = "lost";
}
export function stackScore(sim: StackSim) { return Math.min(4000, sim.points + (sim.status === "won" ? Math.round((STACK.duration - sim.t) * 5) : 0)); }

export const PONG = { target: 5, duration: 65, paddleWidth: 70, ballRadius: 6, playerY: 251, opponentY: 29 } as const;
export interface PongSim {
  kind: "pong"; status: ArcadeStatus; t: number; player: number; opponent: number; ball: Cell; vx: number; vy: number;
  playerPoints: number; opponentPoints: number; rallies: number; serve: number; random: () => number;
}
export function createPong(seed: number): PongSim {
  return { kind: "pong", status: "running", t: 0, player: 180, opponent: 180, ball: { x: 180, y: 140 }, vx: 70, vy: 180, playerPoints: 0, opponentPoints: 0, rallies: 0, serve: .8, random: mulberry32(seed) };
}
export function movePong(sim: PongSim, x: number) { if (sim.status === "running") sim.player = clamp(x, PONG.paddleWidth / 2 + 8, ARCADE.width - PONG.paddleWidth / 2 - 8); }
function servePong(sim: PongSim, towardPlayer: boolean) {
  sim.ball = { x: 180, y: 140 }; sim.vx = (sim.random() - .5) * 140; sim.vy = towardPlayer ? 180 : -180; sim.serve = .75;
}
export function stepPong(sim: PongSim, seconds: number) {
  if (sim.status !== "running") return;
  let dt = delta(seconds); sim.t += dt;
  const aim = sim.ball.x + (sim.vy < 0 ? sim.vx * .12 : 0), gap = aim - sim.opponent;
  sim.opponent = clamp(sim.opponent + Math.sign(gap) * Math.min(Math.abs(gap), 112 * dt), 35, 325);
  if (sim.serve > 0) { sim.serve = Math.max(0, sim.serve - dt); dt = 0; }
  // Substeps prevent a fast ball from crossing a paddle between frames.
  const steps = Math.max(1, Math.ceil(dt / .012));
  for (let i = 0; i < steps; i++) {
    const step = dt / steps, previousY = sim.ball.y;
    sim.ball.x += sim.vx * step; sim.ball.y += sim.vy * step;
    if (sim.ball.x < 10) { sim.ball.x = 20 - sim.ball.x; sim.vx = Math.abs(sim.vx); }
    if (sim.ball.x > 350) { sim.ball.x = 700 - sim.ball.x; sim.vx = -Math.abs(sim.vx); }
    const playerHit = sim.vy > 0 && previousY + PONG.ballRadius <= PONG.playerY && sim.ball.y + PONG.ballRadius >= PONG.playerY;
    const opponentHit = sim.vy < 0 && previousY - PONG.ballRadius >= PONG.opponentY && sim.ball.y - PONG.ballRadius <= PONG.opponentY;
    const paddle = playerHit ? sim.player : sim.opponent;
    if ((playerHit || opponentHit) && Math.abs(sim.ball.x - paddle) <= PONG.paddleWidth / 2 + 4) {
      const offset = clamp((sim.ball.x - paddle) / (PONG.paddleWidth / 2), -.95, .95);
      const speed = Math.min(340, Math.hypot(sim.vx, sim.vy) + 15);
      sim.vx = speed * offset * .86; sim.vy = (playerHit ? -1 : 1) * Math.sqrt(speed * speed - sim.vx * sim.vx);
      sim.ball.y = playerHit ? PONG.playerY - PONG.ballRadius : PONG.opponentY + PONG.ballRadius;
      if (playerHit) sim.rallies++;
    }
    if (sim.ball.y < -10) { sim.playerPoints++; servePong(sim, true); break; }
    if (sim.ball.y > 290) { sim.opponentPoints++; servePong(sim, true); break; }
  }
  if (sim.playerPoints >= PONG.target) sim.status = "won";
  else if (sim.opponentPoints >= PONG.target) sim.status = "lost";
  else if (sim.t >= PONG.duration) sim.status = sim.playerPoints > sim.opponentPoints ? "won" : "lost";
}
export function pongScore(sim: PongSim) { return Math.min(500, sim.playerPoints * 60 + Math.min(100, sim.rallies * 5) + (sim.status === "won" ? 100 : 0)); }

export type ArcadeSim = RaceSim | CutSim | SnakeSim | MazeSim | StackSim | PongSim;
export const ARCADE_DURATIONS: Record<ArcadeKind, number> = { pigeonRace: RACE.duration, paperCut: CUT.duration, snake: SNAKE.duration, maze: MAZE.duration, stack: STACK.duration, pong: PONG.duration };
export function createArcade(kind: ArcadeKind, seed: number): ArcadeSim {
  switch (kind) { case "pigeonRace": return createRace(seed); case "paperCut": return createCut(seed); case "snake": return createSnake(seed); case "maze": return createMaze(seed); case "stack": return createStack(seed); case "pong": return createPong(seed); }
}
export function stepArcade(sim: ArcadeSim, seconds: number) {
  switch (sim.kind) { case "pigeonRace": return stepRace(sim, seconds); case "paperCut": return stepCut(sim, seconds); case "snake": return stepSnake(sim, seconds); case "maze": return stepMaze(sim, seconds); case "stack": return stepStack(sim, seconds); case "pong": return stepPong(sim, seconds); }
}
export function arcadeScore(sim: ArcadeSim): number {
  switch (sim.kind) { case "pigeonRace": return raceScore(sim); case "paperCut": return cutScore(sim); case "snake": return snakeScore(sim); case "maze": return mazeScore(sim); case "stack": return stackScore(sim); case "pong": return pongScore(sim); }
}
