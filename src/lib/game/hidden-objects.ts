import { BIOMES, WORLD_LENGTH } from "@/lib/game/world";

export interface HiddenItem {
  id: string;
  biome: string;
  name: string;
  clue: string;
  art: string;
  x: number;
  y: number;
  size: number;
}

/** A finite collection, shared by every friend; no bonus in the race. */
const ITEMS = [
  { biome: "plaine", name: "Le courrier jamais parti", clue: "Près des moulins au départ", art: "letter", x: 100, y: 475, size: 44 },
  { biome: "foret", name: "La clé oubliée", clue: "Dans les arbres après l’usine", art: "key", x: 6410, y: 465, size: 40 },
  { biome: "marais", name: "Le parchemin perdu", clue: "Dans la végétation du marais", art: "scroll", x: 9280, y: 500, size: 40 },
  { biome: "lac", name: "La chope égarée", clue: "Sur la rive près du pont", art: "tankard", x: 13310, y: 480, size: 40 },
  { biome: "cascade", name: "La boussole", clue: "Dans les rochers près de la cascade", art: "compass", x: 16780, y: 510, size: 40 },
  { biome: "montagne", name: "Le cristal bleu", clue: "Dans les rochers enneigés", art: "crystal", x: 20850, y: 490, size: 44 },
  { biome: "desert", name: "La lampe ancienne", clue: "Près des dunes", art: "lamp", x: 24530, y: 500, size: 40 },
  { biome: "taverne", name: "La couronne égarée", clue: "Près des lanternes avant la taverne", art: "crown", x: 28020, y: 490, size: 42 },
] as const;

export const HIDDEN_ITEMS: readonly HiddenItem[] = ITEMS.map(item => ({
  ...item, id: `hidden:0:${item.biome}`,
  art: `/art/world-v3/collectibles/${item.art}.webp`,
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
