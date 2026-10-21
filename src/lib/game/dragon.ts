import { BIOMES, WORLD_LENGTH, biomeAt } from "./world";

export const DRAGON_VARIANTS = {
  green: { art: "/art/world-v3/animations/dragon-v3.webp", label: "vert" },
  red: { art: "/art/world-v3/animations/dragon-red-v1.webp", label: "rouge" },
  blue: { art: "/art/world-v3/animations/dragon-blue-v1.webp", label: "bleu" },
  black: { art: "/art/world-v3/animations/dragon-black-v1.webp", label: "noir aux yeux rouges" },
  gold: { art: "/art/world-v3/animations/dragon-gold-v1.webp", label: "doré glamour" },
} as const;
export type DragonVariant = keyof typeof DRAGON_VARIANTS;
/** The nest and its swallowing animation always keep the same coat. */
export function dragonVariantAt(x: number): DragonVariant {
  switch (biomeAt(x).id) {
    case "volcan": return "red";
    case "montagne": return "blue";
    case "marais": return "black";
    case "taverne": return "gold";
    default: return "green";
  }
}
const smooth = (n: number) => { const t = Math.max(0, Math.min(1, n)); return t*t*(3-2*t); };
/** A warning breath on the third click, plus a short breath every eighteen seconds. */
export function dragonFirePower(seconds: number, sinceVisit: number, visits: number, reduced = false): number {
  const warning = visits % 4 === 3 && sinceVisit >= 0 && sinceVisit < 3.1;
  if (reduced) return warning ? .7 : 0;
  const time = warning ? sinceVisit : Math.max(0, seconds) % 18 - 4;
  return smooth((time - .25) / .45) * smooth((3.1 - time) / .6);
}

export const DRAGON_DURATION = 6400;
export const DRAGON_MEAL_DURATION = 5400;
export const DRAGON_REPLIES = [
  "Le comble pour un dragon ? Avoir un coup de froid.",
  "La blague est finie. Laisse-moi tranquille.",
  "Encore un clic et je te mange.",
  "Je t’avais prévenu.",
] as const;

/** A fourth visit ends the exchange; the next one starts a new joke. */
export function dragonReply(visits: number) {
  const step = Math.max(0, Math.floor(visits)) % 4;
  return { step, line: DRAGON_REPLIES[step], swallow: step === 3 };
}

export function dragonMealFrame(ms: number): number {
  return ms < 700 ? 2 : ms < 1400 ? 3 : ms < 3000 ? 4 : ms < 3500 ? 5 : 6;
}
export type DragonBeat = "arrive" | "bite" | "digest" | "strain" | "release" | "leave";

/** The same clock drives the dragon and its victim; no independent timers. */
export function dragonBeat(ms: number): DragonBeat {
  if (ms < 1100) return "arrive";
  if (ms < 1900) return "bite";
  if (ms < 3500) return "digest";
  if (ms < 4300) return "strain";
  if (ms < 5300) return "release";
  return "leave";
}

export function dragonFrame(ms: number): number {
  const beat = dragonBeat(ms);
  return beat === "arrive" || beat === "leave" ? Math.floor(ms / 140) % 2
    : beat === "bite" ? ms < 1650 ? 2 : 3
      : beat === "digest" ? 4 : beat === "strain" ? 5 : 6;
}

/** Mostly alert, with a brief yawn and nap; nearby visitors always wake it. */
export function dragonIdleFrame(seconds: number, attentive = false, reducedMotion = false): 2 | 6 | 7 {
  if (attentive || reducedMotion || !Number.isFinite(seconds)) return 6;
  const phase = Math.max(0, seconds) % 48;
  if (phase >= 26 && phase < 33) return 7;
  return phase >= 24 && phase < 25 ? 2 : 6;
}

/** Nests belong to the road, not the camera. Forest nest stays outside the factory. */
export function dragonNests(left: number, right: number): number[] {
  const positions = [BIOMES.find(b => b.id === "foret")!.from * WORLD_LENGTH + 300,
    BIOMES.find(b => b.id === "montagne")!.from * WORLD_LENGTH + 600,
    (BIOMES.find(b => b.id === "marais")!.from + BIOMES.find(b => b.id === "marais")!.to) * WORLD_LENGTH / 2,
    (BIOMES.find(b => b.id === "volcan")!.from + BIOMES.find(b => b.id === "volcan")!.to) * WORLD_LENGTH / 2,
    BIOMES.find(b => b.id === "taverne")!.from * WORLD_LENGTH + 1200];
  const result: number[] = [];
  for (let lap = Math.max(0, Math.floor(left / WORLD_LENGTH)); lap <= Math.floor(right / WORLD_LENGTH); lap++) {
    for (const x of positions) if (x + lap * WORLD_LENGTH >= left && x + lap * WORLD_LENGTH <= right) result.push(x + lap * WORLD_LENGTH);
  }
  return result;
}

/** Seeing a nest is not arriving: only the live feet position unlocks it. */
export function canChallengeDragon(heroX: number | undefined, nestX: number, walking: boolean): boolean {
  return heroX !== undefined && Number.isFinite(heroX) && !walking && Math.abs(heroX - nestX) <= 210;
}
