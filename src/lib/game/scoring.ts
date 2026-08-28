import { JOURNEY_STEPS, POINTS, STEPS_PER_LEVEL } from "@/lib/config";
import type { ActionKind, GameEvent } from "@/lib/data/types";

export function pointsFor(kind: ActionKind): number {
  return POINTS[kind];
}

export function stepsFor(kind: ActionKind): number {
  return JOURNEY_STEPS[kind];
}

export function journeySteps(events: GameEvent[]): number {
  return events.reduce(
    (total, event) => Math.max(0, total + stepsFor(event.kind)),
    0,
  );
}

/** Niveau 1 = 0–9 pas de voyage, niveau 2 = 10–19, etc. */
export function levelFromSteps(steps: number): number {
  return Math.floor(Math.max(0, steps) / STEPS_PER_LEVEL) + 1;
}

/** Pas restants avant le prochain coffre. */
export function untilNextChest(steps: number): number {
  return STEPS_PER_LEVEL - (Math.max(0, steps) % STEPS_PER_LEVEL);
}
