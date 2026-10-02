"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import type { Container, Sprite } from "pixi.js";
import { mixColor, WALKABLE_GROUND_Y } from "@/lib/game/world";
import { interiorAt } from "@/lib/game/decor";
import { atmosphereAt, atmosphereBudget, atmosphereSample, windAt } from "@/lib/game/atmosphere";
import { scene } from "./scene";
import { parallaxX } from "./projection";
import { useSceneTick } from "./useSceneTick";
import { atmosphereTextures } from "./atmosphere-textures";

/** Shared environmental time is independent of actions and never requests active FPS. */
export function AtmosphereClock({ enabled }: { enabled: boolean }) {
  useEffect(() => { scene.atmosphereEnabled = enabled; }, [enabled]);
  useSceneTick({ priority: 40, callback: ticker => {
    if (!scene.reducedMotion) scene.atmosphereTime += Math.min(ticker.elapsedMS, 100) / 1000;
  }});
  return null;
}

type Depth = "far" | "air" | "ground";
function AtmosphereLayer({ depth }: { depth: Depth }) {
  const root = useRef<Container>(null);
  const masks = useMemo(() => atmosphereTextures(), []);
  const maxFog = depth === "far" ? 5 : depth === "air" ? 3 : 0;
  const maxDetail = depth === "far" ? 0 : 5;
  useSceneTick(() => {
    const node = root.current;
    if (!node) return;
    node.visible = scene.atmosphereEnabled;
    if (!node.visible) return;
    const { camera } = scene;
    const budget = atmosphereBudget(camera.viewW * camera.scale, scene.lowPower);
    const factor = depth === "far" ? .24 : depth === "air" ? .56 : 1;
    const time = scene.reducedMotion ? 0 : scene.atmosphereTime;
    const center = camera.x + camera.viewW / 2;
    const interval = depth === "far" ? 850 : depth === "air" ? 440 : 310;
    node.y = -camera.y * factor;
    node.children.forEach((child, i) => {
      const sprite = child as Sprite;
      const fog = i < maxFog;
      const ground = depth === "ground", light = ground && i % 2 === 0;
      const slot = fog ? i : ground ? Math.floor(i / 2) : i - maxFog;
      const count = fog ? depth === "far" ? budget.farFog : budget.nearFog : ground ? budget.patches : budget.rays;
      const { worldX, opacity } = atmosphereSample(center, interval, count, slot);
      const profile = atmosphereAt(worldX);
      let strength = profile.rays;
      if (fog) strength = profile.fog;
      else if (ground) strength = light ? profile.rays * .65 : profile.shade;
      sprite.visible = opacity > .001 && strength > .001 && !interiorAt(worldX);
      if (!sprite.visible) return;
      const wind = windAt(time, worldX), phase = worldX * .009;
      const drift = fog ? Math.sin(time * .075 + phase) * 65 + wind * 12 : wind * 10;
      sprite.x = parallaxX(worldX + drift, camera.x, camera.viewW, factor);
      if (fog) {
        sprite.y = WALKABLE_GROUND_Y - (depth === "far" ? 105 : 65) + Math.sin(time * .12 + phase) * 9;
        sprite.width = depth === "far" ? 780 : 510; sprite.height = depth === "far" ? 260 : 125;
        sprite.tint = mixColor(profile.fogColor, 0x8a9eb9, scene.night * .8);
        sprite.alpha = opacity * strength * (depth === "far" ? .9 : .5) * (.86 + Math.sin(time * .14 + phase) * .14);
      } else if (depth === "air") {
        sprite.y = 310 + Math.sin(phase) * 35;
        sprite.width = 90 + (Math.abs(Math.floor(worldX / interval)) % 3) * 22; sprite.height = 600;
        sprite.rotation = -.28 + wind * .025;
        sprite.tint = mixColor(mixColor(0xffefb6, 0xffce91, scene.warm), 0xb2d8ff, scene.night);
        sprite.alpha = opacity * strength * (1 - scene.night * .88) * (.8 + Math.sin(time * .23 + phase) * .2);
      } else {
        sprite.y = WALKABLE_GROUND_Y + 47 + Math.sin(phase) * 18;
        sprite.width = light ? 390 : 330; sprite.height = light ? 95 : 100;
        sprite.rotation = -.12 + wind * .035;
        sprite.tint = light ? mixColor(0xffefb6, 0xffce91, scene.warm) : 0x25382e;
        sprite.alpha = opacity * strength * (1 - scene.night * .9) * (.85 + wind * .15);
      }
    });
  });
  return <pixiContainer ref={root} label={`atmosphere:${depth}`} eventMode="none">
    {Array.from({ length: maxFog }, (_, i) => <pixiSprite key={`fog-${i}`} texture={masks.fog} anchor={.5} alpha={0} />)}
    {Array.from({ length: maxDetail * (depth === "ground" ? 2 : 1) }, (_, i) => <pixiSprite key={`detail-${i}`} texture={depth === "ground" ? i % 2 === 0 ? masks.glow : masks.shade : masks.ray} anchor={.5} alpha={0} />)}
  </pixiContainer>;
}
export const Atmosphere = memo(AtmosphereLayer);
