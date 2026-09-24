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
  fontWeight: "700",
  fill: INK,
};

/** Petit texte doré : niveau, classe. */
export const TAG_STYLE: TextStyleOptions = {
  fontFamily: BODY,
  fontSize: 15,
  fontWeight: "700",
  fill: INK,
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

let display: string | null = null;
/**
 * The title font as the page actually named it: next/font gives families
 * generated names, which a canvas can only reach through the CSS variable.
 */
export function displayFont(): string {
  if (display) return display;
  if (typeof document === "undefined") return SERIF;
  const family = getComputedStyle(document.documentElement).getPropertyValue("--font-pirata").trim();
  display = family ? `${family}, Georgia, serif` : SERIF;
  return display;
}
