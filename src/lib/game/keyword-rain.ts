import { mulberry32, pick, shuffle } from "@/lib/game/random";

/**
 * The applicant-tracking robot spits the job ad's keywords out of the sky.
 * Catch the five it asked for in your CV folder, dodge what gets a CV binned.
 * Fixed logical arena: RAIN.width by RAIN.height.
 */
export const RAIN = {
  width: 320,
  height: 240,
  basketWidth: 64,
  basketY: 206,
  basketSpeed: 420,
  wordSpeed: [70, 108] as const,
  spawnEveryMs: [900, 720] as const,
  required: 5,
  badAllowed: 1,
  rounds: 2,
  stepMs: 1000 / 120,
} as const;

export const REQUIRED_BANK = [
  "synergie", "agile", "proactif·ve", "polyvalent·e", "résilient·e", "autonome", "esprit d’équipe",
  "force de proposition", "orienté·e résultats", "rigoureux·se", "dynamique", "passionné·e", "curieux·se",
  "leadership", "bienveillance", "Excel avancé", "anglais courant", "permis B", "flexible", "multitâche",
] as const;

export const BAD_BANK = [
  "Comic Sans", "Word niveau expert", "hobbies : Netflix", "photo de vacances", "CV de 3 pages",
  "fôtes d’ortografe", "salaire : 12 000 CHF", "papier rose", "ex-chef en référence", "« je suis dispo là »",
] as const;

export const DECOY_BANK = [
  "disruptif", "scalable", "ownership", "mindset", "empowerment", "storytelling", "KPI", "growth",
  "pipeline", "onboarding", "benchmark", "quick win",
] as const;

export type WordKind = "required" | "bad" | "decoy";

export interface RainWord {
  id: number;
  text: string;
  kind: WordKind;
  x: number;
  y: number;
  vy: number;
  /** Small horizontal sway, for life. */
  sway: number;
  state: "falling" | "caught" | "missed";
}

export interface RainSpawn {
  at: number;
  text: string;
  kind: WordKind;
  x: number;
}

export type RainStatus = "ready" | "running" | "won" | "lost";
export type RainEvent = "start" | "caught" | "bad" | "decoy" | "missed" | "won" | "lost";

export interface RainSim {
  status: RainStatus;
  t: number;
  required: string[];
  caught: string[];
  badCaught: number;
  schedule: RainSpawn[];
  spawned: number;
  words: RainWord[];
  basketX: number;
  targetX: number;
  accumulator: number;
  lastCatchAt: number;
  lastBadAt: number;
}

export function wordWidth(text: string): number {
  return 14 + text.length * 6.4;
}

export function generateRain(seed: number): { required: string[]; schedule: RainSpawn[] } {
  const random = mulberry32(seed);
  const required = pick(REQUIRED_BANK, RAIN.required, random);
  const bad = pick(BAD_BANK, 4, random);
  const decoys = pick(DECOY_BANK, 6, random);
  const schedule: RainSpawn[] = [];
  let at = 700;
  let index = 0;
  for (let round = 0; round < RAIN.rounds; round++) {
    // Every requested word falls once per round, mixed with two traps and three decoys.
    const batch = shuffle([
      ...required.map(text => ({ text, kind: "required" as const })),
      ...bad.slice(round * 2, round * 2 + 2).map(text => ({ text, kind: "bad" as const })),
      ...decoys.slice(round * 3, round * 3 + 3).map(text => ({ text, kind: "decoy" as const })),
    ], random);
    for (const item of batch) {
      const progress = index / (RAIN.rounds * 10 - 1);
      const margin = wordWidth(item.text) / 2 + 6;
      schedule.push({ at, ...item, x: margin + (RAIN.width - margin * 2) * random() });
      at += RAIN.spawnEveryMs[0] + (RAIN.spawnEveryMs[1] - RAIN.spawnEveryMs[0]) * progress;
      index++;
    }
  }
  return { required, schedule };
}

export function createRainSim(seed: number): RainSim {
  const { required, schedule } = generateRain(seed);
  return {
    status: "ready",
    t: 0,
    required,
    caught: [],
    badCaught: 0,
    schedule,
    spawned: 0,
    words: [],
    basketX: RAIN.width / 2,
    targetX: RAIN.width / 2,
    accumulator: 0,
    lastCatchAt: -Infinity,
    lastBadAt: -Infinity,
  };
}

export function startRain(sim: RainSim): RainEvent[] {
  if (sim.status !== "ready") return [];
  sim.status = "running";
  return ["start"];
}

/** Where the folder should go; it travels there at a bounded speed. */
export function steerBasket(sim: RainSim, x: number) {
  const half = RAIN.basketWidth / 2;
  sim.targetX = Math.max(half, Math.min(RAIN.width - half, x));
}

function fallSpeed(sim: RainSim): number {
  const progress = Math.min(1, sim.spawned / Math.max(1, sim.schedule.length));
  return RAIN.wordSpeed[0] + (RAIN.wordSpeed[1] - RAIN.wordSpeed[0]) * progress;
}

function substep(sim: RainSim, dt: number, events: RainEvent[]) {
  sim.t += dt * 1000;
  if (sim.status !== "running") return;
  const step = RAIN.basketSpeed * dt;
  const delta = sim.targetX - sim.basketX;
  sim.basketX += Math.abs(delta) <= step ? delta : Math.sign(delta) * step;

  while (sim.spawned < sim.schedule.length && sim.schedule[sim.spawned].at <= sim.t) {
    const spawn = sim.schedule[sim.spawned];
    sim.words.push({ id: sim.spawned, text: spawn.text, kind: spawn.kind, x: spawn.x, y: -12, vy: fallSpeed(sim), sway: (sim.spawned % 2 ? 1 : -1) * 9, state: "falling" });
    sim.spawned++;
  }

  const half = RAIN.basketWidth / 2;
  for (const word of sim.words) {
    if (word.state !== "falling") continue;
    word.y += word.vy * dt;
    const x = word.x + Math.sin(word.y / 40) * word.sway;
    // A wanted word only needs to brush the folder; a trap has to land squarely in it.
    const reach = word.kind === "bad" ? half + 2 : half + wordWidth(word.text) / 2 - 10;
    if (word.y >= RAIN.basketY - 10 && word.y <= RAIN.basketY + 6 && Math.abs(x - sim.basketX) < reach) {
      word.state = "caught";
      if (word.kind === "required") {
        if (!sim.caught.includes(word.text)) sim.caught.push(word.text);
        sim.lastCatchAt = sim.t;
        events.push("caught");
      } else if (word.kind === "bad") {
        sim.badCaught += 1;
        sim.lastBadAt = sim.t;
        events.push("bad");
      } else events.push("decoy");
    } else if (word.y > RAIN.height + 12) {
      word.state = "missed";
      if (word.kind === "required") events.push("missed");
    }
  }
  sim.words = sim.words.filter(word => word.state === "falling" || sim.t - Math.max(sim.lastCatchAt, sim.lastBadAt) < 600);

  if (sim.badCaught > RAIN.badAllowed) { sim.status = "lost"; events.push("lost"); return; }
  if (sim.caught.length >= RAIN.required) { sim.status = "won"; events.push("won"); return; }
  if (sim.spawned >= sim.schedule.length && sim.words.every(word => word.state !== "falling")) { sim.status = "lost"; events.push("lost"); }
}

export function stepRain(sim: RainSim, elapsedMs: number): RainEvent[] {
  const events: RainEvent[] = [];
  sim.accumulator += Math.min(elapsedMs, 100);
  while (sim.accumulator >= RAIN.stepMs - 1e-6) {
    sim.accumulator -= RAIN.stepMs;
    substep(sim, RAIN.stepMs / 1000, events);
    if (sim.status === "won" || sim.status === "lost") { sim.accumulator = 0; break; }
  }
  return events;
}

export function wordScreenX(word: RainWord): number {
  return word.x + Math.sin(word.y / 40) * word.sway;
}

/** Chase the lowest wanted word, sidestep a trap about to land. Documents the intended difficulty. */
export function rainAutopilot(sim: RainSim): number | null {
  if (sim.status !== "running") return null;
  const falling = sim.words.filter(word => word.state === "falling");
  const wanted = falling.filter(word => word.kind === "required" && !sim.caught.includes(word.text)).sort((a, b) => b.y - a.y)[0];
  const threats = falling.filter(word => word.kind === "bad" && word.y > 90 && word.y < RAIN.basketY + 6);
  const clearance = RAIN.basketWidth / 2 + 14;
  const blocked = (x: number) => threats.some(threat => Math.abs(wordScreenX(threat) - x) < clearance);
  const target = wanted ? wordScreenX(wanted) : sim.basketX;
  if (!blocked(target)) return target;
  // Step aside from the nearest trap, towards the side with more room.
  const threat = threats.sort((a, b) => Math.abs(wordScreenX(a) - sim.basketX) - Math.abs(wordScreenX(b) - sim.basketX))[0];
  const tx = wordScreenX(threat);
  const left = tx - clearance - 6;
  const right = tx + clearance + 6;
  return blocked(left) || left < RAIN.basketWidth / 2 ? right : blocked(right) || right > RAIN.width - RAIN.basketWidth / 2 ? left : Math.abs(left - target) < Math.abs(right - target) ? left : right;
}
