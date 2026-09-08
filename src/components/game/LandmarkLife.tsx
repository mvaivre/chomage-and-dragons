"use client";

import { useRef } from "react";
import type { Container, Graphics, Sprite } from "pixi.js";
import { useSceneTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";
import { parallaxX } from "./projection";
import { scene } from "./scene";
import { crownedChickenFrame } from "./ambient-animation";
import parts from "../../../public/art/world-v3/animations/tavern-life.json";

export interface LandmarkProps { worldX: number; factor: number; }

function inView({ worldX, factor }: LandmarkProps, margin = 800): boolean {
  const x = parallaxX(worldX, scene.camera.x, scene.camera.viewW, factor);
  return x > -margin && x < scene.camera.viewW + margin;
}

/** All poses and attachments use the clean plate's 960 × 549 coordinate system. */
export function TavernLife(props: LandmarkProps) {
  const source = useDirectTexture("/art/world-v3/animations/tavern-life.webp");
  const frames = source ? atlasFrames(source, 4, 2) : null;
  const chicken = useRef<Sprite>(null);
  const lamps = useRef<Array<Container | null>>([]);
  const halos = useRef<Array<Graphics | null>>([]);
  const flame = useRef<Sprite>(null);
  const smoke = useRef<Array<Sprite | null>>([]);
  const time = useRef(Math.abs(props.worldX) % 7);
  useSceneTick(ticker => {
    if (!frames || !inView(props)) return;
    if (!scene.reducedMotion) time.current += ticker.elapsedMS / 1000;
    const t = time.current;
    if (chicken.current) chicken.current.texture = frames[crownedChickenFrame(t)];
    lamps.current.forEach((lamp, i) => { if (lamp) lamp.rotation = Math.sin(t * 1.4 + i * 2.3) * 0.025; });
    halos.current.forEach((halo, i) => { if (halo) halo.alpha = 0.8 + Math.sin(t * 5.3 + i) * Math.sin(t * 8.7) * 0.2; });
    if (flame.current) {
      flame.current.scale.y = 12 / parts.heights[5] * (1 + Math.sin(t * 8.2) * 0.1);
      flame.current.skew.x = Math.sin(t * 5.4) * 0.09;
    }
    smoke.current.forEach((puff, i) => {
      if (!puff) return;
      puff.visible = !scene.reducedMotion;
      const progress = (t * 0.24 + i * 0.5) % 1;
      puff.position.set(220 + Math.sin(progress * 3 + i) * 9, 38 - progress * 48);
      puff.scale.set((19 + progress * 22) / parts.heights[6]);
      puff.alpha = Math.sin(progress * Math.PI) * 0.3;
    });
  });
  if (!frames) return null;
  return <pixiContainer>
    {Array.from({ length: 2 }, (_, i) => <pixiSprite key={`smoke-${i}`} ref={node => { smoke.current[i] = node; }} texture={frames[6]} anchor={{ x: 0.5, y: 312 / 320 }} alpha={0} />)}
    <pixiSprite ref={chicken} texture={frames[0]} x={487} y={309} anchor={{ x: 0.5, y: 312 / 320 }} scale={112 / parts.heights[0]} />
    {[{ x: 365, y: 251, height: 64 }, { x: 712, y: 171, height: 103 }].map(({ x, y, height }, i) => <pixiContainer key={i} ref={node => { lamps.current[i] = node; }} x={x} y={y}>
      <pixiGraphics ref={node => { halos.current[i] = node; }} draw={g => {
        g.clear();
        for (let ring = 3; ring > 0; ring--) g.ellipse(0, height * 0.7, height * (0.2 + ring * 0.13), height * (0.28 + ring * 0.12)).fill({ color: 0xffb62f, alpha: 0.035 });
      }} />
      <pixiSprite texture={frames[4]} anchor={{ x: 0.5, y: (312 - parts.heights[4]) / 320 }} scale={height / parts.heights[4]} />
    </pixiContainer>)}
    {/* The outside table is hidden by the verge; animate the visible doorway candle. */}
    <pixiSprite ref={flame} texture={frames[5]} x={271} y={337} anchor={{ x: 0.5, y: 312 / 320 }} scale={12 / parts.heights[5]} />
  </pixiContainer>;
}

/** A separate little tuft bends at its roots; rocks and terrain never sway. */
export function AnimatedTuft(props: LandmarkProps) {
  const source = useDirectTexture("/art/world-v3/animations/tavern-life.webp");
  const texture = source ? atlasFrames(source, 4, 2)[7] : null;
  const sprite = useRef<Sprite>(null);
  const time = useRef(props.worldX % 13);
  useSceneTick(ticker => {
    const node = sprite.current;
    if (!node) return;
    node.visible = inView(props, 80);
    if (!node.visible) return;
    if (!scene.reducedMotion) time.current += ticker.elapsedMS / 1000;
    node.skew.x = Math.sin(time.current * 1.6) * 0.045;
  });
  return texture ? <pixiSprite ref={sprite} texture={texture} x={props.worldX * props.factor} y={610} anchor={{ x: 0.5, y: 312 / 320 }} scale={33 / parts.heights[7]} tint={0xb4c29e} /> : null;
}

/** Source coordinates of the 1400 × 584 clean plate, including mirrored copies. */
export function WindmillLife(props: LandmarkProps) {
  const rotor = useDirectTexture("/art/world-v3/runtime/windmill-rotor.webp");
  const flag = useDirectTexture("/art/world-v3/runtime/windmill-flag.webp");
  const wheel = useRef<Sprite>(null);
  const cloth = useRef<Sprite>(null);
  const time = useRef(Math.abs(props.worldX * 0.013) % 11);
  useSceneTick(ticker => {
    if (!inView(props)) return;
    if (!scene.reducedMotion) time.current += ticker.elapsedMS / 1000;
    if (wheel.current) wheel.current.rotation = time.current * 0.13;
    if (cloth.current) {
      cloth.current.skew.y = Math.sin(time.current * 2.1) * 0.11;
      cloth.current.scale.x = 1 + Math.sin(time.current * 2.1 + 0.7) * 0.09;
    }
  });
  return <pixiContainer>
    {rotor ? <pixiSprite ref={wheel} texture={rotor} x={257} y={137} anchor={0.5} width={166} height={166} /> : null}
    {flag ? <pixiSprite ref={cloth} texture={flag} x={247} y={23} /> : null}
  </pixiContainer>;
}
