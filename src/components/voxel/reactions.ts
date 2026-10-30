export const CHOREOGRAPHIES = {
  pigeon: { impact: 260, duration: 2600 },
  pigeonDive: { impact: 340, duration: 2500 },
  sealedLetter: { impact: 380, duration: 2600 },
  lightning: { impact: 380, duration: 2500 },
  cocktail: { impact: 300, duration: 2700 },
  legendary: { impact: 560, duration: 3900 },
  trophy: { impact: 420, duration: 3700 },
  pigeonSquadron: { impact: 300, duration: 3000 },
  pigeonRocket: { impact: 260, duration: 2300 },
  pigeonReceipt: { impact: 260, duration: 3900 },
  coldShower: { impact: 360, duration: 2900 },
  slammedDoor: { impact: 420, duration: 2800 },
  storm: { impact: 380, duration: 3200 },
  bigNo: { impact: 460, duration: 2900 },
  refusalAvalanche: { impact: 420, duration: 4000 },
  coffee: { impact: 320, duration: 2800 },
  spotlight: { impact: 360, duration: 2900 },
  cocktailFireworks: { impact: 300, duration: 3100 },
  redCarpet: { impact: 320, duration: 3100 },
  gnomeBand: { impact: 360, duration: 4200 },
  formLetter: { impact: 460, duration: 3300 },
  anvil: { impact: 520, duration: 3300 },
  meteor: { impact: 700, duration: 3900 },
  frogReader: { impact: 420, duration: 4300 },
  mythicRejection: { impact: 600, duration: 4800 },
  grandFireworks: { impact: 420, duration: 4200 },
  pigeonAscension: { impact: 420, duration: 4400 },
  shotVolley: { impact: 440, duration: 4000 },
  fireCurse: { impact: 380, duration: 3600 },
  dragonDrop: { impact: 1100, duration: 6400 },
  frogCurse: { impact: 300, duration: 2300 },
  paperStorm: { impact: 300, duration: 3800 },
} as const;
export type EffectKind = keyof typeof CHOREOGRAPHIES | "chest" | "dragonMeal";
export interface Effect {
  id: string;
  kind: EffectKind;
  origin: { x: number; y: number };
  playerId?: string;
  loud?: boolean;
  /** The shared post-interview stamp gag; the saved variant remains unchanged. */
  stampCrush?: boolean;
}
export function reactionTiming(kind: EffectKind, stampCrush = false) {
  if (stampCrush) return CHOREOGRAPHIES.legendary;
  return kind === "chest"
    ? { impact: 1900, duration: 3200 }
    : kind === "dragonMeal"
      ? { impact: 900, duration: 5400 }
      : CHOREOGRAPHIES[kind];
}
export const REACTION_HOLD = {
  candidature: 0.75,
  refus: 0.95,
  entretien: 0.85,
  rejetApresEntretien: 1.35,
  embauche: 1.1,
} as const;
export type HeroMotion = "idle" | "walk" | "send" | "hurt" | "celebrate";
