import type { MiniGameAttempt, MiniGameKind } from "@/lib/data/types";
import { COURSE, type PigeonSim } from "@/lib/game/pigeon-flight";
import { DESK, stampedCount, type DeskSim } from "@/lib/game/stamp-desk";
import { RAIN, type RainSim } from "@/lib/game/keyword-rain";
import { QUIZ } from "@/lib/game/personality-quiz";
import { GHOSTING } from "@/lib/game/ghosting";
import { SLOTS, type SlotsSim, paylineSymbol } from "@/lib/game/slot-machine";

/**
 * One number per mini-game attempt, higher is better, so a group can keep
 * records and compare runs. Scores never change journey steps or points: the
 * reward of a game stays its win; the score is bragging rights.
 */

export const SCORE_UNITS: Record<MiniGameKind, string> = {
  pigeon: "m",
  keywords: "pts",
  stamp: "pts",
  quiz: "pts",
  ghosting: "pts",
  slots: "CHF",
};

export function pigeonScore(sim: PigeonSim): number {
  // Metres flown, and a bonus per feather kept when the letter is delivered.
  const metres = Math.round(sim.distance / 10);
  return sim.status === "delivered" ? metres + sim.feathers * 25 : metres;
}

export function stampScore(sim: DeskSim): number {
  return stampedCount(sim) * 10 + (sim.status === "won" ? (DESK.missesAllowed - sim.misses) * 15 : 0);
}

export function keywordsScore(sim: RainSim): number {
  const speed = sim.status === "won" ? Math.max(0, Math.round((20_000 - sim.t) / 200)) : 0;
  return Math.max(0, sim.caught.length * 20 - sim.badCaught * 15 + speed);
}

export function quizScore(correct: number, secondsLeft: number): number {
  return correct * 20 + Math.round(Math.max(0, secondsLeft) * 3);
}

/** The quicker the answer inside the window, the higher; late or early scores little. */
export function ghostingScore(reactionMs: number | null): number {
  if (reactionMs === null) return 0;
  return Math.max(10, Math.round(100 - (reactionMs / GHOSTING.windowMs) * 90));
}

export function slotsScore(sim: SlotsSim): number {
  return sim.reels.slice(0, SLOTS.reels).filter((reel) => paylineSymbol(reel) === "CHF").length;
}

/**
 * The highest score each game can really produce, with some slack. A device
 * sends its own score: anything above is clamped, so no one owns a record by
 * forging a number.
 */
export const SCORE_CAPS: Record<MiniGameKind, number> = {
  pigeon: 400,
  keywords: 250,
  stamp: DESK.dossiers * 10 + DESK.missesAllowed * 15,
  quiz: QUIZ.questions * 20 + QUIZ.questions * QUIZ.secondsPerQuestion * 3,
  ghosting: 100,
  slots: SLOTS.reels,
};

export function clampScore(kind: MiniGameKind, score: unknown): number | undefined {
  if (typeof score !== "number" || !Number.isFinite(score)) return undefined;
  return Math.max(0, Math.min(SCORE_CAPS[kind] ?? 0, Math.round(score)));
}

/** The best score of the group for one game, and whose it is. */
export function groupRecord(attempts: readonly MiniGameAttempt[], kind: MiniGameKind): MiniGameAttempt | null {
  let best: MiniGameAttempt | null = null;
  for (const attempt of attempts) {
    if (attempt.kind !== kind || attempt.score === undefined) continue;
    if (!best || attempt.score > (best.score ?? -Infinity)) best = attempt;
  }
  return best;
}

export function personalBest(attempts: readonly MiniGameAttempt[], kind: MiniGameKind, playerId: string): number | null {
  let best: number | null = null;
  for (const attempt of attempts) {
    if (attempt.kind === kind && attempt.playerId === playerId && attempt.score !== undefined) best = Math.max(best ?? -Infinity, attempt.score);
  }
  return best;
}

/** Keeps the constants honest: the best possible scores, for the tests. */
export const MAX_SCORES = {
  stamp: DESK.dossiers * 10 + DESK.missesAllowed * 15,
  quiz: QUIZ.questions * 20 + QUIZ.questions * QUIZ.secondsPerQuestion * 3,
  slots: SLOTS.reels,
  keywordsWords: RAIN.required * 20,
  pigeonFeathers: COURSE.feathers * 25,
};
