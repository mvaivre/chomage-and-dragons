"use client";

import { useRef } from "react";
import type { Sprite } from "pixi.js";
import { seedFrom } from "@/lib/game/random";
import { scene } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";
import hype from "../../../public/art/world-v3/decor/npc-hype.json";
import recruiters from "../../../public/art/world-v3/decor/npc-recruiters.json";
import afterlife from "../../../public/art/world-v3/decor/npc-afterlife.json";
import orp from "../../../public/art/world-v3/decor/npc-orp.json";
import factory from "../../../public/art/world-v3/decor/npc-factory.json";

const sheets = { hype, recruiters, afterlife, orp, factory };

/** Long idle holds; only the four poses in this resident's row can ever be selected. */
export function DecorNpc({ sheet, row = 0, x, y = 0, height = 144, worldX = x, ghost = false }: {
  sheet: keyof typeof sheets; row?: number; x: number; y?: number; height?: number; worldX?: number; ghost?: boolean;
}) {
  const meta = sheets[sheet], base = useDirectTexture(`/art/world-v3/decor/npc-${sheet}.webp`);
  const frames = base ? atlasFrames(base, 4, 2) : null;
  const ref = useRef<Sprite>(null);
  const time = useRef(seedFrom(`${sheet}:${row}:${worldX}`) % 1700 / 100);
  const reacted = useRef(false), response = useRef(0);
  useSceneTick(ticker => {
    const node = ref.current;
    if (!node || !frames) return;
    node.visible = worldX > scene.camera.x - 260 && worldX < scene.camera.x + scene.camera.viewW + 260;
    if (!node.visible) return;
    const near = performance.now() < scene.walkingUntil && Math.abs(scene.focus - worldX) < 240;
    if (near && !reacted.current) response.current = 2.4;
    reacted.current = near;
    if (scene.reducedMotion) { node.texture = frames[row * 4]; node.y = y; node.alpha = ghost ? 0.6 : 1; return; }
    time.current += ticker.elapsedMS / 1000;
    response.current = Math.max(0, response.current - ticker.elapsedMS / 1000);
    const cycle = time.current % 22;
    const pose = response.current > 0 ? 1 + Math.floor((2.4 - response.current) * 2) % 3 : cycle < 19 ? 0 : 1 + Math.floor(cycle - 19);
    node.texture = frames[row * 4 + pose];
    node.y = y + (ghost ? Math.sin(time.current * 0.7) * 4 : 0);
    node.alpha = ghost ? 0.58 + Math.sin(time.current * 0.45) * 0.09 : 1;
  });
  return frames ? <pixiSprite ref={ref} label={`npc:${sheet}:${row}`} texture={frames[row * 4]} x={x} y={y} anchor={{x:0.5,y:meta.baseline / meta.height}} scale={height / Math.max(...meta.heights.slice(row * 4, row * 4 + 4))} /> : null;
}
