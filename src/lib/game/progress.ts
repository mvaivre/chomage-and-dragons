import { JOURNEY_TARGET } from "@/lib/config";

/** Continuous distance, in traversals of the illustrated itinerary. */
export function racePosition(steps: number): number {
  return Math.max(0, steps) / JOURNEY_TARGET;
}

/** Hiring ends at the next tavern, never sends a veteran backwards. */
export function hiredPosition(steps: number): number {
  return Math.max(1, Math.ceil(racePosition(steps)));
}
