"use client";

import { useLayoutEffect, useRef } from "react";
import type { Graphics, Sprite } from "pixi.js";
import { dragonMealFrame, DRAGON_MEAL_DURATION } from "@/lib/game/dragon";
import { surfaceAt } from "@/lib/game/world";
import { sfx } from "@/lib/client/sound";
import type { EffectProps } from "./Effects";
import { dragonResidentScale } from "./Dragons";
import { atlasFrames, useDirectTexture } from "./textures";
import { markMotion, scene, worldDelta } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { fx } from "./fx";

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const drawShadow = (g: Graphics) => { g.clear().ellipse(0, 1, 116, 5).fill({ color: 0x211b18, alpha: 0.18 }); };

/** The resident eats the live hero, then returns it to its actual road position. */
export function DragonMeal({ origin, playerId, loud, onDone }: EffectProps) {
  const texture = useDirectTexture("/art/world-v3/animations/dragon-v3.webp");
  const frames = texture ? atlasFrames(texture, 4, 2) : null;
  const art = useRef<Sprite>(null), elapsed = useRef(0), beat = useRef(-1), done = useRef(false);
  const shadow = useRef<Graphics>(null);
  const owner = useRef(Symbol("resident-dragon"));
  const start = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const token = owner.current;
    const meal = { nest: origin.x, playerId: playerId ?? "", scale: dragonResidentScale(origin.x) };
    scene.dragonMeal = meal;
    return () => {
      if (scene.dragonMeal === meal) scene.dragonMeal = null;
      if (playerId && scene.heroEffects.get(playerId)?.owner === token) scene.heroEffects.delete(playerId);
    };
  }, [origin.x, playerId]);

  useSceneTick({ priority: 10, callback: ticker => {
    if (done.current) return;
    markMotion();
    elapsed.current += worldDelta(ticker.elapsedMS) * 1000;
    const t = elapsed.current, x = origin.x, y = surfaceAt(x), scale = dragonResidentScale(x);
    if (t >= DRAGON_MEAL_DURATION) {
      done.current = true;
      if (playerId && scene.heroEffects.get(playerId)?.owner === owner.current) scene.heroEffects.delete(playerId);
      onDone();
      return;
    }
    if (!frames || !art.current) return;
    const live = playerId ? scene.heroes.get(playerId) : undefined;
    if (!live) { done.current = true; onDone(); return; }
    start.current ??= Math.abs(live.x - x) < 350 ? { ...live } : { x: x - 210, y };
    const pose = dragonMealFrame(t);
    if (scene.dragonMeal) scene.dragonMeal.scale = scale;
    const node = art.current;
    node.texture = frames[pose];
    node.position.set(x, y);
    const rumble = !scene.reducedMotion && pose === 4 ? Math.sin(t / 95) * 0.025 : 0;
    node.scale.set(scale * (1 + rumble), scale * (1 - rumble));
    shadow.current?.scale.set(scale / 0.62 * 0.7, scale / 0.62);
    if (beat.current !== pose) {
      beat.current = pose;
      if (loud) (pose === 2 ? sfx.croak : pose === 3 ? sfx.hit : pose === 6 ? sfx.pop : sfx.pass)();
      if (pose === 3 || pose === 6) fx.burst({ preset: "puff", x: x - 135 * scale, y: y - 195 * scale, count: scene.reducedMotion ? 3 : 12, colors: [0xc9c29a, 0xe1d6ad] });
    }

    let px = start.current.x, py = start.current.y, heroScale = 1, alpha = 1, rotation = 0;
    if (t < 1400) {
      const pull = clamp((t - 300) / 900);
      px += (x - 150 * scale - px) * pull;
      py += (y - 210 * scale - py) * pull;
      heroScale = 1 - pull * 0.9;
      alpha = 1 - clamp((t - 900) / 400);
      if (!scene.reducedMotion) rotation = -pull * 1.1;
    } else if (t < 3500) {
      alpha = 0; heroScale = 0.1;
    } else {
      const spit = clamp((t - 3500) / 850);
      px = x - 150 * scale - 100 * spit;
      py = y - (1 - spit) * 210 * scale - (scene.reducedMotion ? 0 : Math.sin(spit * Math.PI) * 70);
      heroScale = 0.2 + spit * 0.8;
      if (!scene.reducedMotion) rotation = (1 - spit) * -4;
      const home = clamp((t - 4500) / 900);
      // A distant explorer fades home instead of flying across the entire map.
      if (Math.abs(live.x - x) > 500) alpha = 1 - home;
      else { px += (live.x - px) * home; py += (live.y - py) * home; }
    }
    scene.heroEffects.set(playerId!, { owner: owner.current, x: px - live.x, y: py - live.y, scale: heroScale, alpha, rotation });
  } });
  return frames ? <pixiContainer>
    <pixiGraphics ref={shadow} draw={drawShadow} x={origin.x} y={surfaceAt(origin.x)} />
    <pixiSprite ref={art} label="dragon-meal" texture={frames[2]} anchor={{ x: 0.5, y: 476 / 512 }} x={origin.x} y={surfaceAt(origin.x)} scale={0.62} />
  </pixiContainer> : null;
}
