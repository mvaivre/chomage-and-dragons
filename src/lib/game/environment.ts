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
  squirrel: ["Ta carrière ? Une coquille vide.", "Pas de noisette. Pas de service.", "Va grimper ailleurs."],
  recruiter: ["On a trouvé moins cher.", "Même le dragon refuse ton CV.", "Tu coûtes déjà trop cher."],
  coach: ["Achète ma formation. Puis crève.", "Ton échec paie mon loyer.", "Le talent ? Je vends autre chose."],
  clerk: ["Mauvaise file. Mauvaise vie.", "Il manque le formulaire du formulaire.", "Reviens quand je serai mort."],
  worker: ["La pause ? Une légende.", "Ils appellent ça une opportunité.", "Mon salaire ? De la fiction."],
  traveller: ["Encore toi. Quelle chance.", "Une quête ? Trouver un salaire.", "On avance. Ça empire."],
  dragon: ["Ton CV me donne des gaz.", "Même les RH sont plus digestes.", "Le salaire ? Dans mon cul."],
};
export function environmentLine(kind: EnvironmentKind, visit: number): string {
  const n = Math.max(0, Math.floor(visit));
  // Every other remark comes from the wider roast bank; themed dialogue still gives
  // each resident a voice, instead of making every NPC say exactly the same things.
  return n % 2 ? residentPunchline(kind, Math.floor(n / 2)) : LINES[kind][Math.floor(n / 2) % LINES[kind].length];
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
