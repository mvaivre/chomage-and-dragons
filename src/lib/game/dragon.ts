import { BIOMES, WORLD_LENGTH } from "./world";

export const DRAGON_DURATION = 6400;
export type DragonBeat = "arrive" | "bite" | "digest" | "strain" | "release" | "leave";

/** The same clock drives the dragon and its victim; no independent timers. */
export function dragonBeat(ms: number): DragonBeat {
  if (ms < 1100) return "arrive";
  if (ms < 1900) return "bite";
  if (ms < 3500) return "digest";
  if (ms < 4300) return "strain";
  if (ms < 5300) return "release";
  return "leave";
}

export function dragonFrame(ms: number): number {
  const beat = dragonBeat(ms);
  return beat === "arrive" || beat === "leave" ? Math.floor(ms / 140) % 2
    : beat === "bite" ? ms < 1650 ? 2 : 3
      : beat === "digest" ? 4 : beat === "strain" ? 5 : 6;
}

/** Nests belong to the road, not the camera. Forest nest stays outside the factory. */
export function dragonNests(left: number, right: number): number[] {
  const positions = [BIOMES.find(b => b.id === "foret")!.from * WORLD_LENGTH + 300,
    BIOMES.find(b => b.id === "montagne")!.from * WORLD_LENGTH + 600];
  const result: number[] = [];
  for (let lap = Math.max(0, Math.floor(left / WORLD_LENGTH)); lap <= Math.floor(right / WORLD_LENGTH); lap++) {
    for (const x of positions) if (x + lap * WORLD_LENGTH >= left && x + lap * WORLD_LENGTH <= right) result.push(x + lap * WORLD_LENGTH);
  }
  return result;
}

/** Seeing a nest is not arriving: only the live feet position unlocks it. */
export function canChallengeDragon(heroX: number | undefined, nestX: number, walking: boolean): boolean {
  return heroX !== undefined && Number.isFinite(heroX) && !walking && Math.abs(heroX - nestX) <= 210;
}
