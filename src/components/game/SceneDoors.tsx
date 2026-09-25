"use client";

import { useRef } from "react";
import { useApplication } from "@pixi/react";
import { Texture, type Container, type Sprite } from "pixi.js";
import { roomAt, sameRoom } from "@/lib/game/doors";
import { markMotion, scene } from "./scene";
import { useSceneTick } from "./useSceneTick";

/** Exterior layers are switched as a whole: there is no illustration seam to hide. */
export function Outdoors({ children }: { children: React.ReactNode }) {
  const root = useRef<Container>(null);
  useSceneTick(() => { if (root.current) root.current.visible = !scene.room; });
  return <pixiContainer ref={root}>{children}</pixiContainer>;
}

/** Above the world, below the DOM HUD. The journal never changes during a fade. */
export function SceneDoors() {
  const veil = useRef<Sprite>(null);
  const { app } = useApplication();
  useSceneTick({ priority: 80, callback: ticker => {
    const desired = roomAt(scene.targetFocus);
    if (!scene.doorTransition && !sameRoom(desired, scene.room)) {
      // Also covers observing a friend or resuming after a remote state update.
      scene.doorTransition = { elapsed: 0, destination: desired, switched: false };
    }
    const transition = scene.doorTransition;
    let alpha = 0;
    if (transition) {
      markMotion();
      transition.elapsed += Math.min(100, ticker.elapsedMS) / 1000;
      const duration = scene.reducedMotion ? 0.12 : 0.24;
      const hold = 0.08;
      if (transition.elapsed < duration) alpha = transition.elapsed / duration;
      else {
        if (!transition.switched) {
          scene.room = transition.destination;
          transition.switched = true;
          scene.focus = scene.targetFocus;
          scene.pan = 0;
        }
        alpha = Math.max(0, 1 - (transition.elapsed - duration - hold) / duration);
      }
      if (transition.elapsed >= duration * 2 + hold) scene.doorTransition = null;
    }
    if (veil.current) {
      veil.current.width = app.screen.width;
      veil.current.height = app.screen.height;
      veil.current.alpha = alpha;
      veil.current.visible = alpha > 0;
    }
  }});
  return <pixiSprite ref={veil} label="door-fade" texture={Texture.WHITE} tint={0x17191b} alpha={0} eventMode="none" />;
}
