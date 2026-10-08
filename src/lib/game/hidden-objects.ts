import { BIOMES, surfaceAt, WORLD_LENGTH } from "@/lib/game/world";

export interface HiddenItem {
  id: string;
  biome: string;
  name: string;
  clue: string;
  found: string;
  art: string;
  x: number;
  y: number;
  size: number;
}

/** A finite collection, shared by every friend; no bonus in the race. */
const ITEMS = [
  { biome: "plaine", name: "Le courrier jamais parti", clue: "Un courrier prend racine dans la plaine. Cherche près du chemin, avant l’ORP.", found: "Livraison estimée : un jour, peut-être.", art: "action-candidature", x: 810, size: 54 },
  { biome: "foret", name: "Le crapaud du réseau", clue: "Dans le bois, un minuscule expert LinkedIn attend après l’usine.", found: "Il vient de t’ajouter à son réseau. Coâch certifié.", art: "power-frog", x: 6410, size: 48 },
  { biome: "marais", name: "Le formulaire perdu", clue: "La paperasse aime l’humidité. Fouille les berges du marais.", found: "Il manque encore l’annexe du formulaire perdu.", art: "power-paper", x: 9280, size: 48 },
  { biome: "lac", name: "Le verre de trop", clue: "Quelqu’un a oublié sa tournée au bord du pont.", found: "Le contenu ? Des promesses non contractuelles.", art: "power-shot", x: 13310, size: 46 },
  { biome: "cascade", name: "Le refus waterproof", clue: "Même les lettres imperméables pleurent près de la cascade.", found: "Votre profil ne correspond pas à notre degré d’humidité.", art: "action-refus", x: 16780, size: 48 },
  { biome: "montagne", name: "L’œuf du DRH", clue: "Dans la neige, un petit dragon couve ta candidature.", found: "Il éclora après validation du budget.", art: "power-dragon", x: 20850, size: 52 },
  { biome: "desert", name: "La flamme de la motivation", clue: "Le désert a gardé une dernière étincelle de motivation.", found: "Motivation retrouvée. Salaire toujours porté disparu.", art: "power-fire", x: 24530, size: 46 },
  { biome: "taverne", name: "La couronne égarée", clue: "La taverne cache une couronne. Regarde sous le nez des gagnant·es.", found: "Couronné·e pour services rendus à la procrastination.", art: "ui-crown", x: 29070, size: 48 },
] as const;

export const HIDDEN_ITEMS: readonly HiddenItem[] = ITEMS.map(item => ({
  ...item, id: `hidden:0:${item.biome}`, y: surfaceAt(item.x) - 2,
  art: `/art/world-v3/ui/${item.art}.webp`,
}));

export function hiddenItemForId(id: string): HiddenItem | null {
  return HIDDEN_ITEMS.find(item => item.id === id) ?? null;
}

export function hiddenBiomeLabel(item: Pick<HiddenItem, "biome">): string {
  return BIOMES.find(biome => biome.id === item.biome)?.short ?? item.biome;
}

export function hiddenItemsInRange(left: number, right: number): readonly HiddenItem[] {
  return HIDDEN_ITEMS.filter(item => item.x >= Math.max(0, left) && item.x <= Math.min(WORLD_LENGTH, right));
}
