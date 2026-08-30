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

/**
 * Points par action. `entretien` reste en discussion (−3 ou +3) : le −3 crée la seule
 * vraie tension du jeu, puisque le rejet après entretien rapporte +10 derrière.
 */
export const POINTS = {
  candidature: 1,
  refus: 3,
  entretien: -3,
  rejetApresEntretien: 10,
  embauche: 0,
} as const;

/** Pas de voyage par action. Un entretien ramène trois cases en arrière. */
export const JOURNEY_STEPS = {
  candidature: 1,
  refus: 1,
  entretien: -3,
  rejetApresEntretien: 10,
  embauche: 0,
} as const;

/** Un coffre et un nouveau rang tous les dix pas, quelle que soit l'action. */
export const STEPS_PER_LEVEL = 10;

/** Quatre-vingts pas pour traverser le monde : chaque petit échec change le paysage. */
export const JOURNEY_TARGET = 80;

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
