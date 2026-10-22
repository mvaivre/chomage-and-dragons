import { BIOMES, WORLD_LENGTH } from "@/lib/game/world";

export interface HiddenItem {
  id: string;
  biome: string;
  name: string;
  clue: string;
  model: string;
  x: number;
}

/** A finite collection, shared by every friend; no bonus in the race. */
const ITEMS = [
  {
    biome: "plaine",
    name: "Le courrier jamais parti",
    clue: "Près des moulins au départ",
    model: "letter",
    x: 100,
  },
  {
    biome: "foret",
    name: "La clé oubliée",
    clue: "Dans les arbres après l’usine",
    model: "key",
    x: 6410,
  },
  {
    biome: "marais",
    name: "Le parchemin perdu",
    clue: "Dans la végétation du marais",
    model: "scroll",
    x: 9280,
  },
  {
    biome: "lac",
    name: "La chope égarée",
    clue: "Sur la rive près du pont",
    model: "tankard",
    x: 13310,
  },
  {
    biome: "cascade",
    name: "La boussole",
    clue: "Dans les rochers près de la cascade",
    model: "compass",
    x: 16780,
  },
  {
    biome: "montagne",
    name: "Le cristal bleu",
    clue: "Dans les rochers enneigés",
    model: "crystal",
    x: 20850,
  },
  {
    biome: "desert",
    name: "La lampe ancienne",
    clue: "Près des dunes",
    model: "lamp",
    x: 23380,
  },
  {
    biome: "volcan",
    name: "Le marteau de forge",
    clue: "Parmi les pierres noires du volcan",
    model: "hammer",
    x: 25200,
  },
  {
    biome: "taverne",
    name: "La couronne égarée",
    clue: "Près des lanternes avant la taverne",
    model: "crown",
    x: 28020,
  },
] as const;

export const HIDDEN_ITEMS: readonly HiddenItem[] = ITEMS.map((item) => ({
  ...item,
  id: `hidden:0:${item.biome}`,
}));

export function hiddenItemForId(id: string): HiddenItem | null {
  return HIDDEN_ITEMS.find((item) => item.id === id) ?? null;
}

export function hiddenBiomeLabel(item: Pick<HiddenItem, "biome">): string {
  return BIOMES.find((biome) => biome.id === item.biome)?.short ?? item.biome;
}

export function hiddenItemsInRange(
  left: number,
  right: number,
): readonly HiddenItem[] {
  return HIDDEN_ITEMS.filter(
    (item) =>
      item.x >= Math.max(0, left) && item.x <= Math.min(WORLD_LENGTH, right),
  );
}
