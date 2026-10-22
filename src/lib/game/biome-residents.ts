/** Each resident belongs to one habitat. */
export const BIOME_RESIDENTS = {
  hedgehog: { biome: "plaine", model: "hedgehog" },
  fox: { biome: "foret", model: "fox" },
  mushroom: { biome: "marais", model: "mushroom" },
  otter: { biome: "lac", model: "otter" },
  heron: { biome: "cascade", model: "heron" },
  goat: { biome: "montagne", model: "goat" },
  yeti: { biome: "montagne", model: "yeti" },
  scarab: { biome: "desert", model: "scarab" },
  innkeeper: { biome: "taverne", model: "innkeeper" },
} as const;

export type BiomeResidentKind = keyof typeof BIOME_RESIDENTS;
export type BiomeResidentProfile = (typeof BIOME_RESIDENTS)[BiomeResidentKind];
