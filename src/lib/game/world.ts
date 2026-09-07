/**
 * Le monde de Chômage & Dragons : une longue bande horizontale traversée de
 * gauche à droite, vue de côté.
 *
 * Tout est exprimé en « unités monde », qui sont les pixels de la résolution de
 * référence ci-dessous. La caméra se charge de mettre à l'échelle pour la fenêtre
 * réelle, donc rien dans le reste du code n'a à connaître la taille de l'écran.
 */

/** Résolution de référence. L'axe Y descend, comme partout en 2D. */
export const VIEW = { width: 1280, height: 720 } as const;

/** Ligne de raccord commune à toutes les tuiles de route et aux pieds des héros. */
export const WALKABLE_GROUND_Y = 602;

/**
 * Longueur totale du voyage. Un seul point représente maintenant un vrai morceau
 * de pays, assez long pour lire le déplacement et découvrir plusieurs détails.
 */
/**
 * Le monde visuel est composé de 21 modules de 720 unités. Les bitmaps source
 * font 1536 px de large : ils sont donc toujours réduits, jamais agrandis.
 */
export const WORLD_LENGTH = 15120;
export const WORLD_MODULE_COUNT = 21;

export interface BiomePalette {
  /** Dégradé du ciel, du haut vers l'horizon. */
  sky: [number, number];
  /** Silhouettes lointaines (facteur de parallaxe le plus faible). */
  far: number;
  /** Masses intermédiaires. */
  mid: number;
  /** Végétation et rochers proches. */
  near: number;
  /** Terre du premier plan et son ombre. */
  ground: number;
  groundDark: number;
  /** Touche de couleur : fleurs, neige, lanternes. */
  accent: number;
}

export interface Biome {
  id: string;
  /** Nom complet, annoncé en entrant dans la zone. */
  name: string;
  /** Nom court pour les bandeaux étroits. */
  short: string;
  /** Bornes en fraction du monde, dans [0, 1]. */
  from: number;
  to: number;
  /** Hauteur du sol au repos, en unités monde. */
  base: number;
  /** Amplitude du relief par-dessus cette hauteur. */
  amp: number;
  palette: BiomePalette;
}

/**
 * L'itinéraire. Les noms reprennent les étapes du pitch d'origine, augmentées du
 * lac et du désert : le décor s'assombrit jusqu'à la taverne, atteinte au crépuscule.
 */
export const BIOMES: Biome[] = [
  {
    id: "plaine",
    name: "Plaine de la Poisse",
    short: "Plaine",
    from: 0,
    to: 0.11,
    base: WALKABLE_GROUND_Y,
    amp: 0,
    palette: {
      sky: [0x79add2, 0xf0d9a5],
      far: 0x92a77d,
      mid: 0x657c58,
      near: 0x41583d,
      ground: 0x57452f,
      groundDark: 0x34291d,
      accent: 0xf2c85b,
    },
  },
  {
    id: "foret",
    name: "Bois du Broyage",
    short: "Bois",
    from: 0.11,
    to: 0.24,
    base: WALKABLE_GROUND_Y,
    amp: 0,
    palette: {
      sky: [0x7fb4d4, 0xdce9c8],
      far: 0x7d9c85,
      mid: 0x4f6f57,
      near: 0x33503d,
      ground: 0x4a3b2a,
      groundDark: 0x30271b,
      accent: 0xe4b94c,
    },
  },
  {
    id: "marais",
    name: "Marais du Malheur",
    short: "Marais",
    from: 0.24,
    to: 0.37,
    base: WALKABLE_GROUND_Y,
    amp: 0,
    palette: {
      sky: [0x93aa9b, 0xcdc6a4],
      far: 0x6d7c6b,
      mid: 0x4b594a,
      near: 0x323c2f,
      ground: 0x3d3826,
      groundDark: 0x272417,
      accent: 0x9fd06a,
    },
  },
  {
    id: "lac",
    name: "Pont de la Pitié",
    short: "Pont",
    from: 0.37,
    to: 0.49,
    base: WALKABLE_GROUND_Y,
    amp: 0,
    palette: {
      sky: [0x86b2d6, 0xdfeaf2],
      far: 0x7d9bb5,
      mid: 0x5c7f9c,
      near: 0x3e5c76,
      ground: 0x5a4632,
      groundDark: 0x392c1f,
      accent: 0x8fd7e8,
    },
  },
  {
    id: "cascade",
    name: "Les Larmes des Rejetés",
    short: "Les Larmes",
    from: 0.49,
    to: 0.61,
    base: WALKABLE_GROUND_Y,
    amp: 0,
    palette: {
      sky: [0x668eb7, 0xd8e8ed],
      far: 0x738ba4,
      mid: 0x506b78,
      near: 0x354c52,
      ground: 0x4d514d,
      groundDark: 0x293231,
      accent: 0xa8eff2,
    },
  },
  {
    id: "montagne",
    name: "Mont du Mépris",
    short: "Mont",
    from: 0.61,
    to: 0.73,
    base: WALKABLE_GROUND_Y,
    amp: 0,
    palette: {
      sky: [0x7099c0, 0xe4edf4],
      far: 0x8f9db2,
      mid: 0x69768a,
      near: 0x47515f,
      ground: 0x585751,
      groundDark: 0x393834,
      accent: 0xf4f8ff,
    },
  },
  {
    id: "desert",
    name: "Désert du Désespoir",
    short: "Désert",
    from: 0.73,
    to: 0.87,
    base: WALKABLE_GROUND_Y,
    amp: 0,
    palette: {
      sky: [0xe4ae64, 0xf7e5b4],
      far: 0xd7a468,
      mid: 0xc2864d,
      near: 0xa4673a,
      ground: 0xc2955a,
      groundDark: 0x8a6438,
      accent: 0xffdc92,
    },
  },
  {
    id: "taverne",
    name: "Taverne du Triomphe",
    short: "Triomphe",
    from: 0.87,
    to: 1,
    base: WALKABLE_GROUND_Y,
    amp: 0,
    palette: {
      sky: [0x2c3a5a, 0x6d5b74],
      far: 0x3c4962,
      mid: 0x2d374c,
      near: 0x212838,
      ground: 0x463824,
      groundDark: 0x2c2318,
      accent: 0xffc861,
    },
  },
];

/** Largeur de la zone de fondu entre deux biomes, en unités monde. */
const BLEND = 320;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Adoucit un 0→1 linéaire en une courbe sans angle aux extrémités. */
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Position de jeu (0 → 1) vers abscisse monde. */
export function worldXFor(position: number): number {
  return clamp01(position) * WORLD_LENGTH;
}

/** Abscisse monde vers position de jeu. */
export function positionFor(worldX: number): number {
  return clamp01(worldX / WORLD_LENGTH);
}

const boundary = (index: number) => BIOMES[index].to * WORLD_LENGTH;

/** Le biome dominant à cette abscisse. Sert aux bandeaux et aux annonces. */
export function biomeAt(worldX: number): Biome {
  const p = positionFor(worldX);
  return BIOMES.find((b) => p >= b.from && p < b.to) ?? BIOMES[BIOMES.length - 1];
}

/**
 * Les deux biomes en présence et leur poids respectif.
 *
 * Sans ce fondu, franchir une frontière ferait claquer le ciel d'une couleur à
 * l'autre en une image. Renvoyer des poids permet à chaque couche de se mélanger
 * elle-même, sans machinerie de transition ailleurs.
 */
export function biomeMix(worldX: number): {
  a: Biome;
  b: Biome;
  t: number;
} {
  const index = BIOMES.indexOf(biomeAt(worldX));
  const end = boundary(index);
  const next = BIOMES[index + 1];

  if (!next || worldX < end - BLEND) {
    return { a: BIOMES[index], b: BIOMES[index], t: 0 };
  }
  return { a: BIOMES[index], b: next, t: smooth((worldX - (end - BLEND)) / BLEND) };
}

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

/** La palette effective à cette abscisse, frontières fondues comprises. */
export function paletteAt(worldX: number): BiomePalette {
  const { a, b, t } = biomeMix(worldX);
  if (t === 0) return a.palette;

  return {
    sky: [
      mixColor(a.palette.sky[0], b.palette.sky[0], t),
      mixColor(a.palette.sky[1], b.palette.sky[1], t),
    ],
    far: mixColor(a.palette.far, b.palette.far, t),
    mid: mixColor(a.palette.mid, b.palette.mid, t),
    near: mixColor(a.palette.near, b.palette.near, t),
    ground: mixColor(a.palette.ground, b.palette.ground, t),
    groundDark: mixColor(a.palette.groundDark, b.palette.groundDark, t),
    accent: mixColor(a.palette.accent, b.palette.accent, t),
  };
}

/**
 * Hauteur de la surface sur laquelle marchent les personnages.
 *
 * Le monde v3 impose le même socket vertical à chaque module. Le relief existe au
 * centre des îlots décoratifs, jamais sur leurs bords ni sous les pieds du joueur.
 */
export function surfaceAt(worldX: number): number {
  void worldX;
  return WALKABLE_GROUND_Y;
}

/** Pente de la surface, pour incliner les personnages et les accessoires. */
export function slopeAt(worldX: number): number {
  void worldX;
  return 0;
}
