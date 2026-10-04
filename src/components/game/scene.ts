import type { RoomLocation } from "@/lib/game/doors";
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
  /** The room the followed hero stands in; the door fade switches it under the black. */
  room: RoomLocation | null;
  /** `room` while the camera frames it, null once browsing has left it. Set by the camera rig. */
  viewedRoom: RoomLocation | null;
  doorTransition: { elapsed: number; destination: RoomLocation | null; switched: boolean } | null;
  momentActive: boolean;
  reducedMotion: boolean;
  atmosphereEnabled: boolean;
  atmosphereTime: number;
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
  /**
   * Last instant (performance.now) something moved on purpose: a hero walking, an
   * effect playing, the camera travelling. Calm scenes render at a lower rate.
   */
  lastMotion: number;
  /** True when Pixi fell back to its software renderer: fewer frames, lower density. */
  lowPower: boolean;
  /** Live feet position of every hero, so effects can follow the one they celebrate. */
  heroes: Map<string, { x: number; y: number }>;
  heroEffects: Map<string, { owner: symbol; x: number; y: number; scale: number; alpha: number; rotation: number }>;
  /** Camera zoom around the ground line; the moment of an action leans in. */
  zoom: number;
  zoomTarget: number;
  /** Where the followed hero sits across the screen, as a fraction of its width. */
  anchor: number;
  anchorTarget: number;
  /** World clock: frozen for a hit-stop, slowed for a legendary moment. */
  freezeUntil: number;
  slowUntil: number;
  slowScale: number;
  /** Real time of day in Zurich: 1 in full night, and the warmth of dawn and dusk. */
  night: number;
  warm: number;
  /** Until when the followed hero is walking, for residents that cheer as it passes. */
  walkingUntil: number;
}

/** Leaning in on the hero, then back to the travelling frame. */
export const FOLLOW_ANCHOR = 0.36;
export function leanIn(zoom: number, anchor = 0.46): void {
  scene.zoomTarget = zoom;
  scene.anchorTarget = anchor;
}
export function leanOut(): void {
  scene.zoomTarget = 1;
  scene.anchorTarget = FOLLOW_ANCHOR;
}

/** A brief freeze at the instant of impact. */
export function hitStop(ms: number): void {
  if (scene.reducedMotion) return;
  scene.freezeUntil = Math.max(scene.freezeUntil, performance.now() + ms);
}

export function slowMotion(scale: number, ms: number): void {
  if (scene.reducedMotion) return;
  scene.slowScale = scale;
  scene.slowUntil = performance.now() + ms;
}

/** Seconds of world time in this frame, after hit-stop and slow motion. */
export function worldDelta(elapsedMS: number): number {
  const now = performance.now();
  if (now < scene.freezeUntil || scene.doorTransition) return 0;
  const seconds = elapsedMS / 1000;
  return now < scene.slowUntil ? seconds * scene.slowScale : seconds;
}

const NIGHT_COLOR = 0x3f4c8c;
const DUSK_COLOR = 0xffc896;

function mix(a: number, b: number, t: number): number {
  const channel = (shift: number) => Math.round(((a >> shift) & 0xff) + ((((b >> shift) & 0xff) - ((a >> shift) & 0xff)) * t));
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/**
 * The light of one depth plane: 1 for the far hills, which sink into the night,
 * down to almost 0 for the heroes, who must stay readable. Dusk warms the same way.
 */
export function depthLight(shade: number): number {
  const night = mix(0xffffff, NIGHT_COLOR, scene.night * shade);
  return mix(night, DUSK_COLOR, scene.warm * 0.45 * shade * (1 - scene.night));
}

/** Screen pixels of a world point on the foreground plane, as the camera sees it now. */
export function worldToScreen(x: number, y: number): { x: number; y: number } {
  const { camera } = scene;
  return {
    x: (x - camera.x) * camera.scale,
    y: (y - camera.y) * camera.scale + camera.screenOffsetY,
  };
}

/** Called by anything that animates on purpose, from its ticker callback. */
export function markMotion(): void {
  scene.lastMotion = performance.now();
}

/**
 * DOM overlays that follow the scene run on its ticker, after the world moved: at the
 * scene's own rate (30 or 60 fps, nothing while paused), never at the display's 120 Hz.
 */
export const sceneFrameListeners = new Set<() => void>();

/** Drop any browsing offset: the camera goes back to framing the followed hero. */
export function recenterCamera(): void {
  scene.pan = 0;
  scene.exploreCenter = null;
}

export const scene: Scene = {
  room: null,
  viewedRoom: null,
  doorTransition: null,
  momentActive: false,
  reducedMotion: false,
  atmosphereEnabled: true,
  atmosphereTime: 0,
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
  lastMotion: 0,
  lowPower: false,
  heroes: new Map(),
  heroEffects: new Map(),
  zoom: 1,
  zoomTarget: 1,
  anchor: 0.36,
  anchorTarget: 0.36,
  freezeUntil: 0,
  slowUntil: 0,
  slowScale: 1,
  night: 0,
  warm: 0,
  walkingUntil: 0,
};

/** Remise à zéro au montage du canvas, pour ne pas hériter d'une partie précédente. */
export function resetScene(): void {
  scene.atmosphereTime = 0;
  scene.room = null;
  scene.viewedRoom = null;
  scene.doorTransition = null;
  scene.momentActive = false;
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
  scene.lastMotion = 0;
  scene.heroes.clear();
  scene.heroEffects.clear();
  scene.zoom = 1;
  scene.zoomTarget = 1;
  scene.anchor = FOLLOW_ANCHOR;
  scene.anchorTarget = FOLLOW_ANCHOR;
  scene.freezeUntil = 0;
  scene.slowUntil = 0;
}

/** Le bas du monde, assez loin pour que les remplissages couvrent tout tremblement. */
export const WORLD_BOTTOM = VIEW.height + 1040;

/**
 * The world x framed at the followed hero's place on screen, panning included.
 * The screen centre runs 0.14 of a view ahead of a resting hero: it would leave a
 * room early, near its exit.
 */
export function viewedX(): number {
  return scene.camera.x + scene.camera.viewW * scene.anchor;
}

/** Camera browsing may leave an interior; actual room and music still follow the hero. */
export function viewingInterior(): boolean {
  if (!scene.room) return false;
  const at = viewedX();
  return at >= scene.room.from - 100 && at <= scene.room.to + 100;
}
