"use client";

import { useRef, type RefObject } from "react";
import type { Container, Sprite } from "pixi.js";
import { interiorAt } from "@/lib/game/decor";
import { BIOMES, WALKABLE_GROUND_Y, WORLD_LENGTH } from "@/lib/game/world";
import { useLayerBiomes } from "./FlatWorld";
import { markMotion, scene } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";
import { useSignTexture } from "./decor-textures";
import { isDrawn, reactionProgress, updateEnvironmentTarget, updateSpriteTarget, useEnvironmentTarget, type EnvironmentTarget } from "./environment-targets";

function TreeResidents({ height, target }: { height: number; target: RefObject<EnvironmentTarget> }) {
  const source = useDirectTexture("/art/world-v3/animations/woodland-life.webp");
  const frames = source ? atlasFrames(source, 4, 2) : null;
  const squirrel = useRef<Sprite>(null), spirit = useRef<Sprite>(null), companion = useRef<Sprite>(null);
  const time = useRef(height % 9);
  const squirrelId = `${target.current.id}:squirrel`, spiritId = `${target.current.id}:spirit`, companionId = `${target.current.id}:companion`;
  const squirrelTarget = useEnvironmentTarget(squirrelId, "squirrel", target.current.homeX);
  const spiritTarget = useEnvironmentTarget(spiritId, "spirit", target.current.homeX);
  const companionTarget = useEnvironmentTarget(companionId, "spirit", target.current.homeX);
  useSceneTick(ticker => {
    if (!frames || !target.current.visible) {
      updateSpriteTarget(squirrelId, null, 38); updateSpriteTarget(spiritId, null, 48); updateSpriteTarget(companionId, null, 36); return;
    }
    if (!scene.reducedMotion) time.current += Math.min(100, ticker.elapsedMS) / 1000;
    const t = time.current, p = Math.min(reactionProgress(target.current), reactionProgress(squirrelTarget.current), reactionProgress(spiritTarget.current), reactionProgress(companionTarget.current)), active = p < 1 && !scene.reducedMotion;
    if (squirrel.current) {
      // Register the feet to the oak's painted branch near source pixel (620, 450).
      const leap = active ? Math.sin(p * Math.PI) : 0;
      squirrel.current.position.set(height * 0.205 + leap * 24, -height * 0.59 - leap * 34);
      squirrel.current.texture = frames[active ? p < 0.2 ? 2 : p < 0.8 ? 3 : 0 : Math.floor(t / 2) % 2];
      squirrel.current.rotation = active ? Math.sin(p * Math.PI * 2) * 0.18 : 0;
    }
    if (spirit.current) {
      spirit.current.position.set(-height * 0.12 + Math.sin(t * (active ? 4 : 0.8)) * (active ? 66 : 9), -height * 0.19 - (active ? Math.sin(p * Math.PI) * 64 : Math.sin(t) * 7));
      spirit.current.texture = frames[4 + (active ? 1 + Math.floor(p * 7) % 3 : 0)];
      spirit.current.alpha = active ? 1 : 0.72;
      spirit.current.rotation = active ? Math.sin(t * 3) * 0.3 : 0;
    }
    if (companion.current) {
      companion.current.position.set(height * 0.04 + Math.cos(t * 4) * 85, -height * 0.25 - Math.sin(p * Math.PI) * 75);
      companion.current.alpha = active ? Math.sin(p * Math.PI) * 0.9 : 0;
      companion.current.texture = frames[6];
    }
    updateSpriteTarget(squirrelId, squirrel.current, 38, 44);
    updateSpriteTarget(spiritId, spirit.current, 48);
    updateSpriteTarget(companionId, companion.current, 36);
  });
  return <pixiContainer>
    {frames ? <>
      <pixiSprite ref={squirrel} texture={frames[0]} x={height * 0.205} y={-height * 0.59} anchor={{ x: 0.5, y: 476 / 512 }} scale={38 / 400} />
      <pixiSprite ref={spirit} texture={frames[4]} x={-height * 0.12} y={-height * 0.19} anchor={{ x: 0.5, y: 476 / 512 }} scale={48 / 400} alpha={0.72} />
      <pixiSprite ref={companion} texture={frames[6]} anchor={{ x: 0.5, y: 476 / 512 }} scale={36 / 400} alpha={0} />
    </> : null}
  </pixiContainer>;
}

export function ForestTree({ x = 0, worldX, height = 620, text }: { x?: number; worldX: number; height?: number; text?: string }) {
  const texture = useDirectTexture("/art/world-v3/runtime/forest-oak.webp");
  const inscription = useSignTexture(text ?? "", "refusal", "tree", 190, 96, "#302318");
  const root = useRef<Container>(null), crown = useRef<Sprite>(null);
  const time = useRef(worldX % 13);
  const target = useEnvironmentTarget(`tree:${worldX}`, "tree", worldX);
  useSceneTick(ticker => {
    if (!root.current) return;
    root.current.visible = worldX > scene.camera.x - 400 && worldX < scene.camera.x + scene.camera.viewW + 400;
    const hit = target.current;
    updateEnvironmentTarget(`tree:${worldX}`, { visible: Boolean(texture && isDrawn(root.current)), worldX: worldX + height * .11, worldY: WALKABLE_GROUND_Y + 30 - height * 0.16, width: 90, height: height * 0.25 });
    if (!root.current.visible || !crown.current) return;
    if (!scene.reducedMotion) time.current += ticker.elapsedMS / 1000;
    // Roots remain registered: a tiny crown shear reads as wind, without floating the tree.
    const p = reactionProgress(hit), wake = p < 1 && !scene.reducedMotion ? Math.sin(p * 32) * (1 - p) * 0.025 : 0;
    crown.current.skew.x = scene.reducedMotion ? 0 : Math.sin(time.current * 0.7) * 0.004 + wake;
    if (p < 1) markMotion();
  });
  return <pixiContainer ref={root} x={x} y={20} label="forest-oak">
    {texture ? <pixiSprite ref={crown} texture={texture} anchor={{ x: 0.5, y: 1130 / 1152 }} height={height} width={height * 2 / 3} tint={text ? 0xe3dfc5 : 0xc1c6a5} /> : null}
    {text && inscription ? <pixiSprite texture={inscription} x={height * 0.11} y={-height * 0.31} anchor={0.5} width={94} height={48} rotation={-0.035} /> : null}
    <TreeResidents height={height} target={target} />
  </pixiContainer>;
}

/** Rooted trunks overlap the rear edge of the floor and remain behind the heroes. */
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
  return <pixiContainer y={WALKABLE_GROUND_Y + 10}>{trees.map((x, i) => <ForestTree key={x} x={x} worldX={x} height={540 + (i % 3) * 65} />)}</pixiContainer>;
}
