import { mulberry32, shuffle } from "@/lib/game/random";

/**
 * The chest's double bottom: a salary slot machine. Every tap stops the next
 * reel where it is; three "CHF" on the payline is the jackpot.
 */
export const SLOTS = {
  reels: 3,
  /** Symbols per second; each reel runs a little faster than the previous one. */
  speed: [5, 5.8, 6.6] as const,
  stepMs: 1000 / 120,
} as const;

export const SLOT_SYMBOLS = ["CHF", "selon exp.", "à discuter", "attractif", "13e salaire", "LPP", "tickets resto", "à négocier"] as const;
export type SlotSymbol = typeof SLOT_SYMBOLS[number];

export interface Reel {
  symbols: SlotSymbol[];
  /** Continuous position, in symbols; the payline shows symbols[round(offset)]. */
  offset: number;
  stopped: boolean;
}

export type SlotsStatus = "ready" | "spinning" | "won" | "lost";
export type SlotsEvent = "start" | "stop" | "won" | "lost";

export interface SlotsSim {
  status: SlotsStatus;
  t: number;
  reels: Reel[];
  /** Index of the reel the next tap stops. */
  current: number;
  accumulator: number;
  lastStopAt: number;
}

export function createSlotsSim(seed: number): SlotsSim {
  const random = mulberry32(seed);
  return {
    status: "ready",
    t: 0,
    reels: Array.from({ length: SLOTS.reels }, () => ({
      // Two jackpot symbols per reel, elsewhere the usual salary poetry.
      symbols: shuffle([...SLOT_SYMBOLS, "CHF"] as SlotSymbol[], random),
      offset: Math.floor(random() * SLOT_SYMBOLS.length),
      stopped: false,
    })),
    current: 0,
    accumulator: 0,
    lastStopAt: -Infinity,
  };
}

export function paylineIndex(reel: Reel): number {
  const n = reel.symbols.length;
  return ((Math.round(reel.offset) % n) + n) % n;
}

export function paylineSymbol(reel: Reel): SlotSymbol {
  return reel.symbols[paylineIndex(reel)];
}

export function startSlots(sim: SlotsSim): SlotsEvent[] {
  if (sim.status !== "ready") return [];
  sim.status = "spinning";
  return ["start"];
}

/** Stops the current reel where it is, snapping to the nearest symbol. */
export function stopReel(sim: SlotsSim): SlotsEvent[] {
  if (sim.status === "ready") return startSlots(sim);
  if (sim.status !== "spinning") return [];
  const reel = sim.reels[sim.current];
  reel.offset = Math.round(reel.offset);
  reel.stopped = true;
  sim.current += 1;
  sim.lastStopAt = sim.t;
  const events: SlotsEvent[] = ["stop"];
  if (sim.current >= sim.reels.length) {
    sim.status = sim.reels.every(r => paylineSymbol(r) === "CHF") ? "won" : "lost";
    events.push(sim.status);
  }
  return events;
}

export function stepSlots(sim: SlotsSim, elapsedMs: number): SlotsEvent[] {
  sim.accumulator += Math.min(elapsedMs, 100);
  while (sim.accumulator >= SLOTS.stepMs - 1e-6) {
    sim.accumulator -= SLOTS.stepMs;
    sim.t += SLOTS.stepMs;
    if (sim.status !== "spinning") continue;
    sim.reels.forEach((reel, index) => { if (!reel.stopped) reel.offset += SLOTS.speed[index] * SLOTS.stepMs / 1000; });
  }
  return [];
}

export function jackpotCount(sim: SlotsSim): number {
  return sim.reels.filter((reel, index) => index < sim.current && paylineSymbol(reel) === "CHF").length;
}

/** Stop when a CHF sits close enough to the payline: documents the timing window. */
export function slotsAutopilot(sim: SlotsSim): boolean {
  if (sim.status === "ready") return true;
  if (sim.status !== "spinning") return false;
  const reel = sim.reels[sim.current];
  const nearest = Math.round(reel.offset);
  return Math.abs(reel.offset - nearest) < 0.2 && reel.symbols[((nearest % reel.symbols.length) + reel.symbols.length) % reel.symbols.length] === "CHF";
}
