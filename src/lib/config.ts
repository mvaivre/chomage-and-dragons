/**
 * Source unique de vérité pour tous les réglages du jeu.
 * Rien de ce qui suit ne doit être dupliqué ailleurs dans le code.
 */

export const SEASON = {
  /** Bornes en ISO avec décalage explicite : Zurich est à +01:00 en janvier. */
  start: "2026-01-01T00:00:00+01:00",
  end: "2027-01-01T00:00:00+01:00",
  timeZone: "Europe/Zurich",
  label: "Saison 2026",
} as const;

/** Pas de voyage pour les nouvelles actions. */
export const JOURNEY_STEPS = {
  candidature: 8,
  refus: 12,
  entretien: -3,
  rejetApresEntretien: 18,
  embauche: 0,
} as const;

/**
 * Pas bonus gagnés aux mini-jeux, par action décorée. Ils comptent aussi au classement.
 */
export const MINI_GAME_BONUS = {
  candidature: 2,
  refus: 1,
  entretien: 1,
  rejetApresEntretien: 2,
  embauche: 0,
} as const;

/** Un coffre et un nouveau rang tous les dix pas, quelle que soit l'action. */
export const STEPS_PER_LEVEL = 10;

/** Deux cents pas par traversée. Le voyage continue jusqu’à l’embauche. */
export const JOURNEY_TARGET = 200;

/** Titres allitératifs des rangs, sans supposer que quelqu'un décroche un entretien. */
export const LEVEL_TITLES = [
  "Plaine de la Poisse",
  "Bois du Broyage",
  "Marais du Malheur",
  "Pont de la Pitié",
  "Ravin du Râteau",
  "Larmes des Rejetés",
  "Mont du Mépris",
  "Désert du Désespoir",
  "Château du Chagrin",
  "Taverne du Triomphe",
] as const;
