import type { EncounterMove, WildEncounter } from "@/lib/data/types";
import { incomingHeavy, MONSTERS } from "@/lib/game/encounters";

export type BattlePhase = "player" | "enemy-windup" | "enemy-hit" | "ready";
export interface BattlePlayback {
  move: Exclude<EncounterMove, "challenge" | "leave">;
  after: WildEncounter;
  playerEnergy: number;
  enemyDamage: number;
  playerDamage: number;
  recovered: number;
  heavy: boolean;
  reply: boolean;
  playerLine: string;
  enemyLine: string;
}

/** Presentation only: replay the already saved result without awarding or rolling anything. */
export function battlePlayback(before: WildEncounter, after: WildEncounter, move: BattlePlayback["move"]): BattlePlayback {
  const recovered = move === "rest" ? Math.min(30, 100 - before.energy) : 0;
  const playerEnergy = before.energy + recovered;
  return {
    move, after, playerEnergy, recovered,
    enemyDamage: Math.max(0, playerEnergy - after.energy),
    playerDamage: Math.max(0, before.hp - after.hp),
    heavy: incomingHeavy(before),
    reply: after.status !== "captured",
    playerLine: move === "argue" ? "Argument béton !" : move === "polite" ? "Relance polie · protégé !" : move === "rest" ? `Pause · +${recovered} énergie !` : "Chômageball lancée…",
    enemyLine: `${MONSTERS[before.monster].attack} !`,
  };
}
