"use client";

import { memo, useMemo } from "react";
import { Rectangle, Texture } from "pixi.js";
import { VIEW } from "@/lib/game/world";
import { GROUND_TILE_WIDTH, GROUND_TOP_MARGIN, groundSlices } from "@/lib/game/terrain";
import { useDirectTexture } from "./textures";

const crops = new WeakMap<Texture, Map<string, Texture>>();
function crop(source: Texture, offset: number, width: number, mirrored: boolean) {
  let cache = crops.get(source);
  if (!cache) crops.set(source, cache = new Map());
  const key = `${offset}:${width}:${mirrored}`;
  let texture = cache.get(key);
  if (!texture) {
    if (cache.size > 512) cache.clear();
    const scale = source.width / GROUND_TILE_WIDTH;
    texture = new Texture({ source: source.source, frame: new Rectangle((mirrored ? GROUND_TILE_WIDTH - offset - width : offset) * scale, 0, width * scale, source.height) });
    cache.set(key, texture);
  }
  return texture;
}

/** Primitive props only: a strip re-renders when its texture arrives, never with its tile. */
const MaterialStrip = memo(function MaterialStrip({ id, offset, width, mirrored, x, groundY, alpha = 1 }: { id: string; offset: number; width: number; mirrored: boolean; x: number; groundY: number; alpha?: number }) {
  const source = useDirectTexture(`/art/world-v3/runtime/ground-${id}-v2.webp`);
  if (!source) return null;
  const scale = GROUND_TILE_WIDTH / source.width;
  return <pixiSprite texture={crop(source, offset, width, mirrored)} x={x + (mirrored ? width : 0)} y={groundY - (GROUND_TOP_MARGIN * scale)} scale={{ x: mirrored ? -scale : scale, y: scale }} alpha={alpha} />;
});

/** A biome transition is about forty narrow strips: they are computed and reconciled once per tile. */
const GroundTile = memo(function GroundTile({ index, groundY }: { index: number; groundY: number }) {
  const start = -VIEW.width + index * GROUND_TILE_WIDTH, mirrored = Math.abs(index % 2) === 1;
  const slices = useMemo(() => groundSlices(start), [start]);
  return <pixiContainer>{slices.map(slice => <pixiContainer key={slice.offset}>
    <MaterialStrip id={slice.a} offset={slice.offset} width={slice.width} mirrored={mirrored} x={start + slice.offset} groundY={groundY} />
    {slice.blend > 0 ? <MaterialStrip id={slice.b} offset={slice.offset} width={slice.width} mirrored={mirrored} x={start + slice.offset} groundY={groundY} alpha={slice.blend} /> : null}
  </pixiContainer>)}</pixiContainer>;
});

/** Native material artwork supplies the entire floor, including its contact edge and shading. */
export function TerrainRoad({ indices, groundY }: { indices: number[]; groundY: number }) {
  return <pixiContainer>{indices.map(index => <GroundTile key={index} index={index} groundY={groundY} />)}</pixiContainer>;
}
