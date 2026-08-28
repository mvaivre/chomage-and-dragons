import { JOURNEY_TARGET } from "@/lib/config";

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/**
 * Position sur le chemin, dans [0, 1].
 *
 * Volontairement découplée du score : une action peut coûter des points mais ne
 * retire jamais l'effort accompli. Le calendrier ne déplace plus les personnages :
 * chaque mètre visible a été gagné par une vraie action.
 */
export function racePosition(steps: number): number {
  return clamp01(steps / JOURNEY_TARGET);
}
