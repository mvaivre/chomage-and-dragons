import type { RoomLocation } from "@/lib/game/doors";

/** Mutable render state. Game rules and persistence never depend on Three objects. */
export const scene = {
  room: null as RoomLocation | null,
  viewedRoom: null as RoomLocation | null,
  momentActive: false,
  reducedMotion: false,
  topInset: 0,
  bottomInset: 0,
  focus: 0,
  targetFocus: 0,
  pan: 0,
  exploreCenter: null as number | null,
  lastMotion: 0,
  heroes: new Map<string, { x: number; y: number }>(),
  dragonMeal: null as { nest: number; playerId: string; scale: number } | null,
  zoom: 1,
  zoomTarget: 1,
  night: 0,
  warm: 0,
};
export const residentReactions = new Map<
  string,
  { visits: number; at: number }
>();
export function leanIn(zoom: number, anchor = 0.46) {
  void anchor;
  scene.zoomTarget = zoom;
}
export function leanOut() {
  scene.zoomTarget = 1;
}
export function markMotion() {
  scene.lastMotion = performance.now();
}
export function recenterCamera() {
  scene.pan = 0;
  scene.exploreCenter = null;
}
export function resetScene() {
  scene.room = null;
  scene.viewedRoom = null;
  scene.momentActive = false;
  scene.pan = 0;
  scene.exploreCenter = null;
  scene.focus = 0;
  scene.targetFocus = 0;
  scene.zoom = 1;
  scene.zoomTarget = 1;
  scene.dragonMeal = null;
  scene.heroes.clear();
  residentReactions.clear();
}
