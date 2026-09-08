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
  /** Hauteur visible, en unités monde. */
  viewH: number;
  /** Décalage vertical de composition, en pixels écran. */
  screenOffsetY: number;
}

export interface Scene {
  reducedMotion: boolean;
  camera: Camera;
  /** Screen pixels occupied by the action dock, measured when it resizes. */
  bottomInset: number;
  topInset: number;
  /** Intensité du tremblement, dans [0, 1]. Écrite par les effets. */
  shake: number;
  /** Abscisse monde visée : le personnage du joueur. */
  focus: number;
  /** Destination de la mise en scène ; `focus` la rejoint progressivement. */
  targetFocus: number;
  /** Vitesse du voyage caméra, accélérée lorsqu'une farce vise un autre joueur. */
  focusSpeed: number;
  /** Écart imposé à la main pour aller voir le peloton. */
  pan: number;
  /** Absolute centre for development composition checks, including resize. */
  exploreCenter: number | null;
  /** Vrai pendant un glisser : le recentrage attend que le joueur lâche. */
  dragging: boolean;
}

export const scene: Scene = {
  reducedMotion: false,
  bottomInset: 170,
  topInset: 160,
  camera: {
    x: 0,
    y: 0,
    scale: 1,
    viewW: VIEW.width,
    viewH: VIEW.height,
    screenOffsetY: 0,
  },
  shake: 0,
  focus: 0,
  targetFocus: 0,
  focusSpeed: 1.35,
  pan: 0,
  exploreCenter: null,
  dragging: false,
};

/** Remise à zéro au montage du canvas, pour ne pas hériter d'une partie précédente. */
export function resetScene(): void {
  scene.camera = {
    x: 0,
    y: 0,
    scale: 1,
    viewW: VIEW.width,
    viewH: VIEW.height,
    screenOffsetY: 0,
  };
  scene.shake = 0;
  scene.focus = 0;
  scene.targetFocus = 0;
  scene.focusSpeed = 1.35;
  scene.pan = 0;
  scene.exploreCenter = null;
  scene.dragging = false;
}

/** Le bas du monde, assez loin pour que les remplissages couvrent tout tremblement. */
export const WORLD_BOTTOM = VIEW.height + 1040;
