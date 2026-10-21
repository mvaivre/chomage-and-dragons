"use client";

import { useRef } from "react";
import { chooseViewportResidents, type ResidentCandidate } from "@/lib/game/viewport-residents";
import { isDrawn, reactionProgress } from "./environment-targets";
import { viewportResidents } from "./resident-visibility";
import { scene } from "./scene";
import { useSceneTick } from "./useSceneTick";

/** NPCs animate normally, then one individual per appearance reaches the renderer. */
export function ViewportResidents() {
  const selected = useRef(new Map<string, string>());
  // Before animation, restore the bodies so their real geometry and hit areas update.
  useSceneTick({ priority: 40, callback: () => {
    for (const resident of viewportResidents.values()) for (const ref of [resident.body, resident.shadow, resident.accent]) {
      if (ref?.current) ref.current.renderable = true;
    }
  } });
  // After animation, before DOM hit areas (-20) and the Pixi render (-25).
  useSceneTick({ priority: -10, callback: () => {
    const candidates: ResidentCandidate[] = [];
    for (const resident of viewportResidents.values()) {
      const node = resident.body.current;
      if (!node || !isDrawn(node)) continue;
      const bounds = node.getBounds();
      candidates.push({ id: resident.id, kind: resident.kind, left: bounds.minX, right: bounds.maxX, top: bounds.minY, bottom: bounds.maxY,
        depth: resident.target?.current.factor ?? 1, reacting: Boolean(resident.target && reactionProgress(resident.target.current) < 1) });
    }
    selected.current = chooseViewportResidents(candidates, selected.current, scene.camera.viewW * scene.camera.scale, scene.topInset, scene.camera.viewH * scene.camera.scale - scene.bottomInset);
    for (const resident of viewportResidents.values()) {
      const shown = selected.current.get(resident.kind) === resident.id;
      for (const ref of [resident.body, resident.shadow, resident.accent]) if (ref?.current) ref.current.renderable = shown;
      if (!shown && resident.target) resident.target.current.visible = false;
    }
  } });
  return null;
}
