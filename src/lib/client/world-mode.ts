export type WorldMode = "2d" | "3d";
export const WORLD_MODE_KEY = "louchomage:renderer:v1";
export const WORLD_CHOICE_KEY = "louchomage:renderer-choice:v1";
export function hasChosenWorldMode(): boolean {
  if (typeof window === "undefined") return false;
  const preview = new URLSearchParams(window.location.search).get("renderer");
  if (preview === "2d" || preview === "3d") return true;
  try { return localStorage.getItem(WORLD_CHOICE_KEY) === "1"; } catch { return false; }
}
export function readWorldMode(): WorldMode {
  if (typeof window === "undefined") return "2d";
  const preview = new URLSearchParams(window.location.search).get("renderer");
  if (preview === "2d" || preview === "3d") return preview;
  try { return localStorage.getItem(WORLD_MODE_KEY) === "3d" ? "3d" : "2d"; } catch { return "2d"; }
}
export function rememberWorldMode(mode: WorldMode) {
  try { localStorage.setItem(WORLD_MODE_KEY, mode); } catch { /* This visit still works. */ }
}
export function chooseWorldMode(mode: WorldMode) {
  rememberWorldMode(mode);
  try { localStorage.setItem(WORLD_CHOICE_KEY, "1"); } catch { /* The choice still applies for this visit. */ }
}
