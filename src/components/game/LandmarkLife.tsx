"use client";

import { useMemo, useRef } from "react";
import type { Container, Graphics, Sprite } from "pixi.js";
import { useSceneTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";
import { parallaxX } from "./projection";
import { scene } from "./scene";
import { crownedChickenFrame } from "./ambient-animation";
import { windAt } from "@/lib/game/atmosphere";
import { atmosphereTextures } from "./atmosphere-textures";
import parts from "../../../public/art/world-v3/animations/tavern-life.json";

export interface LandmarkProps { worldX: number; factor: number; }

function inView({ worldX, factor }: LandmarkProps, margin = 800): boolean {
  const x = parallaxX(worldX, scene.camera.x, scene.camera.viewW, factor);
  return x > -margin && x < scene.camera.viewW + margin;
}

/** All poses and attachments use the clean plate's 960 × 549 coordinate system. */
/** Lamp halos, drawn once per lamp height. */
const HALO_DRAWS = [64, 103].map(height => (g: Graphics) => {
  g.clear();
  for (let ring = 3; ring > 0; ring--) g.ellipse(0, height * 0.7, height * (0.2 + ring * 0.13), height * (0.28 + ring * 0.12)).fill({ color: 0xffb62f, alpha: 0.035 });
});

export function TavernLife(props: LandmarkProps) {
  const source = useDirectTexture("/art/world-v3/animations/tavern-life.webp");
  const frames = source ? atlasFrames(source, 4, 2) : null;
  const chicken = useRef<Sprite>(null);
  const lamps = useRef<Array<Container | null>>([]);
  const halos = useRef<Array<Graphics | null>>([]);
  const flame = useRef<Sprite>(null);
  const smoke = useRef<Array<Sprite | null>>([]);
  useSceneTick(() => {
    if (!frames || !inView(props)) return;
    const baseTime = scene.reducedMotion ? 0 : scene.atmosphereTime;
    const t = baseTime + Math.abs(props.worldX) % 7;
    const wind = windAt(baseTime, props.worldX);
    if (chicken.current) chicken.current.texture = frames[crownedChickenFrame(t)];
    lamps.current.forEach((lamp, i) => { if (lamp) lamp.rotation = wind * .035 + Math.sin(t * 1.4 + i * 2.3) * .008; });
    halos.current.forEach((halo, i) => { if (halo) { halo.alpha = 0.8 + Math.sin(t * 5.3 + i) * Math.sin(t * 8.7) * 0.2; halo.scale.set(1 + scene.night * 0.8); } });
    if (flame.current) {
      flame.current.scale.y = 12 / parts.heights[5] * (1 + Math.sin(t * 8.2) * 0.1);
      flame.current.skew.x = Math.sin(t * 5.4) * 0.09;
    }
    smoke.current.forEach((puff, i) => {
      if (!puff) return;
      puff.visible = !scene.reducedMotion;
      const progress = (t * 0.24 + i * 0.5) % 1;
      puff.position.set(220 + wind * progress * 28 + Math.sin(progress * 3 + i) * 5, 38 - progress * 48);
      puff.scale.set((19 + progress * 22) / parts.heights[6]);
      puff.alpha = Math.sin(progress * Math.PI) * 0.3;
    });
  });
  if (!frames) return null;
  return <pixiContainer>
    {Array.from({ length: 2 }, (_, i) => <pixiSprite key={`smoke-${i}`} ref={node => { smoke.current[i] = node; }} texture={frames[6]} anchor={{ x: 0.5, y: 312 / 320 }} alpha={0} />)}
    <pixiSprite ref={chicken} texture={frames[0]} x={487} y={309} anchor={{ x: 0.5, y: 312 / 320 }} scale={112 / parts.heights[0]} />
    {[{ x: 365, y: 251, height: 64 }, { x: 712, y: 171, height: 103 }].map(({ x, y, height }, i) => <pixiContainer key={i} ref={node => { lamps.current[i] = node; }} x={x} y={y}>
      <pixiGraphics ref={node => { halos.current[i] = node; }} draw={HALO_DRAWS[i]} />
      <pixiSprite texture={frames[4]} anchor={{ x: 0.5, y: (312 - parts.heights[4]) / 320 }} scale={height / parts.heights[4]} />
    </pixiContainer>)}
    {/* The outside table is hidden by the verge; animate the visible doorway candle. */}
    <pixiSprite ref={flame} texture={frames[5]} x={271} y={337} anchor={{ x: 0.5, y: 312 / 320 }} scale={12 / parts.heights[5]} />
  </pixiContainer>;
}

/** Emission sits on the existing painted windows in the 1400 × 786 back plate. */
const TAVERN_WINDOWS = [
  { x: 279, y: 371, width: 55, height: 76 },
  { x: 269, y: 467, width: 67, height: 83 },
  { x: 1138, y: 345, width: 64, height: 86 },
  { x: 1240, y: 386, width: 64, height: 80 },
  { x: 1178, y: 483, width: 75, height: 100 },
  { x: 1222, y: 461, width: 55, height: 75 },
];

export function TavernWindows(props: LandmarkProps) {
  const root = useRef<Container>(null);
  const glow = useMemo(() => atmosphereTextures().glow, []);
  useSceneTick(() => {
    const node = root.current;
    if (!node) return;
    node.visible = scene.atmosphereEnabled && !scene.lowPower && inView(props);
    if (!node.visible) return;
    const t = scene.reducedMotion ? 0 : scene.atmosphereTime;
    const light = scene.night * .85 + scene.warm * .14;
    node.children.forEach((child, i) => {
      child.alpha = light * (.92 + Math.sin(t * 2.7 + props.worldX * .01 + i * 1.8) * .08);
    });
  });
  return <pixiContainer ref={root} eventMode="none" label="tavern-window-light">
    {TAVERN_WINDOWS.map(({ x, y, width, height }, i) => <pixiSprite key={i} texture={glow} x={x} y={y} width={width} height={height} anchor={.5} tint={0xffb65d} blendMode="add" alpha={0} />)}
  </pixiContainer>;
}

/** A separate little tuft bends at its roots; rocks and terrain never sway. */
export function AnimatedTuft(props: LandmarkProps) {
  const source = useDirectTexture("/art/world-v3/animations/tavern-life.webp");
  const texture = source ? atlasFrames(source, 4, 2)[7] : null;
  const sprite = useRef<Sprite>(null);
  useSceneTick(() => {
    const node = sprite.current;
    if (!node) return;
    node.visible = inView(props, 80);
    if (!node.visible) return;
    const t = scene.reducedMotion ? 0 : scene.atmosphereTime;
    node.skew.x = windAt(t, props.worldX) * .07;
  });
  return texture ? <pixiSprite ref={sprite} texture={texture} x={props.worldX * props.factor} y={610} anchor={{ x: 0.5, y: 312 / 320 }} scale={33 / parts.heights[7]} tint={0xb4c29e} /> : null;
}

/** Source coordinates of the 1400 × 584 clean plate, including mirrored copies. */
export function WindmillLife(props: LandmarkProps) {
  const rotor = useDirectTexture("/art/world-v3/runtime/windmill-rotor.webp");
  const flag = useDirectTexture("/art/world-v3/runtime/windmill-flag.webp");
  const wheel = useRef<Sprite>(null);
  const cloth = useRef<Sprite>(null);
  useSceneTick(() => {
    if (!inView(props)) return;
    const baseTime = scene.reducedMotion ? 0 : scene.atmosphereTime;
    const t = baseTime + Math.abs(props.worldX * .013) % 11;
    const wind = windAt(baseTime, props.worldX);
    if (wheel.current) wheel.current.rotation = t * .13 + Math.sin(t * .3) * .08;
    if (cloth.current) {
      cloth.current.skew.y = wind * .13 + Math.sin(t * 2.1) * .025;
      cloth.current.scale.x = 1 + wind * .08;
    }
  });
  return <pixiContainer>
    {rotor ? <pixiSprite ref={wheel} texture={rotor} x={257} y={137} anchor={0.5} width={166} height={166} /> : null}
    {flag ? <pixiSprite ref={cloth} texture={flag} x={247} y={23} /> : null}
  </pixiContainer>;
}
