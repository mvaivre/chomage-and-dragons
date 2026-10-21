/** Each illustrated resident belongs to one habitat. */
export const BIOME_RESIDENTS = {
  hedgehog: { biome: "plaine", art: "/art/world-v3/animations/biome-hedgehog.webp", height: 64, referenceHeight: 346, width: 58 },
  fox: { biome: "foret", art: "/art/world-v3/animations/biome-fox-v2.webp", height: 82, referenceHeight: 236, width: 116 },
  mushroom: { biome: "marais", art: "/art/world-v3/animations/biome-mushroom.webp", height: 94, referenceHeight: 346, width: 72 },
  otter: { biome: "lac", art: "/art/world-v3/animations/biome-otter.webp", height: 76, referenceHeight: 240, width: 115 },
  heron: { biome: "cascade", art: "/art/world-v3/animations/biome-heron.webp", height: 112, referenceHeight: 346, width: 108 },
  goat: { biome: "montagne", art: "/art/world-v3/animations/biome-goat.webp", height: 110, referenceHeight: 346, width: 108 },
  yeti: { biome: "montagne", art: "/art/world-v3/animations/biome-yeti.webp", height: 172, referenceHeight: 346, width: 132 },
  scarab: { biome: "desert", art: "/art/world-v3/animations/biome-scarab.webp", height: 46, referenceHeight: 303, width: 62 },
  innkeeper: { biome: "taverne", art: "/art/world-v3/animations/biome-innkeeper.webp", height: 140, referenceHeight: 346, width: 100 },
} as const;

export type BiomeResidentKind = keyof typeof BIOME_RESIDENTS;
export type BiomeResidentProfile = (typeof BIOME_RESIDENTS)[BiomeResidentKind];
export function biomeResident(kind: string): BiomeResidentProfile | null {
  return BIOME_RESIDENTS[kind as BiomeResidentKind] ?? null;
}

/** Long idle holds with a blink and a small gesture; reactions face the player. */
export function biomeResidentFrame(time: number, reacting: boolean, reducedMotion: boolean): number {
  if (reducedMotion) return reacting ? 3 : 0;
  if (reacting) return 3;
  const phase = time % 10;
  return phase < 3 ? 0 : phase < 3.18 ? 1 : phase < 6 ? 0 : phase < 7.5 ? 2 : phase < 9 ? 0 : 3;
}
