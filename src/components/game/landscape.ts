import { seededRandom } from "@/lib/rng";
import { BIOMES, biomeMix, VIEW, WORLD_LENGTH } from "@/lib/game/world";

/**
 * Le relief des couches d'arrière-plan et l'inventaire du décor.
 *
 * ## Le repère de chaque couche
 *
 * Une couche de parallaxe défile plus lentement que le sol. Si son contenu était
 * placé aux coordonnées du monde, il finirait très loin hors de l'écran : à mi-chemin
 * du voyage, une montagne lointaine se retrouverait à des milliers d'unités à droite.
 *
 * Chaque couche a donc son propre repère, comprimé d'un facteur `f` : un élément
 * destiné à l'abscisse monde `w` est dessiné en `w * f`, et la couche est translatée
 * de `-caméra * f`. L'élément arrive donc au bord gauche de l'écran exactement quand
 * la caméra atteint `w`, tout en défilant `f` fois moins vite. Le biome d'un élément
 * se retrouve en divisant : `w = x / f`.
 *
 * Conséquence utile : les longueurs d'onde du relief se compriment aussi, ce qui
 * étire naturellement les montagnes lointaines. C'est le comportement attendu.
 */

/** Vitesse de défilement de chaque couche, du fond vers l'avant. */
export const LAYERS = {
  far: 0.16,
  mid: 0.38,
  close: 0.62,
  ground: 1,
  front: 1.24,
} as const;

interface RidgeParams {
  /** Altitude moyenne de la crête, en unités monde. */
  top: number;
  /** Débattement vertical. */
  amp: number;
  /** 0 = collines douces, 1.5 = pics déchiquetés. */
  rough: number;
}

const FAR: Record<string, RidgeParams> = {
  plaine: { top: 452, amp: 18, rough: 0.2 },
  foret: { top: 424, amp: 44, rough: 0.55 },
  marais: { top: 448, amp: 24, rough: 0.35 },
  lac: { top: 464, amp: 14, rough: 0.2 },
  cascade: { top: 304, amp: 104, rough: 1.2 },
  montagne: { top: 252, amp: 128, rough: 1.45 },
  desert: { top: 434, amp: 50, rough: 0.5 },
  taverne: { top: 420, amp: 46, rough: 0.7 },
};

const MID: Record<string, RidgeParams> = {
  plaine: { top: 506, amp: 14, rough: 0.15 },
  foret: { top: 482, amp: 34, rough: 0.7 },
  marais: { top: 500, amp: 18, rough: 0.4 },
  lac: { top: 506, amp: 10, rough: 0.2 },
  cascade: { top: 386, amp: 78, rough: 1 },
  montagne: { top: 360, amp: 90, rough: 1.15 },
  desert: { top: 490, amp: 38, rough: 0.45 },
  taverne: { top: 480, amp: 30, rough: 0.6 },
};

const CLOSE: Record<string, RidgeParams> = {
  plaine: { top: 536, amp: 11, rough: 0.16 },
  foret: { top: 520, amp: 26, rough: 0.8 },
  marais: { top: 536, amp: 14, rough: 0.4 },
  lac: { top: 530, amp: 8, rough: 0.2 },
  cascade: { top: 466, amp: 50, rough: 0.82 },
  montagne: { top: 450, amp: 62, rough: 1 },
  desert: { top: 522, amp: 32, rough: 0.5 },
  taverne: { top: 518, amp: 24, rough: 0.6 },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function paramsAt(table: Record<string, RidgeParams>, worldX: number): RidgeParams {
  const { a, b, t } = biomeMix(worldX);
  const pa = table[a.id];
  const pb = table[b.id];
  if (t === 0) return pa;

  return {
    top: lerp(pa.top, pb.top, t),
    amp: lerp(pa.amp, pb.amp, t),
    rough: lerp(pa.rough, pb.rough, t),
  };
}

function ridgeY(worldX: number, p: RidgeParams): number {
  const smooth =
    Math.sin(worldX * 0.00121 + 0.3) * 0.5 +
    Math.sin(worldX * 0.00287 + 1.9) * 0.32 +
    Math.sin(worldX * 0.00713 + 0.8) * 0.18;

  // Le produit de deux sinus rapides donne des sommets isolés plutôt qu'une
  // ondulation régulière : c'est ce qui fait lire la montagne comme une chaîne.
  const jagged =
    Math.abs(Math.sin(worldX * 0.00203 + 1.4)) *
    Math.abs(Math.sin(worldX * 0.00519 + 0.2));

  return p.top - p.amp * (0.5 + 0.5 * smooth) - p.amp * p.rough * 0.5 * jagged;
}

export const farRidgeY = (worldX: number) => ridgeY(worldX, paramsAt(FAR, worldX));
export const midRidgeY = (worldX: number) => ridgeY(worldX, paramsAt(MID, worldX));
export const closeRidgeY = (worldX: number) => ridgeY(worldX, paramsAt(CLOSE, worldX));

/* ------------------------------------------------------------------ décor */

export type PropKind =
  | "sapin"
  | "feuillu"
  | "fougere"
  | "champignon"
  | "souche"
  | "roseau"
  | "arbreMort"
  | "nenuphar"
  | "pilotis"
  | "rocher"
  | "cairn"
  | "cactus"
  | "os"
  | "buisson"
  | "lanterne"
  | "tonneau";

export interface Prop {
  kind: PropKind;
  /** Abscisse dans le repère de la couche. */
  x: number;
  /** Abscisse monde correspondante, pour retrouver la palette du biome. */
  worldX: number;
  /** Facteur de taille, autour de 1. */
  scale: number;
  /** Sert aux variations internes du dessin. */
  seed: number;
  /** Léger enfoncement, pour éviter l'alignement au cordeau. */
  sink: number;
}

/** Ce que l'on croise dans chaque biome. Les doublons pèsent plus lourd au tirage. */
const PROP_TABLE: Record<string, PropKind[]> = {
  plaine: ["buisson", "fougere", "fougere", "champignon", "feuillu"],
  foret: [
    "sapin",
    "sapin",
    "sapin",
    "feuillu",
    "fougere",
    "fougere",
    "champignon",
    "souche",
  ],
  marais: ["roseau", "roseau", "arbreMort", "nenuphar", "souche", "champignon"],
  lac: ["pilotis", "roseau", "nenuphar"],
  cascade: ["rocher", "rocher", "fougere", "sapin", "cairn"],
  montagne: ["rocher", "rocher", "sapin", "cairn"],
  desert: ["cactus", "cactus", "os", "buisson", "rocher"],
  taverne: ["lanterne", "tonneau", "buisson", "feuillu"],
};

/** Écartement moyen entre deux éléments, en unités monde. */
const PROP_SPACING: Record<string, number> = {
  plaine: 108,
  foret: 78,
  marais: 92,
  lac: 210,
  cascade: 88,
  montagne: 100,
  desert: 124,
  taverne: 104,
};

/**
 * Le parvis de la taverne reste dégagé : c'est là que se termine la course, et
 * un cactus devant la porte gâcherait l'arrivée.
 */
const KEEP_CLEAR: Array<[number, number]> = [[0.9, 0.96]];

const isClear = (position: number) =>
  !KEEP_CLEAR.some(([from, to]) => position >= from && position <= to);

interface PlanOptions {
  seed: number;
  /** Facteur de la couche : c'est lui qui comprime le repère. */
  factor: number;
  /** Multiplie l'écartement de référence. */
  spacing?: number;
  scale?: [number, number];
  keep?: PropKind[];
}

function planProps({
  seed,
  factor,
  spacing = 1,
  scale = [0.8, 1.2],
  keep,
}: PlanOptions): Prop[] {
  const random = seededRandom(seed);
  const props: Prop[] = [];

  for (const biome of BIOMES) {
    const kinds = keep
      ? PROP_TABLE[biome.id].filter((k) => keep.includes(k))
      : PROP_TABLE[biome.id];
    if (kinds.length === 0) continue;

    const step = PROP_SPACING[biome.id] * spacing;

    for (
      let worldX = biome.from * WORLD_LENGTH;
      worldX < biome.to * WORLD_LENGTH;
      worldX += step * (0.6 + random() * 0.8)
    ) {
      if (!isClear(worldX / WORLD_LENGTH)) continue;

      const kind = kinds[Math.floor(random() * kinds.length)];
      props.push({
        kind,
        x: worldX * factor,
        worldX,
        scale: scale[0] + random() * (scale[1] - scale[0]),
        seed: Math.floor(random() * 100000),
        // Les pierres sont franchement enchâssées dans le sol : aucune base flottante.
        sink: (kind === "rocher" || kind === "cairn" ? 4 : 0) + random() * 5,
      });
    }
  }

  return props;
}

/** Posés sur la crête intermédiaire : petits et pâles. */
export const MID_PROPS = planProps({
  seed: 77345,
  factor: LAYERS.mid,
  spacing: 1.5,
  scale: [0.42, 0.66],
});

/** Posés sur la crête proche : taille moyenne, bien lisibles. */
export const CLOSE_PROPS = planProps({
  seed: 20260827,
  factor: LAYERS.close,
  spacing: 1.15,
  scale: [0.66, 0.98],
});

/** Posés sur le sol foulé par les personnages, donc au facteur 1. */
export const GROUND_PROPS = planProps({
  seed: 5150,
  factor: LAYERS.ground,
  spacing: 1.9,
  scale: [0.9, 1.35],
});

/**
 * Touffes du tout premier plan, devant les personnages. Leur base est volontairement
 * sous le bas de l'écran : on ne voit que le sommet passer, ce qui donne la sensation
 * de vitesse sans masquer le jeu.
 */
export const FRONT_PROPS = planProps({
  seed: 31459,
  factor: LAYERS.front,
  spacing: 3.4,
  scale: [1.5, 2.3],
  keep: ["fougere", "roseau", "buisson"],
});

/** Hauteur de la base des touffes de premier plan. */
export const FRONT_BASE = VIEW.height + 26;
