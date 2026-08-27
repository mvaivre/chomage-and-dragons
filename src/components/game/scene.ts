import { VIEW } from "@/lib/game/world";

/**
 * L'état de scène, réécrit à chaque image.
 *
 * Il n'existe qu'un seul canvas de jeu, et une dizaine de composants doivent lire ces
 * valeurs soixante fois par seconde. Un module partagé est le bon outil : passer un
 * objet mutable en prop est interdit par le compilateur React, et passer par l'état
 * React déclencherait un rendu par image.
 *
 * Personne ne lit ces valeurs pendant le rendu — uniquement dans le ticker Pixi.
 */

export interface Camera {
  /** Abscisse monde du bord gauche de l'écran. */
  x: number;
  /** Décalage vertical du monde, suit doucement le relief. */
  y: number;
  /** Échelle unités monde → pixels. */
  scale: number;
  /** Largeur visible, en unités monde. */
  viewW: number;
}

export interface Scene {
  camera: Camera;
  /** Intensité du tremblement, dans [0, 1]. Écrite par les effets. */
  shake: number;
  /** Abscisse monde visée : le personnage du joueur. */
  focus: number;
  /** Écart imposé à la main pour aller voir le peloton. */
  pan: number;
  /** Vrai pendant un glisser : le recentrage attend que le joueur lâche. */
  dragging: boolean;
}

export const scene: Scene = {
  camera: { x: 0, y: 0, scale: 1, viewW: VIEW.width },
  shake: 0,
  focus: 0,
  pan: 0,
  dragging: false,
};

/** Remise à zéro au montage du canvas, pour ne pas hériter d'une partie précédente. */
export function resetScene(): void {
  scene.camera = { x: 0, y: 0, scale: 1, viewW: VIEW.width };
  scene.shake = 0;
  scene.focus = 0;
  scene.pan = 0;
  scene.dragging = false;
}

/** Le bas du monde, assez loin pour que les remplissages couvrent tout tremblement. */
export const WORLD_BOTTOM = VIEW.height + 260;
