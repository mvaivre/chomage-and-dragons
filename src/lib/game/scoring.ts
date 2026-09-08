import { JOURNEY_STEPS, POINTS, STEPS_PER_LEVEL } from "@/lib/config";
import type { ActionKind, GameEvent } from "@/lib/data/types";

export function pointsFor(kind: ActionKind): number {
  return POINTS[kind];
}

export function stepsFor(kind: ActionKind): number {
  return JOURNEY_STEPS[kind];
}

export function stepsForEvent(event: GameEvent): number {
  return stepsFor(event.kind) * (event.kind === "candidature" && event.journeyMultiplier === 2 ? 2 : 1);
}

/** Replay the journal: ordinary setbacks never revoke an earned chest. Undo does. */
export function journeyProgress(events: GameEvent[]): { steps: number; earnedChests: number } {
  let steps = 0;
  let peak = 0;
  for (const event of events) {
    steps = Math.max(0, steps + stepsForEvent(event));
    peak = Math.max(peak, steps);
  }
  return { steps, earnedChests: Math.floor(peak / STEPS_PER_LEVEL) };
}

export function journeySteps(events: GameEvent[]): number {
  return journeyProgress(events).steps;
}

/** Niveau 1 = 0–9 pas de voyage, niveau 2 = 10–19, etc. */
export function levelFromSteps(steps: number): number {
  return Math.floor(Math.max(0, steps) / STEPS_PER_LEVEL) + 1;
}

/** Pas restants avant le prochain coffre. */
export function untilNextChest(steps: number, earnedChests = Math.floor(Math.max(0, steps) / STEPS_PER_LEVEL)): number {
  return (earnedChests + 1) * STEPS_PER_LEVEL - Math.max(0, steps);
}
