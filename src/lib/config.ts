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
 * vraie tension du jeu, puisque le rejet après entretien rapporte +5 derrière.
 */
export const POINTS = {
  candidature: 1,
  refus: 1,
  entretien: -3,
  rejetApresEntretien: 5,
  embauche: 0,
} as const;

/** Mode Donjons & Refus : un niveau tous les N candidatures. */
export const APPLICATIONS_PER_LEVEL = 10;

/**
 * Pondération de la position sur le chemin. La somme doit valoir 1.
 * Le facteur temps fait avancer tout le monde vers l'arrivée au fil de la saison :
 * mener au score ne suffit donc pas à se retrouver seul au bout du chemin.
 */
export const RACE_WEIGHTS = {
  applications: 0.45,
  time: 0.35,
  level: 0.2,
} as const;

/** Nombre de candidatures qui vaut 100 % du facteur « candidatures ». */
export const APPLICATIONS_TARGET = 120;

/** Niveau qui vaut 100 % du facteur « niveau ». */
export const LEVEL_TARGET = 13;
