import { mulberry32 } from "@/lib/game/random";

/**
 * Fourteen days of silence after the fifth interview round. The recruiter
 * starts typing, stops, starts again. Answer only when a message really lands.
 */
export const GHOSTING = {
  /** The real message lands somewhere in this range. */
  messageAt: [9000, 14000] as const,
  /** How long the player has to answer once it landed. */
  windowMs: 1000,
  fakes: [3, 5] as const,
  fakeMs: [700, 1600] as const,
  /** Milliseconds of waiting per displayed day. */
  msPerDay: 800,
} as const;

export interface TypingBurst {
  at: number;
  duration: number;
}

export interface GhostingSchedule {
  fakes: TypingBurst[];
  messageAt: number;
}

export type GhostingPhase = "waiting" | "typing" | "message" | "gone";
export type GhostingVerdict = "won" | "early" | "late";

export function generateGhosting(seed: number): GhostingSchedule {
  const random = mulberry32(seed);
  const messageAt = GHOSTING.messageAt[0] + (GHOSTING.messageAt[1] - GHOSTING.messageAt[0]) * random();
  const count = GHOSTING.fakes[0] + Math.floor(random() * (GHOSTING.fakes[1] - GHOSTING.fakes[0] + 1));
  const fakes: TypingBurst[] = [];
  // Bursts are spread over the wait, none touching the real message.
  const first = 1500;
  const last = messageAt - 1800;
  const slot = (last - first) / count;
  for (let i = 0; i < count; i++) {
    // Each burst stays inside its own slice of the wait, so bursts never touch.
    const duration = Math.min(slot - 400, GHOSTING.fakeMs[0] + (GHOSTING.fakeMs[1] - GHOSTING.fakeMs[0]) * random());
    const at = first + slot * i + random() * Math.max(0, slot - duration - 300);
    fakes.push({ at, duration });
  }
  return { fakes, messageAt };
}

export function ghostingPhase(schedule: GhostingSchedule, t: number): GhostingPhase {
  if (t >= schedule.messageAt + GHOSTING.windowMs) return "gone";
  if (t >= schedule.messageAt) return "message";
  return schedule.fakes.some(burst => t >= burst.at && t < burst.at + burst.duration) ? "typing" : "waiting";
}

export function ghostingVerdict(schedule: GhostingSchedule, t: number): GhostingVerdict {
  const phase = ghostingPhase(schedule, t);
  return phase === "message" ? "won" : phase === "gone" ? "late" : "early";
}

export function waitingDay(t: number): number {
  return Math.floor(t / GHOSTING.msPerDay) + 1;
}
