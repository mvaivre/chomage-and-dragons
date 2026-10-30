export { scene, leanIn, leanOut, markMotion, recenterCamera } from "../game/scene";
import { resetScene as reset } from "../game/scene";
export const residentReactions = new Map<string, { visits: number; at: number }>();
export function resetScene() { reset(); residentReactions.clear(); }
