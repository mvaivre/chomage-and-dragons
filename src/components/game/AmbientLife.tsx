"use client";

import { useRef } from "react";
import { useSceneTick as useTick } from "./useSceneTick";
import type { Graphics, Sprite } from "pixi.js";
import { BIOMES, WALKABLE_GROUND_Y, WORLD_LENGTH } from "@/lib/game/world";
import { atlasFrames, useDirectTexture } from "./textures";
import { parallaxX } from "./projection";
import { scene } from "./scene";
import { useLayerBiomes } from "./FlatWorld";

const RESIDENT_FRAMES = [[0, 0, 1, 0, 2, 3], [0, 1, 2, 3], [0, 0, 1, 2, 0, 3], [0, 1, 2, 3]];

/** A few inhabitants, drawn behind the path and animated only while visible. */
function Resident({ kind, worldX, factor }: { kind: number; worldX: number; factor: number }) {
  const source = useDirectTexture("/art/world-v3/animations/ambient.webp");
  const frames = source ? atlasFrames(source, 4, 4) : null;
  const sprite = useRef<Sprite>(null);
  const time = useRef(worldX % 17);
  useTick(ticker => {
    const node = sprite.current;
    if (!node || !frames) return;
    const x = parallaxX(worldX, scene.camera.x, scene.camera.viewW, factor);
    node.visible = x > -260 && x < scene.camera.viewW + 260;
    if (!node.visible) return;
    time.current += Math.min(ticker.deltaMS, 60) / 1000;
    const t = time.current;
    const sequence = RESIDENT_FRAMES[kind];
    node.texture = frames[kind * 4 + sequence[Math.floor(t * (kind === 1 ? 7 : 2)) % sequence.length]];
    node.x = worldX * factor + (kind === 1 ? Math.sin(t * 0.22) * 180 : kind === 0 ? Math.sin(t * 0.3) * 18 : 0);
    node.y = WALKABLE_GROUND_Y + (kind === 1 ? -210 + Math.sin(t * 0.8) * 12 : kind === 2 ? -8 : -4);
    if (kind === 1) node.scale.x = Math.abs(node.scale.x) * (Math.cos(t * 0.22) < 0 ? -1 : 1);
  });
  if (!frames) return null;
  const scale = [0.18, 0.24, 0.40, 0.15][kind];
  return <pixiSprite ref={sprite} texture={frames[kind * 4]} anchor={{ x: 0.5, y: 312 / 320 }} scale={scale} />;
}

/** Small highlights follow the two streams painted into cascade-mid (940 × 467). */
function WaterGlints({ worldX, factor }: { worldX: number; factor: number }) {
  const nodes = useRef<Array<Graphics | null>>([]);
  const time = useRef(0);
  useTick(ticker => {
    const x = parallaxX(worldX, scene.camera.x, scene.camera.viewW, factor);
    if (x < -600 || x > scene.camera.viewW + 600) return;
    time.current += Math.min(60, ticker.deltaMS) / 1000;
    nodes.current.forEach((node, index) => {
      if (!node) return;
      const t = (time.current * 0.65 + (index % 3) / 3) % 1;
      const left = index < 3;
      const sx = left ? 220 + 65 * t : 704 - 61 * t;
      const sy = left ? 140 + 224 * t : 100 + 269 * t;
      node.position.set((sx - 470) * 820 / 940, (sy - 467) * 820 / 940);
      node.alpha = Math.sin(t * Math.PI) * 0.38;
      node.scale.y = 0.6 + t * 0.7;
    });
  });
  return <pixiContainer x={worldX * factor} y={WALKABLE_GROUND_Y + 100}>
    {Array.from({ length: 6 }, (_, index) => <pixiGraphics key={index} ref={node => { nodes.current[index] = node; }} alpha={0} draw={g => {
      g.clear().ellipse(0, 0, 2, 8).fill(0xe9ffff);
    }} />)}
  </pixiContainer>;
}

export function AmbientLife({ factor }: { factor: number }) {
  const indices = useLayerBiomes(factor, 1200);
  return <pixiContainer>{indices.flatMap(({ index, offset }) => {
    const biome = BIOMES[index];
    const start = offset + biome.from * WORLD_LENGTH;
    const span = (biome.to - biome.from) * WORLD_LENGTH;
    const kinds = index === 0 || index === 7 ? [0, 1, 2] : index >= 5 ? [1, 2] : [1, 2, 3];
    return [biome.id === "cascade" ? <WaterGlints key={`cascade-water-${offset}`} worldX={start + span * 0.5} factor={factor} /> : null, ...kinds.map(kind => <Resident key={`${offset}-${index}-${kind}`} kind={kind} worldX={start + span * [0.35, 0.5, 0.72, 0.62][kind]} factor={factor} />)];
  })}</pixiContainer>;
}
