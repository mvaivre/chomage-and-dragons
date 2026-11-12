import type { GameState, PowerCast, PowerKind } from "@/lib/data/types";
import { BONUS_POWER_SLOT_BASE, wonChestGames } from "@/lib/game/mini-games";

export interface PowerDefinition {
  kind: PowerKind;
  name: string;
  short: string;
  description: string;
}

export const POWERS: Record<PowerKind, PowerDefinition> = {
  shot: {
    kind: "shot",
    name: "Shot de la défaite",
    short: "Un shot dû",
    description:
      "Offre un shot à un camarade, alcoolisé ou non.",
  },
  feuSacré: {
    kind: "feuSacré",
    name: "Fièvre du recruteur",
    short: "Tête en feu",
    description: "Crame la tête d’un camarade. Elle fume pendant trois jours.",
  },
  fienteDragon: {
    kind: "fienteDragon",
    name: "Fiente du dragon",
    short: "Dragon honteux",
    description: "Le dragon avale ton camarade… puis le chie.",
  },
  paperasse: {
    kind: "paperasse",
    name: "Ouragan administratif",
    short: "Pluie de CV",
    description: "Ensevelit la cible sous les formulaires.",
  },
  crapaud: {
    kind: "crapaud",
    name: "Baiser LinkedIn",
    short: "Mode crapaud",
    description: "Invoque le crapaud de LinkedIn.",
  },
  cage: {
    kind: "cage",
    name: "Au cachot !",
    short: "En cage",
    description: "Enferme un camarade. Pour sortir, il faut gagner le labyrinthe du cachot.",
  },
  miniTroll: {
    kind: "miniTroll",
    name: "Troll à dos",
    short: "Mini-troll",
    description: "Accroche un mini-troll au dos d’un camarade. Trois jours de bave garantie.",
  },
};

const POWER_CYCLE: PowerKind[] = [
  "shot",
  "feuSacré",
  "fienteDragon",
  "paperasse",
  "crapaud",
];

// Extra loot has its own slots so existing chests and jackpots keep their contents.
const PRANK_SLOT_BASE = 1_000_000;
export const PRANK_DURATION_MS = 3 * 24 * 60 * 60 * 1000;
export const CAGED_MESSAGE = "Tu es en cage. Gagne le labyrinthe pour repartir.";

export function activeCage(casts: readonly PowerCast[], playerId: string) {
  return casts.find(cast => cast.targetPlayerId === playerId && cast.kind === "cage" && !cast.escapedAt);
}

export interface PlayerPranks {
  cage?: PowerCast;
  smoke?: PowerCast;
  troll?: PowerCast;
}

export function pranksByPlayer(casts: readonly PowerCast[], now: number): Map<string, PlayerPranks> {
  const players = new Map<string, PlayerPranks>();
  for (const cast of casts) {
    const status = cast.kind === "cage" ? "cage" : cast.kind === "feuSacré" ? "smoke" : cast.kind === "miniTroll" ? "troll" : null;
    if (!status) continue;
    if (status === "cage" ? cast.escapedAt : !(Date.parse(cast.expiresAt ?? "") > now)) continue;
    const pranks = players.get(cast.targetPlayerId) ?? {};
    const previous = pranks[status];
    if (!previous || (cast.expiresAt ?? cast.at) > (previous.expiresAt ?? previous.at)) pranks[status] = cast;
    players.set(cast.targetPlayerId, pranks);
  }
  return players;
}

export interface AvailablePower {
  slot: number;
  kind: PowerKind;
}

export function powerForSlot(slot: number): PowerKind {
  return POWER_CYCLE[slot % POWER_CYCLE.length];
}

/** A jackpot's loot is drawn from the attempt id, so it never changes on reload. */
export function bonusPowerKind(attemptId: string): PowerKind {
  let hash = 0;
  for (let i = 0; i < attemptId.length; i++) hash = (hash * 31 + attemptId.charCodeAt(i)) >>> 0;
  return POWER_CYCLE[hash % POWER_CYCLE.length];
}

export function availablePowers(
  playerId: string,
  earnedChests: number,
  casts: PowerCast[],
  miniGames: GameState["miniGames"] = [],
): AvailablePower[] {
  const spent = new Set(
    casts.filter((cast) => cast.playerId === playerId).map((cast) => cast.slot),
  );
  const chests = Array.from({ length: earnedChests }, (_, slot) => ({
    slot,
    kind: powerForSlot(slot),
  }));
  // Jackpots add loot on top of the chest cycle; losing the chest to undo loses it too.
  const jackpots = wonChestGames({ miniGames }, playerId, earnedChests).map((attempt) => ({
    slot: BONUS_POWER_SLOT_BASE + attempt.slot,
    kind: bonusPowerKind(attempt.id),
  }));
  const pranks: AvailablePower[] = [];
  for (let chest = 1, slot = PRANK_SLOT_BASE; chest <= earnedChests; chest += POWER_CYCLE.length, slot += 2) {
    pranks.push({ slot, kind: "cage" });
    if (chest + 1 <= earnedChests) pranks.push({ slot: slot + 1, kind: "miniTroll" });
  }
  return [...chests, ...jackpots, ...pranks].filter((power) => !spent.has(power.slot));
}
