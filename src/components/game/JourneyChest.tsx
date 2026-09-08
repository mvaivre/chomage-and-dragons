"use client";

import { useRef } from "react";
import { useSceneTick as useTick } from "./useSceneTick";
import type { Container, Graphics, Sprite } from "pixi.js";
import { scene } from "./scene";
import { atlasFrames, useDirectTexture } from "./textures";

const drawShadow = (g: Graphics) => {
  g.clear().ellipse(0, 0, 35, 8).fill({ color: 0x211b18, alpha: 0.32 });
};

/** Closed and opening chests share the same size, baseline and contact shadow. */
export function JourneyChest({ x, y, opened = false, opening = false, onDone }: {
  x: number; y: number; opened?: boolean; opening?: boolean; onDone?: () => void;
}) {
  const texture = useDirectTexture("/art/world-v3/runtime/chest-journey.webp");
  const frames = texture ? atlasFrames(texture, 5, 1) : null;
  const sprite = useRef<Sprite>(null);
  const glint = useRef<Container>(null);
  const elapsed = useRef(0);
  const finished = useRef(false);
  useTick(ticker => {
    if (!opening) return;
    elapsed.current += ticker.elapsedMS;
    const t = elapsed.current / (scene.reducedMotion ? 250 : 1300);
    if (sprite.current && frames) {
      sprite.current.texture = frames[t < 0.2 ? 0 : t < 0.4 ? 1 : t < 0.84 ? 2 : 4];
      sprite.current.x = !scene.reducedMotion && t < 0.2 ? Math.sin(t * 120) * 2 : 0;
    }
    if (glint.current) glint.current.alpha = Math.sin(Math.min(1, t) * Math.PI) * 0.7;
    if (t >= 1 && !finished.current) { finished.current = true; onDone?.(); }
  });
  return <pixiContainer x={x} y={y}>
    <pixiGraphics draw={drawShadow} />
    {frames ? <pixiSprite ref={sprite} texture={frames[opened ? 4 : 0]} anchor={{ x: 0.5, y: 312 / 320 }} scale={0.34} /> : null}
    {opening ? <pixiContainer ref={glint} alpha={0} y={-40}>
      <pixiGraphics draw={g => { g.clear().ellipse(0, 0, 27, 16).fill({ color: 0xffd76c, alpha: 0.18 }); }} />
    </pixiContainer> : null}
  </pixiContainer>;
}
