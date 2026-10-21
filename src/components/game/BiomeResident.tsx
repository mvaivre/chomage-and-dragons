"use client";

import { useRef } from "react";
import type { Container, Graphics, Sprite } from "pixi.js";
import { advanceResidentBlend, biomeGestureFrame, biomeResidentFrame, BIOME_GESTURES, type BiomeResidentProfile } from "@/lib/game/biome-residents";
import type { EnvironmentSite } from "@/lib/game/environment";
import { WALKABLE_GROUND_Y } from "@/lib/game/world";
import { atlasFrames, useDirectTexture } from "./textures";
import { useSceneTick } from "./useSceneTick";
import { parallaxX } from "./projection";
import { scene, markMotion } from "./scene";
import { reactionProgress, updateSpriteTarget, useEnvironmentTarget } from "./environment-targets";
import { useViewportResident } from "./resident-visibility";

const paintShadow = (g: Graphics) => { g.clear().ellipse(0, 0, 28, 3).fill({ color: 0x211b18, alpha: .2 }); };

export function BiomeResident({ site, profile }: { site: EnvironmentSite; profile: BiomeResidentProfile }) {
  const source = useDirectTexture(profile.art);
  const gestureArt = BIOME_GESTURES[site.kind as keyof typeof BIOME_GESTURES];
  const gestures = useDirectTexture(gestureArt ?? profile.art);
  const baseFrames = source ? atlasFrames(source, 2, 2) : null;
  const frames = baseFrames && gestureArt && gestures ? [...baseFrames, ...atlasFrames(gestures, 2, 2)] : baseFrames;
  const appearance = useRef<Container>(null);
  const sprite = useRef<Sprite>(null), previous = useRef<Sprite>(null), shadow = useRef<Graphics>(null);
  const blend = useRef({ frame: 0, previous: 0, progress: 1 });
  const time = useRef(site.x % 10);
  const target = useEnvironmentTarget(site.id, site.kind, site.x, site.factor);
  useViewportResident(site.id, site.kind, appearance, target, shadow);
  const depthScale = site.factor < 1 ? .7 : 1;
  const height = profile.height * depthScale, width = profile.width * depthScale;
  const scale = height / profile.referenceHeight;
  const ground = WALKABLE_GROUND_Y + 10;
  useSceneTick(ticker => {
    const node = sprite.current;
    const old = previous.current;
    if (!node || !old || !frames) { updateSpriteTarget(site.id, null, height); return; }
    const x = parallaxX(site.x, scene.camera.x, scene.camera.viewW, site.factor);
    node.visible = x > -180 && x < scene.camera.viewW + 180;
    if (appearance.current) appearance.current.visible = node.visible;
    if (shadow.current) shadow.current.visible = node.visible;
    if (node.visible) {
      const seconds = Math.min(100, ticker.elapsedMS) / 1000;
      if (!scene.reducedMotion) time.current += seconds;
      const progress = reactionProgress(target.current), reacting = progress < 1;
      const frame = reacting && frames.length > 4 ? biomeGestureFrame(progress, target.current.visits, scene.reducedMotion) : biomeResidentFrame(time.current, reacting, scene.reducedMotion);
      const alpha = advanceResidentBlend(blend.current, frame, seconds, scene.reducedMotion);
      node.texture = frames[frame]; node.alpha = alpha;
      old.texture = frames[blend.current.previous] ?? frames[frame]; old.alpha = 1 - alpha; old.visible = alpha < 1;
      node.scale.set(scale, scale * (scene.reducedMotion ? 1 : 1 + Math.sin(time.current * 1.7) * .006));
      old.scale.copyFrom(node.scale);
      if (reacting || alpha < 1) markMotion();
    }
    updateSpriteTarget(site.id, node, height, width, site.factor);
  });
  return <pixiContainer label={`biome-resident:${site.kind}:${site.x}`}>
    <pixiGraphics ref={shadow} x={site.x * site.factor} y={ground + 1} draw={paintShadow} scale={width / 100} />
    <pixiContainer ref={appearance} label={`biome-appearance:${site.kind}`}>
      {frames ? <>
        <pixiSprite ref={previous} label={`biome-previous:${site.kind}`} texture={frames[0]} x={site.x * site.factor} y={ground}
          anchor={{ x: .5, y: 356 / 384 }} scale={scale} alpha={0} visible={false} />
        <pixiSprite ref={sprite} label={`biome-body:${site.kind}`} texture={frames[0]} x={site.x * site.factor} y={ground}
          anchor={{ x: .5, y: 356 / 384 }} scale={scale} />
      </> : null}
    </pixiContainer>
  </pixiContainer>;
}
