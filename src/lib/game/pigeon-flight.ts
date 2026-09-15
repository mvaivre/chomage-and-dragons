import { mulberry32, seedFrom } from "@/lib/game/random";

/**
 * The backwards courier's obstacle course. Everything is expressed in arena
 * units: the arena is always COURSE.height tall, and as wide as the screen allows.
 * The pigeon stays at COURSE.pigeonX while the world scrolls past it.
 */
export const COURSE = {
  height: 240,
  ground: 18,
  pigeonX: 92,
  pigeonRadius: 11,
  gravity: 620,
  flapVelocity: -170,
  maxFallVelocity: 340,
  /** World speed at the first tower and at the mailbox. */
  speed: [130, 172] as const,
  towers: 10,
  towerWidth: 38,
  towerSpacing: 176,
  /** Distance from the starting point to the first tower. */
  firstTowerX: 340,
  /** Gap height at the first and last tower. */
  gap: [100, 74] as const,
  /** Gap edges keep this distance from the ceiling and the ground. */
  gapMargin: 22,
  /** Consecutive gaps never move further apart than a pigeon can climb. */
  maxClimb: 72,
  feathers: 3,
  invulnerableMs: 900,
  mailboxAfterLastTower: 230,
  /** Fixed simulation step, independent of the display refresh rate. */
  stepMs: 1000 / 120,
} as const;

export interface Tower {
  x: number;
  gapY: number;
  gapHeight: number;
  passed: boolean;
}

export type PigeonStatus = "ready" | "flying" | "delivered" | "crashed";
export type PigeonEvent = "flap" | "pass" | "hit" | "delivered" | "crashed";

export interface PigeonSim {
  status: PigeonStatus;
  /** Milliseconds of flight; also the animation clock while waiting. */
  t: number;
  /** World distance travelled; the pigeon's world x. */
  distance: number;
  y: number;
  vy: number;
  feathers: number;
  invulnerableUntil: number;
  towers: Tower[];
  mailboxX: number;
  speedScale: number;
  accumulator: number;
  lastFlapAt: number;
  lastHitAt: number;
  lastPassAt: number;
}

export const courseSeed = seedFrom;

export function generateTowers(seed: number): Tower[] {
  const random = mulberry32(seed);
  const towers: Tower[] = [];
  const sky = COURSE.height - COURSE.ground;
  let previous = sky / 2;
  for (let i = 0; i < COURSE.towers; i++) {
    const progress = i / Math.max(1, COURSE.towers - 1);
    const gapHeight = COURSE.gap[0] + (COURSE.gap[1] - COURSE.gap[0]) * progress;
    const min = Math.max(COURSE.gapMargin + gapHeight / 2, previous - COURSE.maxClimb);
    const max = Math.min(sky - COURSE.gapMargin - gapHeight / 2, previous + COURSE.maxClimb);
    const gapY = min + (max - min) * random();
    towers.push({ x: COURSE.firstTowerX + i * COURSE.towerSpacing, gapY, gapHeight, passed: false });
    previous = gapY;
  }
  return towers;
}

export function createPigeonSim(seed: number, options: { speedScale?: number } = {}): PigeonSim {
  const towers = generateTowers(seed);
  return {
    status: "ready",
    t: 0,
    distance: 0,
    y: (COURSE.height - COURSE.ground) / 2,
    vy: 0,
    feathers: COURSE.feathers,
    invulnerableUntil: 0,
    towers,
    mailboxX: towers[towers.length - 1].x + COURSE.mailboxAfterLastTower,
    speedScale: options.speedScale ?? 1,
    accumulator: 0,
    lastFlapAt: -Infinity,
    lastHitAt: -Infinity,
    lastPassAt: -Infinity,
  };
}

export function pigeonSpeed(sim: PigeonSim): number {
  const progress = Math.min(1, Math.max(0, sim.distance / sim.mailboxX));
  return (COURSE.speed[0] + (COURSE.speed[1] - COURSE.speed[0]) * progress) * sim.speedScale;
}

export function nextTower(sim: PigeonSim): Tower | undefined {
  return sim.towers.find(tower => !tower.passed);
}

export function towersPassed(sim: PigeonSim): number {
  return sim.towers.filter(tower => tower.passed).length;
}

/** The first tap starts the flight; every later one beats the wings. */
export function flapPigeon(sim: PigeonSim): PigeonEvent[] {
  if (sim.status === "delivered" || sim.status === "crashed") return [];
  sim.status = "flying";
  sim.vy = COURSE.flapVelocity;
  sim.lastFlapAt = sim.t;
  return ["flap"];
}

function circleTouchesRect(cx: number, cy: number, r: number, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = cx - Math.max(x0, Math.min(cx, x1));
  const dy = cy - Math.max(y0, Math.min(cy, y1));
  return dx * dx + dy * dy < r * r;
}

/** What the pigeon is touching right now, ignoring temporary invulnerability. */
export function pigeonContact(sim: PigeonSim): "ground" | "tower-top" | "tower-bottom" | null {
  const r = COURSE.pigeonRadius;
  if (sim.y + r >= COURSE.height - COURSE.ground) return "ground";
  for (const tower of sim.towers) {
    if (tower.x > sim.distance + r || tower.x + COURSE.towerWidth < sim.distance - r) continue;
    const top = tower.gapY - tower.gapHeight / 2;
    const bottom = tower.gapY + tower.gapHeight / 2;
    if (circleTouchesRect(sim.distance, sim.y, r, tower.x, -1000, tower.x + COURSE.towerWidth, top)) return "tower-top";
    if (circleTouchesRect(sim.distance, sim.y, r, tower.x, bottom, tower.x + COURSE.towerWidth, COURSE.height)) return "tower-bottom";
  }
  return null;
}

function substep(sim: PigeonSim, dt: number, events: PigeonEvent[]) {
  sim.t += dt * 1000;
  if (sim.status !== "flying") return;
  const seconds = dt;
  sim.vy = Math.min(COURSE.maxFallVelocity, sim.vy + COURSE.gravity * seconds);
  sim.y += sim.vy * seconds;
  if (sim.y < COURSE.pigeonRadius) { sim.y = COURSE.pigeonRadius; sim.vy = Math.max(0, sim.vy); }
  // The ground is solid even while invulnerable: the pigeon slides until it can bounce.
  sim.y = Math.min(sim.y, COURSE.height - COURSE.ground - COURSE.pigeonRadius);
  sim.distance += pigeonSpeed(sim) * seconds;

  for (const tower of sim.towers) {
    if (!tower.passed && sim.distance > tower.x + COURSE.towerWidth) {
      tower.passed = true;
      sim.lastPassAt = sim.t;
      events.push("pass");
    }
  }

  if (sim.distance >= sim.mailboxX) {
    sim.status = "delivered";
    sim.distance = sim.mailboxX;
    events.push("delivered");
    return;
  }

  const contact = sim.t >= sim.invulnerableUntil ? pigeonContact(sim) : null;
  if (!contact) return;
  sim.feathers -= 1;
  sim.lastHitAt = sim.t;
  events.push("hit");
  if (sim.feathers <= 0) {
    sim.status = "crashed";
    events.push("crashed");
    return;
  }
  sim.invulnerableUntil = sim.t + COURSE.invulnerableMs;
  // Bounce away from the obstacle, so the pigeon is never stuck inside it.
  sim.vy = contact === "tower-top" ? 140 : COURSE.flapVelocity * 1.15;
}

/** Advance the flight by real elapsed time, in deterministic fixed steps. */
export function stepPigeon(sim: PigeonSim, elapsedMs: number): PigeonEvent[] {
  const events: PigeonEvent[] = [];
  sim.accumulator += Math.min(elapsedMs, 100);
  // The epsilon keeps three 16.7 ms frames and one 50 ms frame on the same step count.
  while (sim.accumulator >= COURSE.stepMs - 1e-6) {
    sim.accumulator -= COURSE.stepMs;
    substep(sim, COURSE.stepMs / 1000, events);
    if (sim.status === "delivered" || sim.status === "crashed") { sim.accumulator = 0; break; }
  }
  return events;
}

/** Where a careful courier wants to be right now: the next gap, then the mail slot. */
export function pigeonTargetY(sim: PigeonSim): number {
  return nextTower(sim)?.gapY ?? (COURSE.height - COURSE.ground) / 2;
}

/**
 * A simple flap rule that clears every generated course. It documents the
 * intended difficulty and drives the browser tests through the real input path.
 */
export function pigeonAutopilot(sim: PigeonSim): boolean {
  if (sim.status === "ready") return true;
  if (sim.status !== "flying") return false;
  return sim.y > pigeonTargetY(sim) + 4 && sim.vy > -70;
}
