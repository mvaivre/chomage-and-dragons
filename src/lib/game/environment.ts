import { BIOMES, WORLD_LENGTH } from "./world";
import { roomAt } from "./doors";
import { decorForLap } from "./decor";

export type EnvironmentKind = "troll" | "tree" | "hen" | "toad" | "gnome" | "ghost" | "skeleton" | "crow" | "spirit";
export interface EnvironmentSite { id: string; kind: EnvironmentKind; x: number; factor: number; biome: string; }

export const ENVIRONMENT_REACH = 320;
export function canExploreTarget(heroX: number | undefined, homeX: number, walking: boolean, paused: boolean, inside: boolean): boolean {
  return heroX !== undefined && Number.isFinite(heroX) && Number.isFinite(homeX) && !walking && !paused && !inside && Math.abs(heroX - homeX) <= ENVIRONMENT_REACH;
}

export const ENVIRONMENT_LABELS: Record<EnvironmentKind, string> = {
  troll: "Parler au troll", tree: "Réveiller l’arbre", hen: "Taquiner la poule", toad: "Taquiner le crapaud", gnome: "Trinquer avec le gnome", ghost: "Appeler le fantôme", skeleton: "Interrompre le squelette", crow: "Déranger le corbeau", spirit: "Réveiller l’esprit",
};
const LINES: Record<EnvironmentKind, string[]> = {
  troll: ["Même mon pont veut pas de toi.", "Ton CV ? Du PQ.", "Non. Et dégage.", "T’as essayé d’être riche ?"],
  tree: ["On dormait. Bordel.", "Pas de noisette ? Pas d’entretien.", "Va secouer ton patron."],
  hen: ["Encore un pigeon.", "Cocorico. T’es toujours pauvre.", "J’ai pondu. Et toi ?"],
  toad: ["Même l’eau te rejette.", "T’as embrassé pire.", "Le prince ? Licencié."],
  gnome: ["À ton prochain refus.", "Bois. Ça ne résout rien.", "La tournée ? C’est toi."],
  ghost: ["Mort. Pas disponible.", "Même mort, ils me relancent.", "Hanter les RH ? Déjà fait."],
  skeleton: ["Ils m’ont payé en exposition.", "Le poste ? Encore vacant.", "Je suis là depuis le stage."],
  crow: ["Ton CV fera un bon nid.", "Pièce jointe volée.", "Croâ. Dégage."],
  spirit: ["T’es vivant ? Quelle erreur.", "Le calme. Tu connais ?", "Même ici, pas de poste."],
};
export function environmentLine(kind: EnvironmentKind, visit: number): string { return LINES[kind][Math.max(0, Math.floor(visit)) % LINES[kind].length]; }

// The forest pilot passed desktop, mobile and wide-camera visual checks.
export const ENVIRONMENT_BIOMES = new Set(BIOMES.map(biome => biome.id));
const RESIDENTS: Record<string, EnvironmentKind[]> = {
  plaine: ["hen", "troll", "gnome"], foret: ["troll"], marais: ["toad", "ghost"], lac: ["toad", "gnome"], cascade: ["spirit", "toad"], montagne: ["troll", "ghost"], desert: ["skeleton", "troll"], taverne: ["gnome", "hen"],
};
/** Physical homes stay clear of doors; parallax never moves an encounter's arrival gate. */
export function environmentSites(left: number, right: number, factor: number): EnvironmentSite[] {
  const result: EnvironmentSite[] = [];
  for (let lap = Math.max(0, Math.floor(left / WORLD_LENGTH)); lap <= Math.floor(right / WORLD_LENGTH); lap++) {
    for (const biome of BIOMES) {
      if (!ENVIRONMENT_BIOMES.has(biome.id)) continue;
      const start = lap * WORLD_LENGTH + biome.from * WORLD_LENGTH;
      const woods = biome.id === "foret" && factor === 1;
      const carvedTrees = woods ? decorForLap(lap).filter(site => site.biome === "foret" && !site.setpiece && !["crown", "daily", "friend", "grave"].includes(site.kind)) : [];
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
