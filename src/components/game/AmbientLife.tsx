"use client";

import { memo, useRef } from "react";
import { useSceneTick as useTick } from "./useSceneTick";
import type { Graphics, Sprite } from "pixi.js";
import { BIOMES, WALKABLE_GROUND_Y, WORLD_LENGTH } from "@/lib/game/world";
import { atlasFrames, useDirectTexture } from "./textures";
import { parallaxX } from "./projection";
import { scene } from "./scene";
import { useLayerBiomes } from "./FlatWorld";
import { gnomeFrame } from "./ambient-animation";
import { AnimatedTuft } from "./LandmarkLife";

const RESIDENT_FRAMES = [[0, 0, 1, 0, 2, 3], [0, 1, 2, 3], [0, 0, 1, 2, 0, 3], [0, 1, 2, 3]];

/** A few inhabitants, drawn behind the path and animated only while visible. */
const drawGnomeShadow = (g: Graphics) => { g.clear().ellipse(0, 0, 17, 3).fill({ color: 0x211b18, alpha: 0.24 }); };
const drawGlint = (g: Graphics) => {
  g.clear().ellipse(0, 0, 2, 11).fill(0xe9ffff).ellipse(3, -8, 1.5, 3).fill({ color: 0xe9ffff, alpha: 0.5 });
};

function Resident({ kind, worldX, factor, variant = 0 }: { kind: number; worldX: number; factor: number; variant?: number }) {
  const source = useDirectTexture(kind === 2 ? "/art/world-v3/animations/gnomes.webp" : "/art/world-v3/animations/ambient.webp");
  const frames = source ? atlasFrames(source, 4, kind === 2 ? 2 : 4) : null;
  const sprite = useRef<Sprite>(null);
  const time = useRef(worldX % 17);
  useTick(ticker => {
    const node = sprite.current;
    if (!node || !frames) return;
    const x = parallaxX(worldX, scene.camera.x, scene.camera.viewW, factor);
    node.visible = x > -260 && x < scene.camera.viewW + 260;
    if (!node.visible) return;
    if (!scene.reducedMotion) time.current += Math.min(ticker.deltaMS, 60) / 1000;
    const t = time.current;
    const sequence = RESIDENT_FRAMES[kind];
    // Gnomes raise their mug, or hop with their broom, as your hero walks past.
    const cheering = kind === 2 && !scene.reducedMotion && performance.now() < scene.walkingUntil && Math.abs(x - (scene.focus - scene.camera.x)) < 240;
    node.texture = frames[kind === 2 ? (cheering ? (variant === 1 ? 4 : 2 + (Math.floor(t * 3.3) % 2)) : gnomeFrame(variant, t)) : kind * 4 + sequence[Math.floor(t * (kind === 1 ? 7 : 2)) % sequence.length]];
    node.x = worldX * factor + (kind === 1 ? Math.sin(t * 0.22) * 180 : kind === 0 ? Math.sin(t * 0.3) * 18 : 0);
    node.y = WALKABLE_GROUND_Y + (kind === 1 ? -210 + Math.sin(t * 0.8) * 12 : kind === 2 ? 10 - (cheering ? Math.abs(Math.sin(t * 9)) * 9 : 0) : -4);
    if (kind === 1) node.scale.x = Math.abs(node.scale.x) * (Math.cos(t * 0.22) < 0 ? -1 : 1);
  });
  if (!frames) return null;
  const scale = [0.18, 0.24, 0.26, 0.15][kind];
  return <pixiContainer>
    {kind === 2 ? <pixiGraphics x={worldX * factor} y={WALKABLE_GROUND_Y + 11} draw={drawGnomeShadow} /> : null}
    <pixiSprite ref={sprite} texture={frames[kind === 2 ? variant * 4 : kind * 4]} anchor={{ x: 0.5, y: 312 / 320 }} scale={scale} />
  </pixiContainer>;
}

/** Small highlights follow the two streams painted into cascade-mid (940 × 467). */
function WaterGlints({ worldX, factor }: { worldX: number; factor: number }) {
  const nodes = useRef<Array<Graphics | null>>([]);
  const time = useRef(0);
  useTick(ticker => {
    const x = parallaxX(worldX, scene.camera.x, scene.camera.viewW, factor);
    if (x < -600 || x > scene.camera.viewW + 600) return;
    if (!scene.reducedMotion) time.current += ticker.elapsedMS / 1000;
    nodes.current.forEach((node, index) => {
      if (!node) return;
      const t = (time.current * 0.65 + (index % 4) / 4) % 1;
      const left = index < 4;
      const sx = left ? 220 + 65 * t : 704 - 61 * t;
      const sy = left ? 140 + 224 * t : 100 + 269 * t;
      node.position.set((sx - 470) * 820 / 940, (sy - 467) * 820 / 940);
      node.alpha = scene.reducedMotion ? 0 : Math.sin(t * Math.PI) * 0.45;
      node.scale.y = 0.6 + t * 0.7;
    });
  });
  return <pixiContainer x={worldX * factor} y={WALKABLE_GROUND_Y + 100}>
    {Array.from({ length: 8 }, (_, index) => <pixiGraphics key={index} ref={node => { nodes.current[index] = node; }} alpha={0} draw={drawGlint} />)}
  </pixiContainer>;
}

/** What lives in the scenery behind the road: crows in the sky, the cascade's glints. */
function AmbientLifeLayer({ factor }: { factor: number }) {
  const indices = useLayerBiomes(factor, 1200);
  return <pixiContainer>{indices.flatMap(({ index, offset }) => {
    const biome = BIOMES[index];
    const start = offset + biome.from * WORLD_LENGTH;
    const span = (biome.to - biome.from) * WORLD_LENGTH;
    return [
      biome.id === "cascade" ? <WaterGlints key={`cascade-water-${offset}`} worldX={start + span * 0.5} factor={factor} /> : null,
      <Resident key={`${offset}-${index}-crow`} kind={1} variant={index % 2} worldX={start + span * 0.5} factor={factor} />,
    ];
  })}</pixiContainer>;
}

/**
 * Whoever stands on the back edge of the road — gnomes, hens, toads, tufts —
 * moves with the road itself, after the grass fringe but before the player.
 * On a slower plane they would slide under their own feet.
 */
function GroundDwellersLayer() {
  const indices = useLayerBiomes(1, 1200);
  return <pixiContainer>{indices.map(({ index, offset }) => {
    const biome = BIOMES[index];
    const at = (ratio: number) => offset + (biome.from + (biome.to - biome.from) * ratio) * WORLD_LENGTH;
    const leafy = ["plaine", "foret", "cascade", "lac", "taverne"].includes(biome.id);
    const walker = index === 0 || index === 7 ? 0 : index < 5 ? 3 : null;
    return <pixiContainer key={`${offset}-${index}`}>
      {leafy ? [0.4, 0.84].map(ratio => <AnimatedTuft key={ratio} factor={1} worldX={at(ratio)} />) : null}
      {walker !== null ? <Resident kind={walker} variant={index % 2} worldX={at([0.35, 0, 0, 0.62][walker])} factor={1} /> : null}
      <Resident kind={2} variant={index % 2} worldX={at(0.72)} factor={1} />
    </pixiContainer>;
  })}</pixiContainer>;
}

/** Static scenery: re-rendered only when its own props change. */
export const AmbientLife = memo(AmbientLifeLayer);

/** Static scenery: re-rendered only when its own props change. */
export const GroundDwellers = memo(GroundDwellersLayer);
