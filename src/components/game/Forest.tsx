"use client";

import { memo, useMemo, useRef, type RefObject } from "react";
import type { Container, MeshPlane, Sprite } from "pixi.js";
import { decorForLap, interiorAt, isCarvedTree } from "@/lib/game/decor";
import { BIOMES, WALKABLE_GROUND_Y, WORLD_LENGTH } from "@/lib/game/world";
import { canopyOffset, canopyWeight, windAt } from "@/lib/game/atmosphere";
import { useLayerBiomes } from "./FlatWorld";
import { markMotion, scene } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { atlasFrames, useDirectTexture } from "./textures";
import { useSignTexture } from "./decor-textures";
import { isDrawn, moveEnvironmentTarget, reactionProgress, showEnvironmentTarget, updateSpriteTarget, useEnvironmentTarget, type EnvironmentTarget } from "./environment-targets";

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
      const breeze = scene.atmosphereEnabled && !scene.reducedMotion && !scene.lowPower ? canopyOffset(620 / 768, 450 / 1152, scene.atmosphereTime, target.current.homeX) : { x: 0, y: 0 };
      squirrel.current.position.set(height * 0.205 + leap * 24 + breeze.x * height / 1152, -height * 0.59 - leap * 34 + breeze.y * height / 1152);
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

/** The 7 × 13 bending grid of the oak mesh, with each vertex's share of the breeze. */
const CANOPY = (() => {
  const u: number[] = [], v: number[] = [], weights: number[] = [], arc: number[] = [];
  for (let row = 0; row < 13; row++) for (let col = 0; col < 7; col++) {
    u.push(col / 6); v.push(row / 12); weights.push(canopyWeight(col / 6, row / 12)); arc.push(Math.sin(col / 6 * Math.PI));
  }
  return { u, v, weights, arc };
})();

export function ForestTree({ x = 0, worldX, height = 620, text }: { x?: number; worldX: number; height?: number; text?: string }) {
  const texture = useDirectTexture("/art/world-v3/runtime/forest-oak.webp");
  const inscription = useSignTexture(text ?? null, "refusal", "tree", 190, 96, "#302318");
  const root = useRef<Container>(null), crown = useRef<MeshPlane>(null);
  const resting = useRef(false);
  const targetId = `tree:${worldX}`;
  const target = useEnvironmentTarget(targetId, "tree", worldX);
  useSceneTick(() => {
    if (!root.current) return;
    root.current.visible = worldX > scene.camera.x - 400 && worldX < scene.camera.x + scene.camera.viewW + 400;
    const hit = target.current, drawn = isDrawn(root.current);
    showEnvironmentTarget(targetId, Boolean(texture && drawn));
    moveEnvironmentTarget(targetId, worldX + height * .11, WALKABLE_GROUND_Y + 30 - height * 0.16, 90, height * 0.25);
    // Hidden behind a room's walls too: no mesh to bend nor buffer to upload.
    if (!drawn || !crown.current) return;
    const animated = scene.atmosphereEnabled && !scene.reducedMotion;
    if (!animated && resting.current) return;
    resting.current = !animated;
    // A small mesh flexes outer branches while the entire painted trunk stays fixed.
    const p = reactionProgress(hit), wake = p < 1 && !scene.reducedMotion ? Math.sin(p * 32) * (1 - p) : 0;
    const mesh = crown.current, positions = mesh.geometry.positions;
    const width = mesh.texture.width, fullHeight = mesh.texture.height;
    // Same motion as `canopyOffset`, with the breeze read once per tree and nothing allocated.
    const time = scene.atmosphereTime, wind = animated ? windAt(time, worldX) : 0;
    for (let k = 0; k < CANOPY.weights.length; k++) {
      const u = CANOPY.u[k], w = animated ? CANOPY.weights[k] : 0, i = k * 2;
      positions[i] = u * width + (w && w * (wind * 12 + Math.sin(time * 1.3 + u * 5) * 2 + wake * 24));
      positions[i + 1] = CANOPY.v[k] * fullHeight + (w && w * (wind * CANOPY.arc[k] * 2 + wake * 4));
    }
    mesh.geometry.getBuffer("aPosition").update();
    if (p < 1) markMotion();
  });
  return <pixiContainer ref={root} x={x} y={20} label="forest-oak">
    {texture ? scene.lowPower
      ? <pixiSprite texture={texture} anchor={{ x: 0.5, y: 1130 / 1152 }} height={height} width={height * 2 / 3} tint={text ? 0xe3dfc5 : 0xc1c6a5} />
      : <pixiMeshPlane ref={crown} texture={texture} verticesX={7} verticesY={13} pivot={{ x: texture.width / 2, y: texture.height * 1130 / 1152 }} scale={{ x: height * 2 / 3 / texture.width, y: height / texture.height }} tint={text ? 0xe3dfc5 : 0xc1c6a5} /> : null}
    {text && inscription ? <pixiSprite texture={inscription} x={height * 0.11} y={-height * 0.31} anchor={0.5} width={94} height={48} rotation={-0.035} /> : null}
    <TreeResidents height={height} target={target} />
  </pixiContainer>;
}

/** Rooted trunks overlap the rear edge of the floor and remain behind the heroes. */
function ForestLayer() {
  const indices = useLayerBiomes(1, 900);
  const trees = useMemo(() => {
    const forest = BIOMES.find(b => b.id === "foret")!;
    return indices.filter(({ index }) => BIOMES[index].id === "foret").flatMap(({ offset }) => {
      const result: Array<{ x: number; height: number }> = [];
      // A carved oak of the decor already stands there: no twin trunk drawn behind it.
      const carved = decorForLap(offset / WORLD_LENGTH).filter(isCarvedTree);
      let order = 0;
      for (let x = forest.from * WORLD_LENGTH + 120; x < forest.to * WORLD_LENGTH - 280; x += 390) {
        if (interiorAt(x - 200) || interiorAt(x + 200) || interiorAt(x)) continue;
        const height = 540 + (order++ % 3) * 65;
        if (carved.some(site => Math.abs(site.x - (x + offset)) < 120)) continue;
        result.push({ x: x + offset, height });
      }
      return result;
    });
  }, [indices]);
  return <pixiContainer y={WALKABLE_GROUND_Y + 10}>{trees.map(({ x, height }) => <ForestTree key={x} x={x} worldX={x} height={height} />)}</pixiContainer>;
}
export const Forest = memo(ForestLayer);
