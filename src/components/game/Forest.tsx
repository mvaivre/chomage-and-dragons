"use client";

import { useRef } from "react";
import type { Container, Sprite } from "pixi.js";
import { interiorAt } from "@/lib/game/decor";
import { BIOMES, WALKABLE_GROUND_Y, WORLD_LENGTH } from "@/lib/game/world";
import { useLayerBiomes } from "./FlatWorld";
import { scene } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { useDirectTexture } from "./textures";
import { useSignTexture } from "./decor-textures";

export function ForestTree({ x = 0, worldX, height = 620, text }: { x?: number; worldX: number; height?: number; text?: string }) {
  const texture = useDirectTexture("/art/world-v3/runtime/forest-oak.webp");
  const inscription = useSignTexture(text ?? "", "refusal", true, 170, 110, "#e5cba0");
  const root = useRef<Container>(null), crown = useRef<Sprite>(null);
  const time = useRef(worldX % 13);
  useSceneTick(ticker => {
    if (!root.current) return;
    root.current.visible = worldX > scene.camera.x - 400 && worldX < scene.camera.x + scene.camera.viewW + 400;
    if (!root.current.visible || !crown.current) return;
    if (!scene.reducedMotion) time.current += ticker.elapsedMS / 1000;
    // Roots remain registered: a tiny crown shear reads as wind, without floating the tree.
    crown.current.skew.x = scene.reducedMotion ? 0 : Math.sin(time.current * 0.7) * 0.004;
  });
  return <pixiContainer ref={root} x={x} label="forest-oak">
    {texture ? <pixiSprite ref={crown} texture={texture} anchor={{ x: 0.5, y: 1130 / 1152 }} height={height} width={height * 2 / 3} tint={text ? 0xe3dfc5 : 0xc1c6a5} /> : null}
    {text && inscription ? <pixiSprite texture={inscription} x={height * 0.11} y={-height * 0.31} anchor={0.5} width={76} height={46} rotation={-0.035} /> : null}
  </pixiContainer>;
}

/** A sparse row of substantial trunks behind the walkable ground and heroes. */
export function Forest() {
  const indices = useLayerBiomes(1, 900);
  const forest = BIOMES.find(b => b.id === "foret")!;
  const trees = indices.filter(({ index }) => BIOMES[index].id === "foret").flatMap(({ offset }) => {
    const result = [];
    for (let x = forest.from * WORLD_LENGTH + 120; x < forest.to * WORLD_LENGTH - 280; x += 390) {
      if (interiorAt(x - 200) || interiorAt(x + 200) || interiorAt(x)) continue;
      result.push(x + offset);
    }
    return result;
  });
  return <pixiContainer y={WALKABLE_GROUND_Y + 6}>{trees.map((x, i) => <ForestTree key={x} x={x} worldX={x} height={540 + (i % 3) * 65} />)}</pixiContainer>;
}
