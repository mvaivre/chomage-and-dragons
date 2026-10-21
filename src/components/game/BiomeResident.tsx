"use client";

import { useRef } from "react";
import type { Graphics, Sprite } from "pixi.js";
import { biomeResidentFrame, type BiomeResidentProfile } from "@/lib/game/biome-residents";
import type { EnvironmentSite } from "@/lib/game/environment";
import { WALKABLE_GROUND_Y } from "@/lib/game/world";
import { atlasFrames, useDirectTexture } from "./textures";
import { useSceneTick } from "./useSceneTick";
import { parallaxX } from "./projection";
import { scene, markMotion } from "./scene";
import { reactionProgress, updateSpriteTarget, useEnvironmentTarget } from "./environment-targets";

const paintShadow = (g: Graphics) => { g.clear().ellipse(0, 0, 28, 3).fill({ color: 0x211b18, alpha: .2 }); };

export function BiomeResident({ site, profile }: { site: EnvironmentSite; profile: BiomeResidentProfile }) {
  const source = useDirectTexture(profile.art);
  const frames = source ? atlasFrames(source, 2, 2) : null;
  const sprite = useRef<Sprite>(null), shadow = useRef<Graphics>(null);
  const time = useRef(site.x % 10);
  const target = useEnvironmentTarget(site.id, site.kind, site.x, site.factor);
  const depthScale = site.factor < 1 ? .7 : 1;
  const height = profile.height * depthScale, width = profile.width * depthScale;
  const scale = height / profile.referenceHeight;
  const ground = WALKABLE_GROUND_Y + 10;
  useSceneTick(ticker => {
    const node = sprite.current;
    if (!node || !frames) { updateSpriteTarget(site.id, null, height); return; }
    const x = parallaxX(site.x, scene.camera.x, scene.camera.viewW, site.factor);
    node.visible = x > -180 && x < scene.camera.viewW + 180;
    if (shadow.current) shadow.current.visible = node.visible;
    if (node.visible) {
      if (!scene.reducedMotion) time.current += Math.min(100, ticker.elapsedMS) / 1000;
      const reacting = reactionProgress(target.current) < 1;
      node.texture = frames[biomeResidentFrame(time.current, reacting, scene.reducedMotion)];
      node.scale.set(scale, scale * (scene.reducedMotion ? 1 : 1 + Math.sin(time.current * 1.7) * .006));
      if (reacting) markMotion();
    }
    updateSpriteTarget(site.id, node, height, width, site.factor);
  });
  return <pixiContainer label={`biome-resident:${site.kind}:${site.x}`}>
    <pixiGraphics ref={shadow} x={site.x * site.factor} y={ground + 1} draw={paintShadow} scale={width / 100} />
    {frames ? <pixiSprite ref={sprite} label={`biome-body:${site.kind}`} texture={frames[0]} x={site.x * site.factor} y={ground}
      anchor={{ x: .5, y: 356 / 384 }} scale={scale} /> : null}
  </pixiContainer>;
}
