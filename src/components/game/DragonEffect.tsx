"use client";

import { useEffect, useRef } from "react";
import type { Graphics, Sprite } from "pixi.js";
import { sfx } from "@/lib/client/sound";
import { dragonBeat, dragonFrame, DRAGON_DURATION } from "@/lib/game/dragon";
import { atlasFrames, useDirectTexture } from "./textures";
import { markMotion, scene, worldDelta } from "./scene";
import { useSceneTick } from "./useSceneTick";
import { fx } from "./fx";
import type { EffectProps } from "./Effects";

const clamp = (n: number) => Math.max(0, Math.min(1, n));

/** A single timeline owns the swallow, hidden victim and rear exit. */
export function DragonEffect({ origin, playerId, loud, onDone }: EffectProps) {
  const texture = useDirectTexture("/art/world-v3/animations/dragon.webp");
  const frames = texture ? atlasFrames(texture, 4, 2) : null;
  const art = useRef<Sprite>(null), residue = useRef<Graphics>(null);
  const elapsed = useRef(0), finished = useRef(false), last = useRef("");
  const owner = useRef(Symbol("dragon"));
  const anchor = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const token = owner.current;
    return () => { if (playerId && scene.heroEffects.get(playerId)?.owner === token) scene.heroEffects.delete(playerId); };
  }, [playerId]);
  useSceneTick(ticker => {
    if (finished.current) return;
    markMotion();
    elapsed.current += worldDelta(ticker.elapsedMS) * 1000;
    const t = elapsed.current;
    const live = playerId ? scene.heroes.get(playerId) : undefined;
    anchor.current ??= live ?? origin;
    const { x, y } = anchor.current;
    const size = Math.min(340, scene.camera.viewW * 0.55);
    const unit = size / 340;
    const beat = dragonBeat(t);
    if (last.current !== beat) {
      last.current = beat;
      if (loud) (beat === "arrive" ? sfx.whoosh : beat === "bite" ? sfx.hit : beat === "digest" ? sfx.croak : beat === "release" ? sfx.pop : sfx.pass)();
      if (beat === "bite" || beat === "release") {
        scene.shake = Math.max(scene.shake, beat === "bite" ? 0.6 : 0.8);
        fx.burst({ preset: "shockwave", x, y: y - 40, count: 1, power: 0.7, colors: [0xc6df84] });
        fx.burst({ preset: "puff", x: x + (beat === "release" ? 230 * unit : 0), y: y - 30, count: 34, spreadX: 30, colors: beat === "release" ? [0x92724a, 0xb49b6b, 0xd3bf84] : [0xdde2b2, 0xa4b672] });
        fx.burst({ preset: "stars", x, y: y - 100, count: 16 });
      }
    }
    const node = art.current;
    if (node && frames) {
      node.texture = frames[scene.reducedMotion ? 6 : dragonFrame(t)];
      const arrival = 1 - clamp(t / 1100);
      const leave = clamp((t - 5300) / 1100);
      node.position.set(x + 125 * unit + (scene.reducedMotion ? 0 : arrival * arrival * 550 + leave * leave * 650), y - (scene.reducedMotion ? 0 : arrival * 240 + leave * leave * 350));
      const belly = beat === "digest" && !scene.reducedMotion ? Math.sin(t / 90) * 0.045 : 0;
      node.scale.set(size / 440 * (1 + belly), size / 440 * (1 - belly));
      node.rotation = scene.reducedMotion ? 0 : beat === "strain" ? Math.sin(t / 65) * 0.03 : Math.sin(t / 260) * 0.012;
      node.alpha = Math.min(1, t / 180) * (1 - leave);
    }
    if (playerId) {
      let dx = 0, dy = 0, scale = 1, alpha = 1, rotation = 0;
      if (!scene.reducedMotion) {
        if (beat === "bite") {
          const pull = clamp((t - 1100) / 550);
          dx = 65 * unit * pull; dy = -145 * unit * pull; scale = 1 - pull * 0.9; rotation = -pull * 1.4; alpha = 1 - pull;
        } else if (beat === "digest" || beat === "strain") { alpha = 0; scale = 0.1; }
        else if (beat === "release") {
          const p = clamp((t - 4300) / 1000);
          dx = 260 * unit * (1 - p); dy = -Math.sin(p * Math.PI) * 110 * unit; scale = 0.55 + p * 0.45; rotation = (1 - p) * 5; alpha = 1;
        }
      }
      scene.heroEffects.set(playerId, { owner: owner.current, x: dx, y: dy, scale, alpha, rotation });
    }
    const g = residue.current;
    if (g) {
      g.clear();
      if (t > 4300) {
        const fade = 1 - clamp((t - 5300) / 1100), px = x + 220 * unit;
        g.ellipse(px, y + 4, 52 * unit, 8 * unit).fill({ color: 0x251d15, alpha: 0.3 * fade });
        g.ellipse(px, y - 5, 35 * unit, 13 * unit).fill({ color: 0x68502c, alpha: fade }).stroke({ color: 0x2e2519, width: 2, alpha: fade });
        g.ellipse(px - 4 * unit, y - 17 * unit, 21 * unit, 13 * unit).fill({ color: 0x8a6c38, alpha: fade });
        if (!scene.reducedMotion) for (let i = 0; i < 3; i++) {
          const rise = ((t / 1300 + i / 3) % 1);
          g.moveTo(px - 20 + i * 18, y - 22 - rise * 40).bezierCurveTo(px - 35 + i * 18, y - 32 - rise * 40, px + i * 18, y - 40 - rise * 40, px - 10 + i * 18, y - 48 - rise * 40).stroke({ color: 0xa9bb71, width: 3, alpha: (1 - rise) * fade * 0.6 });
        }
      }
    }
    if (t >= DRAGON_DURATION) {
      finished.current = true;
      if (playerId && scene.heroEffects.get(playerId)?.owner === owner.current) scene.heroEffects.delete(playerId);
      onDone();
    }
  });
  return <pixiContainer><pixiGraphics ref={residue} draw={g => { g.clear(); }} />
    {frames ? <pixiSprite ref={art} texture={frames[0]} anchor={{ x: 0.5, y: 476 / 512 }} /> : null}
  </pixiContainer>;
}
