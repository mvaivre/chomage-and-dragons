import type { PlayerView } from "@/hooks/useGame";
import { worldXFor } from "@/lib/game/world";
/** Animation origins use the saved route coordinate; depth lanes live in the renderer. */
export function heroOrigin(player: PlayerView) {
  return { x: worldXFor(player.position), y: 0 };
}
export function chestXForStep(step: number, length: number, target: number) {
  return (step / target) * length;
}

/** Only an uncollected forward milestone can interrupt the cosmetic walk. */
export function chestStopForJourney(
  from: number,
  target: number,
  step: number | null,
  length: number,
  totalSteps: number,
) {
  if (step === null || target < from) return null;
  const at = chestXForStep(step, length, totalSteps);
  if (at < from - 0.01 || at > target + 0.01) return null;
  return Math.max(from, at - 62.5);
}
