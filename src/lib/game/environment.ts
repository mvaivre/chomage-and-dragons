import { BIOMES, WORLD_LENGTH } from "./world";
import { roomAt } from "./doors";
import { decorForLap, isCarvedTree } from "./decor";
import { residentPunchline } from "./punchlines";

export type EnvironmentKind = "troll" | "tree" | "hen" | "toad" | "gnome" | "ghost" | "skeleton" | "crow" | "spirit" | "squirrel" | "recruiter" | "coach" | "clerk" | "worker" | "traveller" | "dragon";
export interface EnvironmentSite { id: string; kind: EnvironmentKind; x: number; factor: number; biome: string; }

/** Scenery conversations follow what is visible, independently of the hero's journey. */
export function canExploreTarget(visible: boolean, paused: boolean): boolean {
  return visible && !paused;
}

export const ENVIRONMENT_LABELS: Record<EnvironmentKind, string> = {
  troll: "Parler au troll", tree: "Réveiller l’arbre", hen: "Taquiner la poule", toad: "Taquiner le crapaud", gnome: "Trinquer avec le gnome", ghost: "Appeler le fantôme", skeleton: "Interrompre le squelette", crow: "Déranger le corbeau", spirit: "Réveiller l’esprit",
  squirrel: "Saluer l’écureuil", recruiter: "Parler au recruteur", coach: "Interrompre le coach", clerk: "Parler au guichetier", worker: "Parler à l’ouvrier", traveller: "Saluer le voyageur",
  dragon: "Parler au dragon",
};
export function environmentLine(kind: EnvironmentKind, visit: number): string {
  return residentPunchline(kind, visit);
}

// The forest pilot passed desktop, mobile and wide-camera visual checks.
export const ENVIRONMENT_BIOMES = new Set(BIOMES.map(biome => biome.id));
const RESIDENTS: Record<string, EnvironmentKind[]> = {
  plaine: ["hen", "troll", "gnome"], foret: ["troll"], marais: ["toad", "ghost"], lac: ["toad", "gnome"], cascade: ["spirit", "toad"], montagne: ["troll", "ghost"], desert: ["skeleton", "troll"], taverne: ["gnome", "hen"],
};
/** Physical homes stay clear of doors across every parallax plane. */
export function environmentSites(left: number, right: number, factor: number): EnvironmentSite[] {
  const result: EnvironmentSite[] = [];
  for (let lap = Math.max(0, Math.floor(left / WORLD_LENGTH)); lap <= Math.floor(right / WORLD_LENGTH); lap++) {
    for (const biome of BIOMES) {
      if (!ENVIRONMENT_BIOMES.has(biome.id)) continue;
      const start = lap * WORLD_LENGTH + biome.from * WORLD_LENGTH;
      const woods = biome.id === "foret" && factor === 1;
      const carvedTrees = woods ? decorForLap(lap).filter(isCarvedTree) : [];
      for (let x = start + (factor === 1 ? woods ? 315 : 340 : 610), n = 0; x < lap * WORLD_LENGTH + biome.to * WORLD_LENGTH - 260; x += factor === 1 ? woods ? 780 : 760 : 1080, n++) {
        if (x < left || x > right || [-210, 0, 210].some(offset => roomAt(x + offset))) continue;
        if (carvedTrees.some(tree => Math.abs(tree.x - x) < 170)) continue;
        const types = RESIDENTS[biome.id];
        const kind = factor === 1 ? types[n % types.length] : n % 2 ? "crow" : "spirit";
        result.push({ id: `resident:${factor}:${x}`, x, factor, kind, biome: biome.id });
      }
    }
  }
  return result;
}
