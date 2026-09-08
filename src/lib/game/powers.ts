import type { PowerCast, PowerKind } from "@/lib/data/types";

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
      "Offre un shot — alcoolisé ou non — à un camarade. La dette suivra son classement.",
  },
  feuSacré: {
    kind: "feuSacré",
    name: "Fièvre du recruteur",
    short: "Tête en feu",
    description: "Embrase la tête d’un camarade sans brûler son CV.",
  },
  fienteDragon: {
    kind: "fienteDragon",
    name: "Fiente du dragon",
    short: "Dragon honteux",
    description: "Un dragon passe et dépose un feedback très personnel.",
  },
  paperasse: {
    kind: "paperasse",
    name: "Ouragan administratif",
    short: "Pluie de CV",
    description: "Ensevelit la cible sous une tornade de formulaires inutiles.",
  },
  crapaud: {
    kind: "crapaud",
    name: "Baiser LinkedIn",
    short: "Mode crapaud",
    description: "Invoque le crapaud corporate et ses recommandations inspirantes.",
  },
};

const POWER_CYCLE: PowerKind[] = [
  "shot",
  "feuSacré",
  "fienteDragon",
  "paperasse",
  "crapaud",
];

export interface AvailablePower {
  slot: number;
  kind: PowerKind;
}

export function powerForSlot(slot: number): PowerKind {
  return POWER_CYCLE[slot % POWER_CYCLE.length];
}

export function availablePowers(
  playerId: string,
  earnedChests: number,
  casts: PowerCast[],
): AvailablePower[] {
  const opened = earnedChests;
  const spent = new Set(
    casts.filter((cast) => cast.playerId === playerId).map((cast) => cast.slot),
  );

  return Array.from({ length: opened }, (_, slot) => ({
    slot,
    kind: powerForSlot(slot),
  })).filter((power) => !spent.has(power.slot));
}
