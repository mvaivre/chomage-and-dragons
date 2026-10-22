/** Stable journey coordinates. These distances belong to saved games, not to a camera. */
export const WORLD_LENGTH = 30240;
export interface Biome {
  id: string;
  name: string;
  short: string;
  from: number;
  to: number;
}
export const BIOMES: Biome[] = [
  {
    id: "plaine",
    name: "Plaine de la Poisse",
    short: "Plaine",
    from: 0.0,
    to: 0.11,
  },
  { id: "foret", name: "Bois du Broyage", short: "Bois", from: 0.11, to: 0.24 },
  {
    id: "marais",
    name: "Marais du Malheur",
    short: "Marais",
    from: 0.24,
    to: 0.37,
  },
  { id: "lac", name: "Pont de la Pitié", short: "Pont", from: 0.37, to: 0.49 },
  {
    id: "cascade",
    name: "Les Larmes des Rejetés",
    short: "Les Larmes",
    from: 0.49,
    to: 0.61,
  },
  {
    id: "montagne",
    name: "Mont du Mépris",
    short: "Mont",
    from: 0.61,
    to: 0.73,
  },
  {
    id: "desert",
    name: "Désert du Désespoir",
    short: "Désert",
    from: 0.73,
    to: 0.8,
  },
  {
    id: "volcan",
    name: "Volcan de la Dernière Épreuve",
    short: "Volcan",
    from: 0.8,
    to: 0.87,
  },
  {
    id: "taverne",
    name: "Taverne du Triomphe",
    short: "Triomphe",
    from: 0.87,
    to: 1.0,
  },
];
/** Distance de jeu (nombre de traversées) vers abscisse monde. */
export function worldXFor(position: number): number {
  return Math.max(0, position) * WORLD_LENGTH;
}

/** Position dans l’itinéraire illustré répété, dans [0, 1]. */
export function positionFor(worldX: number): number {
  const x = Math.max(0, worldX);
  return x > 0 && x % WORLD_LENGTH === 0
    ? 1
    : (x % WORLD_LENGTH) / WORLD_LENGTH;
}

/** Le biome dominant à cette abscisse. Sert aux bandeaux et aux annonces. */
export function biomeAt(worldX: number): Biome {
  const p = positionFor(worldX);
  return (
    BIOMES.find((b) => p >= b.from && p < b.to) ?? BIOMES[BIOMES.length - 1]
  );
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Mélange deux couleurs 0xRRGGBB. */
export function mixColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 0xff;
  const ag = (a >> 8) & 0xff;
  const ab = a & 0xff;
  const br = (b >> 16) & 0xff;
  const bg = (b >> 8) & 0xff;
  const bb = b & 0xff;

  return (
    (Math.round(lerp(ar, br, t)) << 16) |
    (Math.round(lerp(ag, bg, t)) << 8) |
    Math.round(lerp(ab, bb, t))
  );
}
