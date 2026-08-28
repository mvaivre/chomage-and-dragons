import type { TextStyleOptions } from "pixi.js";

/** Titres et cartouches : la police du grimoire. */
export const SERIF = "'Pirata One', Georgia, serif";
/** Texte courant du canvas. */
export const BODY = "var(--font-garamond), 'EB Garamond', Georgia, serif";

export const INK = 0x241a10;
export const GOLD = 0xc9a227;
export const GOLD_LIGHT = 0xf0d78a;
export const PARCHMENT = 0xf2e3c0;

/** Plaque nominative sous les personnages. */
export const NAME_STYLE: TextStyleOptions = {
  fontFamily: BODY,
  fontSize: 19,
  fontWeight: "600",
  fill: PARCHMENT,
  stroke: { color: 0x1a120a, width: 4, join: "round" },
};

/** Petit texte doré : niveau, classe. */
export const TAG_STYLE: TextStyleOptions = {
  fontFamily: BODY,
  fontSize: 15,
  fill: GOLD_LIGHT,
  stroke: { color: 0x1a120a, width: 3, join: "round" },
};

/** Bandeau d'annonce d'un biome, traversé en chemin. */
export const BIOME_SIGN_STYLE: TextStyleOptions = {
  fontFamily: SERIF,
  fontSize: 21,
  fontWeight: "700",
  fill: INK,
  letterSpacing: 1.5,
};

export const SHOUT_STYLE: TextStyleOptions = {
  fontFamily: SERIF,
  fontSize: 44,
  fontWeight: "700",
  fill: PARCHMENT,
  letterSpacing: 4,
  stroke: { color: 0x2a0d0d, width: 7, join: "round" },
};
