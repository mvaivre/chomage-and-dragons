import { mulberry32 } from "@/lib/game/random";

/**
 * The regional employment office's stamping desk. Job-search proof folders
 * ride a conveyor belt from the right; the player slams the stamp when a
 * folder sits under it. Arena units: DESK.height tall, any width.
 */
export const DESK = {
  height: 240,
  /** Screen x of the stamp; the belt scrolls underneath it. */
  stampX: 118,
  dossierWidth: 48,
  dossiers: 10,
  /** Belt speed at the first and last folder. */
  speed: [100, 175] as const,
  /** Distance between consecutive folders, drawn per folder. */
  spacing: [96, 150] as const,
  firstX: 280,
  /** A folder counts as under the stamp within this distance of its centre. */
  tolerance: 14,
  missesAllowed: 3,
  /** Two slams cannot come closer than this: the stamp needs to lift. */
  cooldownMs: 170,
  stepMs: 1000 / 120,
} as const;

export interface Dossier {
  x: number;
  state: "pending" | "stamped" | "missed";
  /** Which month of proofs it holds, for the label. */
  label: string;
}

export type DeskStatus = "ready" | "running" | "won" | "lost";
export type DeskEvent = "start" | "stamp" | "void" | "late" | "won" | "lost";

export interface DeskSim {
  status: DeskStatus;
  t: number;
  distance: number;
  dossiers: Dossier[];
  misses: number;
  endX: number;
  speedScale: number;
  accumulator: number;
  lastSlamAt: number;
  /** Where the last slam landed (screen x) and whether it was a hit. */
  lastSlamX: number;
  lastSlamHit: boolean;
  lastMissAt: number;
}

const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

export function generateDossiers(seed: number): Dossier[] {
  const random = mulberry32(seed);
  const dossiers: Dossier[] = [];
  let x = DESK.firstX;
  const firstMonth = Math.floor(random() * 12);
  for (let i = 0; i < DESK.dossiers; i++) {
    dossiers.push({ x, state: "pending", label: MONTHS[(firstMonth + i) % 12] });
    x += DESK.spacing[0] + (DESK.spacing[1] - DESK.spacing[0]) * random();
  }
  return dossiers;
}

export function createDeskSim(seed: number, options: { speedScale?: number } = {}): DeskSim {
  const dossiers = generateDossiers(seed);
  return {
    status: "ready",
    t: 0,
    distance: 0,
    dossiers,
    misses: 0,
    endX: dossiers[dossiers.length - 1].x + 80,
    speedScale: options.speedScale ?? 1,
    accumulator: 0,
    lastSlamAt: -Infinity,
    lastSlamX: DESK.stampX,
    lastSlamHit: false,
    lastMissAt: -Infinity,
  };
}

export function beltSpeed(sim: DeskSim): number {
  const progress = Math.min(1, Math.max(0, sim.distance / sim.endX));
  return (DESK.speed[0] + (DESK.speed[1] - DESK.speed[0]) * progress) * sim.speedScale;
}

export function dossierScreenX(sim: DeskSim, dossier: Dossier): number {
  return DESK.stampX + (dossier.x - sim.distance);
}

export function stampedCount(sim: DeskSim): number {
  return sim.dossiers.filter(d => d.state === "stamped").length;
}

export function nextDossier(sim: DeskSim): Dossier | undefined {
  return sim.dossiers.find(d => d.state === "pending");
}

function finish(sim: DeskSim, events: DeskEvent[]) {
  if (sim.status !== "running") return;
  if (sim.misses >= DESK.missesAllowed) { sim.status = "lost"; events.push("lost"); return; }
  if (sim.dossiers.every(d => d.state !== "pending")) { sim.status = "won"; events.push("won"); }
}

/** The first slam starts the belt; later ones stamp whatever is under them. */
export function slamStamp(sim: DeskSim): DeskEvent[] {
  if (sim.status === "ready") { sim.status = "running"; return ["start"]; }
  if (sim.status !== "running" || sim.t - sim.lastSlamAt < DESK.cooldownMs) return [];
  sim.lastSlamAt = sim.t;
  const events: DeskEvent[] = [];
  const under = sim.dossiers.find(d => d.state === "pending" && Math.abs(d.x - sim.distance) <= DESK.tolerance);
  if (under) {
    under.state = "stamped";
    sim.lastSlamX = dossierScreenX(sim, under);
    sim.lastSlamHit = true;
    events.push("stamp");
  } else {
    sim.lastSlamX = DESK.stampX;
    sim.lastSlamHit = false;
    sim.misses += 1;
    sim.lastMissAt = sim.t;
    events.push("void");
  }
  finish(sim, events);
  return events;
}

function substep(sim: DeskSim, dt: number, events: DeskEvent[]) {
  sim.t += dt * 1000;
  if (sim.status !== "running") return;
  sim.distance += beltSpeed(sim) * dt;
  for (const dossier of sim.dossiers) {
    if (dossier.state === "pending" && dossier.x - sim.distance < -DESK.tolerance) {
      dossier.state = "missed";
      sim.misses += 1;
      sim.lastMissAt = sim.t;
      events.push("late");
    }
  }
  finish(sim, events);
}

export function stepDesk(sim: DeskSim, elapsedMs: number): DeskEvent[] {
  const events: DeskEvent[] = [];
  sim.accumulator += Math.min(elapsedMs, 100);
  while (sim.accumulator >= DESK.stepMs - 1e-6) {
    sim.accumulator -= DESK.stepMs;
    substep(sim, DESK.stepMs / 1000, events);
    if (sim.status === "won" || sim.status === "lost") { sim.accumulator = 0; break; }
  }
  return events;
}

/** Slam when the next folder is centred: documents the intended timing window. */
export function deskAutopilot(sim: DeskSim): boolean {
  if (sim.status === "ready") return true;
  if (sim.status !== "running") return false;
  const next = nextDossier(sim);
  return Boolean(next && Math.abs(next.x - sim.distance) <= 5 && sim.t - sim.lastSlamAt >= DESK.cooldownMs);
}
