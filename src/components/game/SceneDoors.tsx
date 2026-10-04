"use client";

import { useRef } from "react";
import { useApplication } from "@pixi/react";
import { Texture, type Application, type Container, type Sprite } from "pixi.js";
import { inRoom, roomAt, type RoomLocation } from "@/lib/game/doors";
import { markMotion, scene } from "./scene";
import { useSceneTick } from "./useSceneTick";

/** Exterior layers are switched as a whole: there is no illustration seam to hide. */
export function Outdoors({ children }: { children: React.ReactNode }) {
  const root = useRef<Container>(null);
  useSceneTick(() => { if (root.current) root.current.visible = !scene.viewedRoom; });
  return <pixiContainer ref={root} label={OUTDOORS_LABEL}>{children}</pixiContainer>;
}

const OUTDOORS_LABEL = "outdoors";
type Uploader = { upload(resource: Container[]): Promise<void> };

/**
 * A hidden place has never been drawn, or its art left the GPU after a long stay
 * elsewhere: the first frame after the switch would upload every texture at once.
 * Prepare spreads those uploads over the fade out, a few per frame.
 */
function warmDestination(app: Application, destination: RoomLocation | null) {
  const prepare = (app.renderer as unknown as { prepare?: Uploader }).prepare;
  if (!prepare) return;
  const label = destination ? `interior:${destination.id}:${destination.from}` : OUTDOORS_LABEL;
  const targets = app.stage.getChildrenByLabel(label, true);
  if (targets.length) void prepare.upload(targets).catch(() => {});
}

/** Above the world, below the DOM HUD. The journal never changes during a fade. */
export function SceneDoors() {
  const veil = useRef<Sprite>(null);
  const { app } = useApplication();
  useSceneTick({ priority: 80, callback: ticker => {
    if (!scene.doorTransition && !inRoom(scene.targetFocus, scene.room)) {
      // Also covers observing a friend or resuming after a remote state update.
      scene.doorTransition = { elapsed: 0, destination: roomAt(scene.targetFocus), switched: false };
    }
    const transition = scene.doorTransition;
    let alpha = 0;
    if (transition) {
      markMotion();
      if (transition.elapsed === 0) warmDestination(app, transition.destination);
      transition.elapsed += Math.min(100, ticker.elapsedMS) / 1000;
      const duration = scene.reducedMotion ? 0.12 : 0.24;
      const hold = 0.08;
      if (transition.elapsed < duration) alpha = transition.elapsed / duration;
      else {
        if (!transition.switched) {
          // Under the black, show where the followed hero is now, even if the focus
          // changed during the fade out.
          transition.destination = roomAt(scene.targetFocus);
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
  return <pixiSprite ref={veil} label="door-fade" texture={Texture.WHITE} tint={0x17191b} alpha={0} visible={false} eventMode="none" />;
}
